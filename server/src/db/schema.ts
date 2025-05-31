import { text, timestamp, primaryKey, uuid } from "drizzle-orm/pg-core";
import { pgSchema } from "drizzle-orm/pg-core"

export const junctureCoreSchema = pgSchema('juncture-core');

export const providerEnum = junctureCoreSchema.enum("provider", ["jira"]);



// 1. Connection table
export const connection = junctureCoreSchema.table('connection', {
  connectionId: uuid('connection_id').primaryKey(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  lastUpdated: timestamp('last_updated', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});

// 2. ConnectionExternalMap table
export const connectionExternalMap = junctureCoreSchema.table('connection_external_map', {
  externalId: text('external_id').notNull(),
  provider: providerEnum('provider').notNull(),
  connectionId: uuid('connection_id').notNull().references(() => connection.connectionId, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.externalId, table.provider] }),
}));

// 3. JiraConnection table
export const jiraConnection = junctureCoreSchema.table('jira_connection', {
  connectionId: uuid('connection_id').primaryKey().references(() => connection.connectionId, { onDelete: 'cascade' }),
  selectedJiraProjectId: text('selected_jira_project_id').notNull(),
  jiraSiteId: text('jira_site_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  lastUpdated: timestamp('last_updated', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});
