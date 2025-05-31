import { Request, Response } from 'express';
import { providerEnumType } from '../../db/schema';
import { getConnectionIDFromSecretKey } from '../../utils/secret_key_helpers';
import { getDb } from '../../db';
import { eq } from 'drizzle-orm';
import { connection } from '../../db/schema';

type CheckConnectionStatusBody = {
  external_id: string;
  provider: providerEnumType;
}

type CheckConnectionStatusResponse = {
    exists: boolean;
    isExpired: boolean;
    expiresAt?: Date;
} | {
    error: string;
}

/**
 * Tells the backend if a connection exists and whether or not it is expired
 * @param req.body.external_id - The external ID of the connection
 * @param req.body.provider - The provider (e.g., 'jira')
 * @param req.headers.authorization - Bearer token containing the juncture_secret_key
 */
export async function checkConnectionStatus(req: Request<{}, {}, CheckConnectionStatusBody>, res: Response<CheckConnectionStatusResponse>) {
    const { external_id, provider } = req.body;
    
    const { connectionId, error } = await getConnectionIDFromSecretKey(req, external_id, provider);
    if (!connectionId) {
        res.status(401).json({ error: error! });
        return;
    }

    const drizzle = getDb();
    const connectionDetails = await drizzle.select().from(connection).where(eq(connection.connectionId, connectionId)).limit(1);
    if (connectionDetails.length === 0) {
        res.status(200).json({ 
            exists: false, 
            isExpired: false 
        });
        return;
    }

    const connectionDetail = connectionDetails[0];
    const isExpired = connectionDetail.expiresAt < new Date();
    res.status(200).json(
        {
            exists: true,
            isExpired: isExpired,
            expiresAt: connectionDetail.expiresAt
        }
    );
    return;
}