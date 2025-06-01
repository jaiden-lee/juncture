import { Router } from 'express';
import { checkConnectionStatus, getConnectionCredentials } from '../../controller/backend/connectionInfo.controller';

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
    
    return router;
}