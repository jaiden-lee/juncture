import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { connection, connectionExternalMap, providerEnumType } from "../db/schema";
import { PostgresError } from "postgres";
import redis from "../utils/redis";

// Juncture-core uses to add to db. Juncture-cloud extends this function in its own CloudContextManager interface by using it in a sql transaction
export async function addConnectionToDB(connection_id: string, external_id: string, refresh_token: string, expires_at: Date, provider: providerEnumType): Promise<boolean> {
    try {
        const drizzle = getDb();
        
        // Use a transaction to ensure both inserts succeed or both fail
        const result = await drizzle.transaction(async (tx) => {
            // First insert into connection table
            const connectionResult = await tx.insert(connection).values({
                connectionId: connection_id,
                refreshToken: refresh_token,
                expiresAt: expires_at,
                createdAt: new Date(),
                lastUpdated: new Date()
            }).returning();
            
            // Then insert into connectionExternalMap table
            await tx.insert(connectionExternalMap).values({
                externalId: external_id,
                provider: provider,
                connectionId: connection_id
            });
            
            return connectionResult;
        });
        
        // If we get here, the transaction was successful
        console.log('Connection added successfully:', result);
        return true;
    } catch (error) {
        // Handle PostgreSQL specific errors
        if (error instanceof PostgresError) {
            if (error.code === '23505') {
                console.error('Transaction failed: Duplicate key violation when adding connection:', error.message);
            } else if (error.code === '23503') {
                console.error('Transaction failed: Foreign key constraint violation when adding connection:', error.message);
            } else {
                console.error('Transaction failed: PostgreSQL error when adding connection:', error.code, error.message);
            }
        } else {
            console.error('Transaction failed: Error adding connection to database:', error);
        }
        return false;
    }
}

export async function updateConnectionInDB(connection_id: string, refresh_token: string, expires_at: Date): Promise<boolean> {
    try {
        const drizzle = getDb();
        
        // Update connection
        await drizzle.update(connection).set({
            refreshToken: refresh_token,
            expiresAt: expires_at,
            lastUpdated: new Date()
        }).where(eq(connection.connectionId, connection_id));

        return true;
    } catch (error) {
        console.error('Error updating connection in database:', error);
        return false;
    }
}





// Redis key prefix for connection ID cache
const CONNECTION_ID_CACHE_PREFIX = "connection_id:";
// Cache expiration time in seconds (24 hours)
const CACHE_EXPIRY = 86400;

/**
 * Generates a Redis key for connection ID cache
 * @param external_id External ID of the connection
 * @param provider Provider type (e.g., 'jira')
 * @returns Redis key string
 */
function getConnectionCacheKey(external_id: string, provider: providerEnumType): string {
    return `${CONNECTION_ID_CACHE_PREFIX}${provider}:${external_id}`;
}

export async function getConnectionID(external_id: string, provider: providerEnumType): Promise<string | null> {
    try {
        // Check Redis cache first
        const cacheKey = getConnectionCacheKey(external_id, provider);
        const cachedConnectionId = await redis.get(cacheKey);
        
        // If found in cache, return it
        if (cachedConnectionId) {
            console.log(`Connection ID found in Redis cache for ${provider}:${external_id}`);
            return cachedConnectionId as string;
        }
        
        // Not in cache, query the database
        const drizzle = getDb();
        
        const connectionExists = await drizzle.select().from(connectionExternalMap).where(and(eq(connectionExternalMap.externalId, external_id), eq(connectionExternalMap.provider, provider))).limit(1);
        if (connectionExists.length === 0) {
            console.error('Connection not found in database');
            return null;
        }

        const connectionId = connectionExists[0].connectionId;
        
        // Cache the result in Redis (no need to await)
        redis.set(cacheKey, connectionId, { ex: CACHE_EXPIRY }).catch(error => {
            console.error('Error caching connection ID in Redis:', error);
        });
        
        return connectionId;
    } catch (error) {
        console.error('Error getting connection ID from database:', error);
        return null;
    }
}