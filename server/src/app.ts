// Express.js and Routes
import express, { Request, Response } from 'express';
import oauthRouter from './routes/frontend/oauth.route';
import { isCloudModeEnabled, setCloudContextManager, CloudContextManager } from './utils/CloudContextManager';

export function createJunctureApp(cloudContextManager?: CloudContextManager) {
    const app = express();

    app.use(express.json());
    
    if (isCloudModeEnabled()) {
        if (!cloudContextManager) {
            throw new Error('[Juncture-core] CLOUD_MODE is enabled but no CloudContextManager was registered.');
        }
        setCloudContextManager(cloudContextManager);
    }

    app.use('/api/oauth', oauthRouter());

    app.get('/', (_req: Request, res: Response) => {
        res.send('Hello World!');
    });

    return app;
}