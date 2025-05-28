
// Juncture-core uses to add to db. Juncture-cloud extends this function in its own CloudContextManager interface by using it in a sql transaction
export async function addConnectionToDB(connection_id: string, refresh_token: string, expires_at: number, created_at: number, last_updated: number) {
    
}