import { Router } from 'express';
import { checkConnectionStatus, getConnectionCredentials, getAccessToken } from '../../controller/backend/connectionInfo.controller';

/**
 * Creates a router for connection info endpoints
 * @returns Express Router
 */
export default function createConnectionInfoRouter() {
    const router = Router();
    
    // POST /api/backend/check-connection-status - Check if a connection exists and whether it's expired
    router.post('/check-connection-status', checkConnectionStatus);

    // POST /api/backend/get-connection-credentials - Get connection credentials
    router.post('/get-connection-credentials', getConnectionCredentials);

    // POST /api/backend/get-access-token - Get access token
    router.post('/get-access-token', getAccessToken);
    
    return router;
}