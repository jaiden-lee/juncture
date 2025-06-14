import { Router } from 'express';
import { initiateOAuthFlow, authorizationCallback } from '../../controller/frontend/oauth.controller';


export default function createOAuthRouter() {
    const router = Router();

    router.post('/initiate-oauth-flow', initiateOAuthFlow);
    router.get('/authorization-callback/:provider', authorizationCallback);


    return router;
}