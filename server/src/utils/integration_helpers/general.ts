import crypto from 'crypto';
import redis from '../redis';
import { providerEnumType } from '../../db/schema';
import { isCloudModeEnabled, useCloudContextManager } from '../CloudContextManager';
import { getConnectionID, updateConnectionInDB, addConnectionToDB } from '../connection_db_helpers';
import { ExtendTransaction } from '../connection_db_helpers';


export function getConnectionCodeCacheKey(provider: string, code: string) {
    return `connection_code:${provider}:${code}`;
}

export type ConnectionCodeCacheBody = {
    connection_id: string;
    provider: string;
    external_id: string;
    refresh_token: string;
    connection_expiry_date: Date;
    juncture_project_id?: string;
    is_new_connection: boolean;
    extendTransaction?: ExtendTransaction;
}

export async function generateTemporaryConnectionCode(provider: string, connectionCodeCacheBody: ConnectionCodeCacheBody ) {
    const code = crypto.randomUUID();

    const connection_code_key = getConnectionCodeCacheKey(provider, code);

    // no need to await, if failure user just has to reauthenticate
    redis.set(connection_code_key, connectionCodeCacheBody, {
        ex: 900, // 15 minutes expiration
    });

    return code;
}



type GetConnectionDetailsFromConnectionCodeResponse = ConnectionCodeCacheBody | {
    error: string;
}

export async function getConnectionDetailsFromConnectionCode(provider: string, code: string): Promise<GetConnectionDetailsFromConnectionCodeResponse> {
    const connection_code_key = getConnectionCodeCacheKey(provider, code);
    const connectionDetails = await redis.get(connection_code_key) as ConnectionCodeCacheBody | null;
    
    if (!connectionDetails) {
        return { error: 'Connection ID not found: session is either expired or does not exist' };
    }

    return connectionDetails;
}





/**
 * Creates a connection in the database
 */
export async function createConnection(
    connection_id: string,
    provider: providerEnumType,
    external_id: string,
    refreshToken: string,
    connectionExpiryDate: Date,
    is_new_connection: boolean,
    juncture_project_id?: string,
    extendTransaction?: ExtendTransaction,
): Promise<{ connection_id: string } | { error: string }> {    
    if (!isCloudModeEnabled()) {
        if (!is_new_connection) {
            const success = await updateConnectionInDB(connection_id, refreshToken, connectionExpiryDate, extendTransaction);
            if (!success) {
                return { error: 'Failed to update connection. Please try again later.' };
            }
            return { connection_id };
        }

        const success = await addConnectionToDB(
            connection_id,
            external_id,
            refreshToken,
            connectionExpiryDate,
            provider,
            extendTransaction
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
        if (connection_id) {
            const success = await cloudContextManager.updateConnection(
                connection_id,
                refreshToken,
                connectionExpiryDate,
                extendTransaction
            );
            if (!success) {
                return { error: 'Failed to update connection. Please try again later.' };
            }
            return { connection_id };
        }
        
        const success = await cloudContextManager.addConnection(
            connection_id,
            external_id,
            provider,
            juncture_project_id,
            refreshToken,
            connectionExpiryDate,
            extendTransaction
        );
        
        if (!success) {
            return { error: 'Failed to create connection. Please try again later.' };
        }
        return { connection_id };
    }
    
}