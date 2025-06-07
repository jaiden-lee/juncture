// Express.js and Routes
import express, { Request, Response } from 'express';
import oauthRouter from './routes/frontend/oauth.route';
import connectionInfoRouter from './routes/backend/connectionInfo.route';
import { isCloudModeEnabled, setCloudContextManager, CloudContextManager } from './utils/CloudContextManager';
import { Pool } from 'pg';
import { initCoreDb } from './db';
import jiraRouter from './routes/backend/jira.route';
import finalizeJiraConnectionRouter from './routes/frontend/finalizeJiraConnection.route';
import cors from 'cors';

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

    // Middleware
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
    app.use(cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (e.g., curl or mobile apps)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
              return callback(null, true);
            } else {
              return callback(new Error('Not allowed by CORS'));
            }
          },
          credentials: true // if you're using cookies or authorization headers
    }));

    // Frontend API Routes
    app.use('/api/frontend/oauth', oauthRouter());
    app.use('/api/frontend/finalize-connection/jira', finalizeJiraConnectionRouter());

    // Backend API Routes
    app.use('/api/backend/connection-info', connectionInfoRouter());
    app.use('/api/backend/integration-helpers/jira', jiraRouter());

    app.get('/', (_req: Request, res: Response) => {
        res.send('Hello World!');
    });
      
    
    return app;
}