import { Request, Response } from 'express';
import redis from '../utils/redis';
import crypto from 'crypto';

type GetAuthorizationURIBody = {
    provider: string;
    client_id?: string; // can directly provide or get from dashboard
    redirect_uri?: string;
    scopes?: string[]; 
}

export async function getAuthorizationURI(req: Request<{}, {}, GetAuthorizationURIBody>, res: Response): Promise<void> {
    const { provider, client_id, redirect_uri, scopes } = req.body;

    // TEMPORARY UNTIL ADD DASHBOARD
    if (!client_id || !redirect_uri || !scopes) {
        res.status(400).json({ error: 'Client ID, redirect URI, and scopes are required' });
        return;
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
        authorizationUri = `https://auth.atlassian.com/authorize?`+
            `audience=api.atlassian.com&`+
            `client_id=${client_id}&`+
            `scope=${scopes.join('%20')}&`+
            `redirect_uri=${redirect_uri}&`+
            `state=${state}&`+
            `response_type=code&`+
            `prompt=consent`;
    }
    else {
        res.status(400).json({ error: 'Invalid provider' });
        return;
    }
    res.status(200).json({ authorizationUri });
    return;
}