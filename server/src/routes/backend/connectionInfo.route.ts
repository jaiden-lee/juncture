import { Router } from 'express';
import { checkConnectionValidity, getConnectionCredentials, getAccessToken } from '../../controller/backend/connectionInfo.controller';

/**
 * Creates a router for connection info endpoints
 * @returns Express Router
 */
export default function createConnectionInfoRouter() {
    const router = Router();
    
    // Check if a connection exists and whether it's expired
    router.get('/check-connection-validity', checkConnectionValidity);

    // Get connection credentials
    router.get('/get-connection-credentials', getConnectionCredentials);

    // Get access token
    router.get('/get-access-token', getAccessToken);
    
    return router;
}