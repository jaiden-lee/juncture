import { Request, Response } from 'express';
import redis from '../../utils/redis';
import crypto from 'crypto';
import axios from 'axios';
import { isCloudModeEnabled, useCloudContextManager } from '../../utils/CloudContextManager';
import { addConnectionToDB, getConnectionID, updateConnectionInDB } from '../../utils/connection_db_helpers';
import { providerEnumType, providerEnum } from '../../db/schema';
import { storeAccessTokenInRedis } from '../../utils/credential_helpers';
import { getOAuthCredentials, GetOAuthCredentialsResponse } from '../../utils/oauth_helpers';
import { generateTemporaryConnectionCode } from '../../utils/integration_helpers/general';
import { ConnectionCodeCacheBody } from '../../utils/integration_helpers/general';

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

    if (!provider || !external_id) {
        res.status(400).json({ error: 'Missing provider or external_id' });
        return;
    }

    if (!providerEnum.enumValues.includes(provider)) {
        res.status(400).json({ error: 'Invalid provider. Ensure that all provider names are lowercase.' });
        return;
    }

    const redirect_uri = process.env.DEFAULT_JIRA_REDIRECT_URI!;

    let options = undefined;
    if (juncture_public_key) {
        options = { juncture_public_key };
    }
    const credentials = await getOAuthCredentials(provider, options);
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

    if (!provider || !providerEnum.enumValues.includes(provider)) {
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
    let options = undefined;
    if (juncture_public_key) {
        options = { juncture_public_key };
    }
    const credentials = await getOAuthCredentials(provider, options);
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
    let connection_id = await getConnectionID(external_id, provider);
    let is_new_connection = false;
    // new connection, create the UUID
    if (!connection_id) {
        connection_id = crypto.randomUUID();
        is_new_connection = true;
    }
    // const connectionResult = await createConnection(
    //     connection_id,
    //     provider, 
    //     external_id, 
    //     refreshToken, 
    //     connectionExpiryDate, 
    //     credentials.juncture_project_id
    // );
    
    // if ('error' in connectionResult) {
    //     res.status(500).json({ error: connectionResult.error });
    //     return;
    // }

    // Store access token in redis (no need to await)
    storeAccessTokenInRedis(accessToken, expiresIn, connection_id);
    
    const connectionCodeCacheBody: ConnectionCodeCacheBody = {
        connection_id,
        provider,
        external_id,
        refresh_token: refreshToken,
        connection_expiry_date: connectionExpiryDate,
        juncture_project_id: credentials.juncture_project_id,
        is_new_connection
    }

    const connection_code = await generateTemporaryConnectionCode(provider, connectionCodeCacheBody);

    // Redirect to juncture-frontend to finalize integration
    res.redirect(`${process.env.JUNCTURE_FRONTEND_URL}/finalize-connection/${provider}/${connection_code}`);
    return;
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

