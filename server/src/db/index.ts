// db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

import { NodePgDatabase } from 'drizzle-orm/node-postgres';

let db: NodePgDatabase<typeof schema> | null = null;

export function initCoreDb(pool: Pool) {
  db = drizzle(pool, { schema });
}

export function getDb() {
  if (!db) {
    throw new Error('DB not initialized. Did you forget to call initCoreDb()?');
  }
  return db;
}