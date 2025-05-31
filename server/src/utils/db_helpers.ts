import { getDb } from "../db";
import { connection, connectionExternalMap } from "../db/schema";
import { PostgresError } from "postgres";

// Juncture-core uses to add to db. Juncture-cloud extends this function in its own CloudContextManager interface by using it in a sql transaction
export async function addConnectionToDB(connection_id: string, external_id: string, refresh_token: string, expires_at: Date): Promise<boolean> {
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
                provider: 'jira',
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