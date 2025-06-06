import crypto from 'crypto';
import redis from '../redis';


function getConnectionCodeCacheKey(provider: string, code: string) {
    return `connection_code:${provider}:${code}`;
}

export async function generateTemporaryConnectionCode(provider: string, connectionId: string) {
    const code = crypto.randomUUID();

    const connection_code_key = getConnectionCodeCacheKey(provider, code);

    // no need to await, if failure user just has to reauthenticate
    redis.set(connection_code_key, connectionId, {
        ex: 900, // 15 minutes expiration
    });

    return code;
}



type GetConnectionIdFromConnectionCodeResponse = {
    connectionId: string;
} | {
    error: string;
}

export async function getConnectionIdFromConnectionCode(provider: string, code: string): Promise<GetConnectionIdFromConnectionCodeResponse> {
    const connection_code_key = getConnectionCodeCacheKey(provider, code);
    const connectionId = await redis.get(connection_code_key) as string | null;
    
    if (!connectionId) {
        return { error: 'Connection ID not found' };
    }

    return { connectionId };
}