// Set Up Environment Variables
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Juncture App
import { createJunctureApp } from './app';
import { Pool } from 'pg';

const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL!
});

const app = createJunctureApp(dbPool);
const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


const shutdown = async () => {
  console.log('[Juncture] Shutting down database pool...');
  try {
      await dbPool.end();
      console.log('[Juncture] Pool closed. Exiting.');
      server.close();
  } catch (err) {
      console.error('[Juncture] Error while closing pool:', err);
  }
  process.exit(0);
};


process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);