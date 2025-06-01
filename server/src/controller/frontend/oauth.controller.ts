import { Request, Response } from 'express';
import redis from '../../utils/redis';
import crypto from 'crypto';
import axios from 'axios';
import { isCloudModeEnabled, useCloudContextManager } from '../../utils/CloudContextManager';
import { addConnectionToDB, getConnectionID, updateConnectionInDB } from '../../utils/db_helpers';
import { providerEnumType, providerEnum } from '../../db/schema';

type GetAuthorizationURIBody = {
    provider: providerEnumType;
    juncture_public_key?: string;
    external_id: string;
}

type OAuthCallbackQuery = {
    code: string;
    state: string;
}

type RedisOAuthStateBody = {
    external_id: string;
    juncture_public_key?: string;
}    

type GetOAuthCredentialsResponse = {
    client_id: string;
    client_secret: string;
    scopes: string[];
    site_redirect_uri: string;
    juncture_project_id?: string;
} | {
    error: string;
}

type TokenResponse = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

/**
 * 
 * @req provider The provider is the name of the provider (i.e. 'jira')
 * @req juncture_public_key? (only for Juncture-Cloud) Juncture-cloud uses the public key to identify what your project is
 * @req external_id The external_id is how you can uniquely identify connections in your own database (i.e. if you are managing projects and projects can integrate with Jira, then the external_id would be the project_id - there can be 1 connection per {provider, external_id} pair)
 * @returns 
 */
export async function getAuthorizationURI(req: Request<{}, {}, GetAuthorizationURIBody>, res: Response): Promise<void> {
    let { provider, juncture_public_key, external_id } = req.body;

    if (!providerEnum.enumValues.includes(provider)) {
        res.status(400).json({ error: 'Invalid provider. Ensure that all provider names are lowercase.' });
        return;
    }

    const redirect_uri = process.env.DEFAULT_JIRA_REDIRECT_URI!;

    const credentials = await getOAuthCredentials(provider, juncture_public_key);
    if ('error' in credentials) {
        res.status(400).json(credentials);
        return;
    }
    const { client_id, scopes } = credentials;

    // Generate state params
    const state = crypto.randomUUID();

    /* Content to store as value in redis. 
    Need to store external_id and juncture_public_key if available 
    so that we can link the connection_id to the project_id and external_id 
    in the callback function
    */
    const redis_body: RedisOAuthStateBody = {
        "external_id": external_id,
        "juncture_public_key": juncture_public_key // will be undefined it doesn't exist
    }

    // Store state in redis
    redis.set(state, redis_body, {
        ex: 600 // 10 minutes
    });


    // Generate authorization URI
    let authorizationUri = '';
    if (provider === 'jira') {
        scopes.push('offline_access'); // refresh_token
        authorizationUri = `https://auth.atlassian.com/authorize?` +
            `audience=api.atlassian.com&` +
            `client_id=${client_id}&` +
            `scope=${scopes.join('%20')}&` +
            `redirect_uri=${redirect_uri}&` +
            `state=${state}&` +
            `response_type=code&` +
            `prompt=consent`;
    }
    else {
        res.status(400).json({ error: 'Invalid provider' });
        return;
    }
    res.status(200).json({ authorizationUri });
    return;
}

/**
 * 
 * @url_param provider The provider is the name of the provider (i.e. 'jira')
 * @query_param code The authorization code (used to exchange for access token and refresh token)
 * @query_param state The state (used to verify the request)
 * @returns JSON response if site_redirect_uri is not specified, otherwise redirects to site_redirect_uri
 */
export async function authorizationCallback(req: Request<{ provider: providerEnumType }, {}, {}, OAuthCallbackQuery>, res: Response): Promise<void> {
    const { code, state } = req.query;
    const { provider } = req.params;

    if (!providerEnum.enumValues.includes(provider)) {
        res.status(400).json({ error: 'Invalid provider. Ensure that all provider names are lowercase.' });
        return;
    }

    if (!code || !state) {
        res.status(400).json({ error: 'Invalid request' });
        return;
    }

    // Verify state and extract stored data
    const stateData = await verifyAndExtractState(state);
    if ('error' in stateData) {
        res.status(400).json({ error: stateData.error });
        return;
    }
    
    const { external_id, juncture_public_key } = stateData;

    // Get OAuth credentials
    const credentials = await getOAuthCredentials(provider, juncture_public_key);
    if ('error' in credentials) {
        res.status(400).json(credentials);
        return;
    }
    
    // Exchange authorization code for tokens
    const tokenResult = await exchangeCodeForTokens(provider, code, credentials);
    if ('error' in tokenResult) {
        res.status(400).json({ error: tokenResult.error });
        return;
    }    

    const { accessToken, refreshToken, expiresIn, connectionExpiryDate } = tokenResult;
    
    // Create connection in database
    const connectionResult = await createConnection(
        provider, 
        external_id, 
        refreshToken, 
        connectionExpiryDate, 
        credentials.juncture_project_id
    );
    
    if ('error' in connectionResult) {
        res.status(500).json({ error: connectionResult.error });
        return;
    }

    // Store access token in redis (no need to await)
    storeAccessToken(accessToken, expiresIn);
    
    // Handle response
    if (credentials.site_redirect_uri === '') {
        res.status(200).json({
            success: true,
            message: 'Connection created successfully. However, please specify a site_redirect_uri in the request for a better user experience.'
        });
        return;
    }
    
    res.redirect(credentials.site_redirect_uri);
}

