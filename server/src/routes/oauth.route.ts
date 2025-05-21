import { Router } from 'express';
import { CredentialStore } from '../utils/types';
import createOAuthController from '../controller/oauth.controller';


export default function createOAuthRouter(credentialStore?: CredentialStore) {
    const router = Router();
    const oauthController = createOAuthController(credentialStore);

    router.post('/get-authorization-uri/', oauthController.getAuthorizationURI);
    router.get('/authorization-callback/', oauthController.authorizationCallback);


    return router;
}