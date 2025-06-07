import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { connection, connectionExternalMap, providerEnumType } from "../db/schema";
import { PostgresError } from "postgres";
import redis from "./redis";

// Redis key prefixes and expiration time
const CONNECTION_ID_CACHE_PREFIX = "connection_id:";
const CONNECTION_DETAILS_CACHE_PREFIX = "connection_details:";
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

/**
 * Generates a Redis key for connection details cache
 * @param connection_id Connection ID
 * @returns Redis key string
 */
function getConnectionDetailsCacheKey(connection_id: string): string {
    return `${CONNECTION_DETAILS_CACHE_PREFIX}${connection_id}`;
}

/**
 * Invalidates connection details in Redis cache
 * @param connection_id Connection ID to invalidate
 */
async function invalidateConnectionCache(connection_id: string): Promise<void> {
    try {
        await redis.del(getConnectionDetailsCacheKey(connection_id));
        console.log(`Cache invalidated for connection ID: ${connection_id}`);
    } catch (error) {
        console.error('Error invalidating connection cache:', error);
    }
}


export type ExtendTransaction = (tx: any) => Promise<void>;
// Juncture-core uses to add to db. Juncture-cloud extends this function in its own CloudContextManager interface by using it in a sql transaction
export async function addConnectionToDB(connection_id: string, external_id: string, refresh_token: string, expires_at: Date, provider: providerEnumType, extendTransaction?: ExtendTransaction): Promise<boolean> {
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

            if (extendTransaction) {
                await extendTransaction(tx);
            }
            
            return connectionResult;
        });
        
        // If we get here, the transaction was successful
        console.log('Connection added successfully:', result);
        
        // Cache the connection ID (no need to await)
        const cacheKey = getConnectionCacheKey(external_id, provider);
        redis.set(cacheKey, connection_id, { ex: CACHE_EXPIRY }).catch(error => {
            console.error('Error caching connection ID in Redis:', error);
        });
        
        // Cache the connection details (no need to await)
        const detailsCacheKey = getConnectionDetailsCacheKey(connection_id);
        const connectionDetails = result[0];
        redis.set(detailsCacheKey, JSON.stringify(connectionDetails), { ex: CACHE_EXPIRY }).catch(error => {
            console.error('Error caching connection details in Redis:', error);
        });
        
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

export async function updateConnectionInDB(connection_id: string, refresh_token: string, expires_at: Date, extendTransaction?: ExtendTransaction): Promise<boolean> {
    try {
        const drizzle = getDb();
        
        // Update connection
        const result = await drizzle.transaction(async (tx) => {
            const updatedConnection = await tx.update(connection).set({
                refreshToken: refresh_token,
                expiresAt: expires_at,
                lastUpdated: new Date()
            }).where(eq(connection.connectionId, connection_id)).returning();

            if (extendTransaction) {
                await extendTransaction(tx);
            }

            return updatedConnection;
        });

        // Invalidate the cache for this connection
        // await invalidateConnectionCache(connection_id);
        // no need to invalidate the cache since the cache entry is updated automatically if successful
        
        // Update the cache with new data if the update was successful
        if (result.length > 0) {
            const detailsCacheKey = getConnectionDetailsCacheKey(connection_id);
            redis.set(detailsCacheKey, JSON.stringify(result[0]), { ex: CACHE_EXPIRY }).catch(error => {
                console.error('Error updating connection details in Redis cache:', error);
            });
        }

        return true;
    } catch (error) {
        console.error('Error updating connection in database:', error);
        return false;
    }
}

/**
 * Updates the invalidRefreshToken flag for a connection
 * @param connection_id Connection ID
 * @param isInvalid Whether the refresh token is invalid
 * @returns Success status
 */
export async function updateConnectionInvalidFlag(connection_id: string, isInvalid: boolean): Promise<boolean> {
    try {
        const drizzle = getDb();
        
        // Update connection
        const result = await drizzle.update(connection).set({
            invalidRefreshToken: isInvalid,
            lastUpdated: new Date()
        }).where(eq(connection.connectionId, connection_id)).returning();

        // Invalidate the cache for this connection
        // await invalidateConnectionCache(connection_id);
        // no need to invalidate the cache since the cache entry is updated automatically if successful
        
        // Update the cache with new data if the update was successful
        if (result.length > 0) {
            const detailsCacheKey = getConnectionDetailsCacheKey(connection_id);
            redis.set(detailsCacheKey, JSON.stringify(result[0]), { ex: CACHE_EXPIRY }).catch(error => {
                console.error('Error updating connection details in Redis cache:', error);
            });
        }

        return true;
    } catch (error) {
        console.error('Error updating connection invalid flag in database:', error);
        return false;
    }
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

export async function getConnectionDetails(connection_id: string): Promise<typeof connection.$inferSelect | null> {
    try {
        // Check Redis cache first
        const cacheKey = getConnectionDetailsCacheKey(connection_id);
        const cachedConnectionDetails = await redis.get(cacheKey) as typeof connection.$inferSelect | null;
        
        // If found in cache, parse and return it
        if (cachedConnectionDetails) {
            console.log(`Connection details found in Redis cache for ID: ${connection_id}`);
            // Parse the cached JSON string back to an object
            // Need to convert string dates back to Date objects
            
            // Convert date strings back to Date objects
            if (cachedConnectionDetails.expiresAt) cachedConnectionDetails.expiresAt = new Date(cachedConnectionDetails.expiresAt);
            if (cachedConnectionDetails.createdAt) cachedConnectionDetails.createdAt = new Date(cachedConnectionDetails.createdAt);
            if (cachedConnectionDetails.lastUpdated) cachedConnectionDetails.lastUpdated = new Date(cachedConnectionDetails.lastUpdated);
            
            return cachedConnectionDetails;
        }
        
        // Not in cache, query the database
        const drizzle = getDb();
        const connectionDetails = await drizzle.select().from(connection).where(eq(connection.connectionId, connection_id)).limit(1);
        
        if (connectionDetails.length === 0) {
            console.error('Connection not found in database');
            return null;
        }
        
        const details = connectionDetails[0];
        
        // Cache the result in Redis (no need to await)
        redis.set(cacheKey, JSON.stringify(details), { ex: CACHE_EXPIRY }).catch(error => {
            console.error('Error caching connection details in Redis:', error);
        });
        
        return details;
    } catch (error) {
        console.error('Error getting connection details from database:', error);
        return null;
    }
}