/**
 * Verifies the state parameter and extracts stored data
 */
async function verifyAndExtractState(state: string): Promise<{ external_id: string; juncture_public_key?: string } | { error: string }> {
    try {
        const storedState = await redis.get(state) as RedisOAuthStateBody;
        if (!storedState) {
            return { error: 'Invalid state or expired state. Please try again.' };
        }
        return {
            external_id: storedState.external_id,
            juncture_public_key: storedState.juncture_public_key
        };
    } catch (error) {
        console.error('Error verifying state:', error);
        return { error: 'Invalid state or expired state. Please try again.' };
    }
}






// ----------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------------------------



/**
 * Exchanges authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(
    provider: providerEnumType, 
    code: string, 
    credentials: GetOAuthCredentialsResponse
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; connectionExpiryDate: Date } | { error: string }> {
    if ('error' in credentials) {
        return { error: credentials.error };
    }
    
    const { client_id, client_secret } = credentials;
    const redirect_uri = process.env.DEFAULT_JIRA_REDIRECT_URI!;
    
    let tokenResponse;
    let connectionExpiryDate: Date;
    
    try {
        if (provider === 'jira') {
            tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
                grant_type: 'authorization_code',
                code,
                client_id,
                client_secret,
                redirect_uri,
            });
            
            // Set expiration to 364 days from now (1 year minus 1 day)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 364);
            connectionExpiryDate = expiryDate;
        } else {
            return { error: 'Invalid provider' };
        }
        
        if (!tokenResponse) {
            return { error: 'Invalid token response' };
        }
        
        const accessToken = tokenResponse.data.access_token;
        const refreshToken = tokenResponse.data.refresh_token;
        const expiresIn = tokenResponse.data.expires_in - 60; // 1 minute buffer
        
        return { accessToken, refreshToken, expiresIn, connectionExpiryDate };
    } catch (error) {
        console.error('Error exchanging code for tokens: ', error);
        return { error: 'Failed to exchange authorization code for tokens' };
    }
}

/**
 * Stores the access token in Redis
 */
async function storeAccessToken(accessToken: string, expiresIn: number): Promise<void> {
    await redis.set(accessToken, '1', {
        ex: expiresIn
    });
}

/**
 * Creates a connection in the database
 */
async function createConnection(
    provider: providerEnumType,
    external_id: string,
    refreshToken: string,
    connectionExpiryDate: Date,
    juncture_project_id?: string
): Promise<{ connection_id: string } | { error: string }> {    
    if (!isCloudModeEnabled()) {
        let connection_id = await getConnectionID(external_id, provider);
        if (connection_id) {
            const success = await updateConnectionInDB(connection_id, refreshToken, connectionExpiryDate);
            if (!success) {
                return { error: 'Failed to update connection. Please try again later.' };
            }
            return { connection_id };
        }

        connection_id = crypto.randomUUID();
        const success = await addConnectionToDB(
            connection_id,
            external_id,
            refreshToken,
            connectionExpiryDate,
            provider
        );
        
        if (!success) {
            return { error: 'Failed to create connection. Please try again later.' };
        }
        return { connection_id };
    } else {
        // Add to juncture-cloud.ProjectConnectionMap
        if (!juncture_project_id) {
            return { error: 'Juncture project ID is required' };
        }
        
        const cloudContextManager = useCloudContextManager();
        let connection_id = await cloudContextManager.getConnectionID(external_id, provider, juncture_project_id);
        if (connection_id) {
            const success = await cloudContextManager.updateConnection(
                connection_id,
                refreshToken,
                connectionExpiryDate
            );
            if (!success) {
                return { error: 'Failed to update connection. Please try again later.' };
            }
            return { connection_id };
        }
        
        connection_id = crypto.randomUUID();
        const success = await cloudContextManager.addConnection(
            connection_id,
            external_id,
            provider,
            juncture_project_id,
            refreshToken,
            connectionExpiryDate
        );
        
        if (!success) {
            return { error: 'Failed to create connection. Please try again later.' };
        }
        return { connection_id };
    }
    
}


async function getOAuthCredentials(provider: providerEnumType, juncture_public_key?: string): Promise<GetOAuthCredentialsResponse> {
    let client_id: string;
    let client_secret: string;
    let scopes: string[];
    let site_redirect_uri: string;
    let juncture_project_id: string | undefined = undefined;

    // Only relevant for Juncture-Cloud, not for OSS
    if (isCloudModeEnabled()) {
        if (!juncture_public_key) {
            return { error: 'Juncture public key is required' };
        }
        const cloudContextManager = useCloudContextManager();
        const credentials = await cloudContextManager.getOAuthCredentials(provider, juncture_public_key!);
        if (!credentials) {
            return { error: 'Invalid juncture public key' };
        }
        client_id = credentials.clientID;
        scopes = credentials.scopes;
        juncture_project_id = credentials.junctureProjectID;
        client_secret = credentials.clientSecret;
        site_redirect_uri = credentials.siteRedirectURI;
    } else {
        // For OSS, provide own credentials in .env file
        client_id = process.env.DEFAULT_JIRA_CLIENT_ID!;
        scopes = process.env.DEFAULT_JIRA_SCOPES!.split(',');
        client_secret = process.env.DEFAULT_JIRA_CLIENT_SECRET!;
        site_redirect_uri = process.env.DEFAULT_JIRA_SITE_REDIRECT_URI || '';
    }

    return {
        client_id,
        client_secret,
        scopes,
        site_redirect_uri,
        juncture_project_id
    }
}
