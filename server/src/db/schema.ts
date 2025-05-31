import { pgTable, text, timestamp, primaryKey, pgEnum, uuid } from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["jira"]);



// 1. Connection table
export const connection = pgTable('connection', {
  connectionId: uuid('connection_id').primaryKey(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  lastUpdated: timestamp('last_updated', { mode: 'date' }).notNull().defaultNow(),
});

// 2. ConnectionExternalMap table
export const connectionExternalMap = pgTable('connection_external_map', {
  externalId: text('external_id').notNull(),
  provider: providerEnum('provider').notNull(),
  connectionId: uuid('connection_id').notNull().references(() => connection.connectionId, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.externalId, table.provider] }),
}));

// 3. JiraConnection table
export const jiraConnection = pgTable('jira_connection', {
  connectionId: uuid('connection_id').primaryKey().references(() => connection.connectionId, { onDelete: 'cascade' }),
  selectedJiraProjectId: text('selected_jira_project_id').notNull(),
  jiraSiteId: text('jira_site_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  lastUpdated: timestamp('last_updated', { mode: 'date' }).notNull().defaultNow(),
});
