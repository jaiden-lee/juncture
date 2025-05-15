// src/index.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
// Configure dotenv with the path to the .env file at the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import oauthRouter from './routes/oauth.route';



const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use('/api/oauth', oauthRouter);

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from TypeScript Express!');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
