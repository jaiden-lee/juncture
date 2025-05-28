import { Router } from 'express';
import { getAuthorizationURI, authorizationCallback } from '../../controller/frontend/oauth.controller';


export default function createOAuthRouter() {
    const router = Router();

    router.post('/get-authorization-uri/', getAuthorizationURI);
    router.get('/authorization-callback/:provider', authorizationCallback);


    return router;
}