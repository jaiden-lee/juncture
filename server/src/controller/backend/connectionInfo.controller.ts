import { Request, Response } from 'express';
import { providerEnumType, providerEnum } from '../../db/schema';
import { getConnectionIDFromSecretKey } from '../../utils/secret_key_helpers';
import { getConnectionDetails } from '../../utils/connection_db_helpers';

type CheckConnectionStatusBody = {
  external_id: string;
  provider: providerEnumType;
}

type CheckConnectionStatusResponse = {
    exists: boolean;
    isInvalid: boolean;
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

    if (!providerEnum.enumValues.includes(provider)) {
        res.status(400).json({ error: 'Invalid provider. Ensure that all provider names are lowercase.' });
        return;
    }

    
    const { connectionId, error } = await getConnectionIDFromSecretKey(req, external_id, provider);
    if (!connectionId) {
        res.status(401).json({ error: error! });
        return;
    }

    const connectionDetails = await getConnectionDetails(connectionId);
    if (!connectionDetails) {
        res.status(200).json({ 
            exists: false, 
            isInvalid: false 
        });
        return;
    }

    const invalidRefreshToken = connectionDetails.invalidRefreshToken;
    const isInvalidated = connectionDetails.expiresAt < new Date() || invalidRefreshToken;
    res.status(200).json(
        {
            exists: true,
            isInvalid: isInvalidated,
            expiresAt: connectionDetails.expiresAt
        }
    );
    return;
}



type GetConnectionCredentialsBody = {
    external_id: string;
    provider: providerEnumType;
}

type GetConnectionCredentialsResponse = {
    refreshToken: string;
    expiresAt: Date;
    isInvalid: boolean;
} | {
    error: string;
}

/**
 * Use this method to retrieve the actual refresh token, as well as expiry information. This method does not retrieve the access token.
 * You are discouraged from using this method since Juncture also manages the refresh token and access token, and thus if you manage the refresh token yourself, you may run into conflicts.
 * Rather, it is preferred to fetch the access_token from Juncture instead, and let Juncture manage the refresh token logic.
 * @param req.body.external_id - The external ID of the connection
 * @param req.body.provider - The provider (e.g., 'jira')
 * @param req.headers.authorization - Bearer token containing the juncture_secret_key
 */
export async function getConnectionCredentials(req: Request<{}, {}, GetConnectionCredentialsBody>, res: Response<GetConnectionCredentialsResponse>) {
    const {external_id, provider} = req.body;

    if (!providerEnum.enumValues.includes(provider)) {
        res.status(400).json({ error: 'Invalid provider. Ensure that all provider names are lowercase.' });
        return;
    }

    const { connectionId, error } = await getConnectionIDFromSecretKey(req, external_id, provider);
    if (!connectionId) {
        res.status(401).json({ error: error! });
        return;
    }

    const connectionDetails = await getConnectionDetails(connectionId);
    if (!connectionDetails) {
        res.status(404).json({ error: 'Connection not found' });
        return;
    }

    const connectionDetail = connectionDetails;
    const refreshToken = connectionDetail.refreshToken;
    const expiresAt = connectionDetail.expiresAt;
    const isInvalid = connectionDetail.invalidRefreshToken;
    res.status(200).json({
        refreshToken,
        expiresAt,
        isInvalid
    });
    return;
}