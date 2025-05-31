// Express.js and Routes
import express, { Request, Response } from 'express';
import oauthRouter from './routes/frontend/oauth.route';
import { isCloudModeEnabled, setCloudContextManager, CloudContextManager } from './utils/CloudContextManager';
import { Pool } from 'pg';
import { initCoreDb } from './db';

export function createJunctureApp(dbPool: Pool, cloudContextManager?: CloudContextManager) {
    const app = express();

    app.use(express.json());
    
    if (isCloudModeEnabled()) {
        if (!cloudContextManager) {
            throw new Error('[Juncture-core] CLOUD_MODE is enabled but no CloudContextManager was registered.');
        }
        if (!dbPool) {
            throw new Error('[Juncture-core] CLOUD_MODE is enabled but no database pool was provided.');
        }
        setCloudContextManager(cloudContextManager);
    }
    initCoreDb(dbPool);

    app.use('/api/oauth', oauthRouter());

    app.get('/', (_req: Request, res: Response) => {
        res.send('Hello World!');
    });
      
    
    return app;
}