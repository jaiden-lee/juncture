import { Request, Response } from 'express';
import redis from '../../utils/redis';
import crypto from 'crypto';
import axios from 'axios';
import { isCloudModeEnabled, useCloudContextManager } from '../../utils/CloudContextManager';
import { addConnectionToDB } from '../../utils/db_helpers';

type GetAuthorizationURIBody = {
    provider: string;
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

/**
 * 
 * @req provider The provider is the name of the provider (i.e. 'jira')
 * @req juncture_public_key? (only for Juncture-Cloud) Juncture-cloud uses the public key to identify what your project is
 * @req external_id The external_id is how you can uniquely identify connections in your own database (i.e. if you are managing projects and projects can integrate with Jira, then the external_id would be the project_id - there can be 1 connection per {provider, external_id} pair)
 * @returns 
 */
export async function getAuthorizationURI(req: Request<{}, {}, GetAuthorizationURIBody>, res: Response): Promise<void> {
    let { provider, juncture_public_key, external_id } = req.body;

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
    redis.set(state, JSON.stringify(redis_body), {
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
 * @returns 
 */
export async function authorizationCallback(req: Request<{ provider: string }, {}, {}, OAuthCallbackQuery>, res: Response): Promise<void> {
    const { code, state } = req.query;
    const { provider } = req.params;

    if (!code || !state) {
        res.status(400).json({ error: 'Invalid request' });
        return;
    }

    // Verify state
    const storedState = await redis.get(state) as string | null;
    if (!storedState) {
        res.status(400).json({ error: 'Invalid state or expired state. Please try again.' });
        return;
    }

    const storedStateBody = JSON.parse(storedState);
    const external_id = storedStateBody.external_id;
    const juncture_public_key = storedStateBody.juncture_project_id;

    // Get OAuth credentials
    const redirect_uri = process.env.DEFAULT_JIRA_REDIRECT_URI!;
    const credentials = await getOAuthCredentials(provider, juncture_public_key);
    if ('error' in credentials) {
        res.status(400).json(credentials);
        return;
    }
    const { client_id, client_secret, site_redirect_uri, juncture_project_id } = credentials;

    
    let tokenResponse;
    let connectionExpiryDate: Date;
    if (provider === 'jira') {
        tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
            grant_type: 'authorization_code',
            code,
            client_id,
            client_secret,
            redirect_uri,
        });
        // Set expiration to 364 days from now (1 year minus 1 day)
        const expiryDate = new Date(Date.now() + 364 * 24 * 60 * 60 * 1000);
        connectionExpiryDate = expiryDate;
    }
    else {
        res.status(400).json({ error: 'Invalid provider' });
        return;
    }

    if (!tokenResponse) {
        res.status(400).json({ error: 'Invalid token response' });
        return;
    }

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;
    const expiresIn = tokenResponse.data.expires_in - 60; // 1 minute buffer

    // Store access token in redis
    redis.set(accessToken, '1', {
        ex: expiresIn
    });

    
    // Add to juncture-core.Connection(connection_id, refresh_token, expires_at, created_at, last_updated)
    const connection_id = crypto.randomUUID();
    if (!isCloudModeEnabled()) {
        const success = await addConnectionToDB(
            connection_id,
            external_id,
            refreshToken,
            connectionExpiryDate
        );
        if (!success) {
            res.status(500).json({ error: 'Failed to create connection. Please try again later.' });
            return;
        }
    } else {
    // Add to juncture-cloud.ProjectConnectionMap(project_id, external_id, provider, connection_id)
        if (!juncture_project_id) {
            res.status(400).json({ error: 'Juncture project ID is required' });
            return;
        }
        const cloudContextManager = useCloudContextManager();
        const success = await cloudContextManager.addConnection(
            connection_id,
            external_id,
            provider,
            juncture_project_id,
            refreshToken,
            connectionExpiryDate
        );
        // addConnection is a SQL transaction, to ensure both succeed --> ACID
        if (!success) {
            res.status(500).json({ error: 'Failed to create connection. Please try again later.' });            
            return;
        }
    }

    if (!site_redirect_uri) {
        res.status(200).json({
            success: true,
            message: 'Connection created successfully. However, please specify a site_redirect_uri in the request for a better user experience.'
        });
        return;
    }
    res.redirect(site_redirect_uri);
    return;
}


async function getOAuthCredentials(provider: string, juncture_public_key?: string): Promise<GetOAuthCredentialsResponse> {
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
    



