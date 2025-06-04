import redis from "./redis";
import { getConnectionDetails, updateConnectionInDB, updateConnectionInvalidFlag } from "./connection_db_helpers";
import axios from "axios";
import { getOAuthCredentials, GetOAuthCredentialsResponse } from "./oauth_helpers";
import { providerEnumType } from "../db/schema";

type GetNewAccessTokenResponse = {
    accessToken: string;
    expiresIn: number;
} | {
    error: string;
}

export async function storeAccessTokenInRedis(accessToken: string, expiresIn: number, connectionId: string): Promise<void> {
    const key = `access_token:${connectionId}`;
    await redis.set(key, accessToken, {
        ex: expiresIn
    });
}

export async function getAccessTokenFromRedis(connectionId: string): Promise<GetNewAccessTokenResponse> {
    const key = `access_token:${connectionId}`;
    const pipeline = redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    const [accessToken, expiresIn] = await pipeline.exec();
    if (!accessToken) {
        return {
            error: 'Access token not found in Redis'
        };
    }
    return {
        accessToken: accessToken as string,
        expiresIn: expiresIn as number
    };
}

export async function getNewAccessTokenFromConnection(connectionId: string, provider: providerEnumType, projectId?: string): Promise<GetNewAccessTokenResponse> {
    const connectionDetails = await getConnectionDetails(connectionId);
    if (!connectionDetails) {
        return {
            error: 'Connection not found'
        };
    }
    
    const refreshToken = connectionDetails.refreshToken;
    const expiresAt = connectionDetails.expiresAt;
    const isInvalid = connectionDetails.invalidRefreshToken || expiresAt.getTime() < Date.now();
    
    if (isInvalid) {
        return {
            error: 'Connection is invalid or expired. Please reauthorize the connection.'
        };
    }
    
    let options = undefined;
    if (projectId) {
        options = {
            projectId: projectId
        }
    }
    const credentials = await getOAuthCredentials(provider, options);
    if ('error' in credentials) {
        return {
            error: 'Failed to get OAuth credentials'
        };
    }
    const { client_id, client_secret } = credentials;
    
    let response;
    if (provider === 'jira') {
        try {
            response = await axios.post('https://auth.atlassian.com/oauth/token', {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: client_id,
                client_secret: client_secret
            });
        } catch (error: any) {
            // Handle 403 Forbidden with invalid_grant error
            if (error.response && 
                error.response.status === 403 && 
                error.response.data && 
                error.response.data.error === 'invalid_grant') {
                
                // Mark the connection as invalid in the database (don't await)
                updateConnectionInvalidFlag(connectionId, true);
                
                return {
                    error: 'Connection is invalid. The refresh token is no longer valid. Please reauthorize the connection.'
                };
            }
            
            // Handle other errors
            console.error('Error refreshing Jira access token:', error);
            return {
                error: 'Failed to refresh access token'
            };
        }
    }
    if (!response) {
        return {
            error: 'Failed to get access token'
        };
    }
    const accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in - 300;

    // no need to await - if unsuccessful, the user will just have to recall later and reauthorize
    storeAccessTokenInRedis(accessToken, expiresIn, connectionId);
    updateConnectionInDB(connectionId, response.data.refresh_token, new Date(expiresAt.getTime() + expiresIn * 1000));
    return {
        accessToken,
        expiresIn
    };
}


export async function getAccessTokenHelper(connectionId: string, provider: providerEnumType, projectId?: string): Promise<GetNewAccessTokenResponse> {
    const accessTokenResult = await getAccessTokenFromRedis(connectionId);
    if ('error' in accessTokenResult) {
        return await getNewAccessTokenFromConnection(connectionId, provider, projectId);
    }
    return accessTokenResult;
}