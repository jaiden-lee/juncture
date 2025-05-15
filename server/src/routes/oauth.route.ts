import { Router } from 'express';
import * as oauthController from '../controller/oauth.controller';

const router = Router();

/** 
 * @route POST /api/oauth/get-authorization-uri/
 * @description Get authorization URI for a specific provider
 * @param {string} provider - The provider to get the authorization URI for
 * @returns {string} The authorization URI
 */
router.post('/get-authorization-uri/', oauthController.getAuthorizationURI);


export default router;