import { Request, Response } from 'express';
import redis from '../utils/redis';
import crypto from 'crypto';
import { CredentialStore } from '../utils/types';

type GetAuthorizationURIBody = {
    provider: string;
    client_id?: string; // can directly provide or get from dashboard
    redirect_uri?: string;
    scopes?: string[];
}

export default function createOAuthController(credentialStore?: CredentialStore) {

    async function getAuthorizationURI(req: Request<{}, {}, GetAuthorizationURIBody>, res: Response): Promise<void> {
        let { provider, client_id, redirect_uri, scopes } = req.body;

        if (credentialStore) {
            const credentials = await credentialStore.get(provider, client_id!);
            if (!credentials) {
                res.status(400).json({ error: 'Invalid client ID' });
                return;
            }
            client_id = credentials.providerClientID;
            redirect_uri = credentials.redirectURI;
            scopes = credentials.scopes;
        } else {
            // If credentials not specified, use default values (for Juncture, testing only; if self-host, can just use own credentials here)
            if (!redirect_uri) {
                redirect_uri = process.env.DEFAULT_JIRA_REDIRECT_URI!;
            }
            if (!client_id) {
                client_id = process.env.DEFAULT_JIRA_CLIENT_ID!;
            }
            if (!scopes) {
                scopes = process.env.DEFAULT_JIRA_SCOPES!.split(',');
            }
        }


        // Generate state params
        const state = crypto.randomUUID();

        // Store state in redis
        redis.set(state, '1', {
            ex: 600 // 10 minutes
        });


        // Generate authorization URI
        let authorizationUri = '';
        if (provider === 'jira') {
            scopes.push('offline_access'); // refresh_token
            authorizationUri = `https://auth.atlassian.com/authorize?` +
                `audience=api.atlassian.com&` +
                `client_id=${client_id}&` +
                `scope=${scopes.join('%20')}&` +
                `redirect_uri=${redirect_uri}&` +
                `state=${state}&` +
                `response_type=code&` +
                `prompt=consent`;
        }
        else {
            res.status(400).json({ error: 'Invalid provider' });
            return;
        }
        res.status(200).json({ authorizationUri });
        return;
    }


    async function authorizationCallback(req: Request, res: Response): Promise<void> {

    }




    return {
        getAuthorizationURI,
        authorizationCallback,
    };
}



