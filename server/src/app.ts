// Express.js and Routes
import express, { Request, Response } from 'express';
import oauthRouter from './routes/oauth.route';
import { CredentialStore } from './utils/types';

export function createJunctureApp(credentialStore?: CredentialStore) {
    const app = express();

    app.use(express.json());
    app.use('/api/oauth', oauthRouter(credentialStore));

    app.get('/', (_req: Request, res: Response) => {
        res.send('Hello World!');
    });

    return app;
}