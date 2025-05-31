CREATE TABLE "connection" (
	"connection_id" serial PRIMARY KEY NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connection_external_map" (
	"external_id" text NOT NULL,
	"provider" text NOT NULL,
	"connection_id" serial NOT NULL,
	CONSTRAINT "connection_external_map_external_id_provider_pk" PRIMARY KEY("external_id","provider")
);
--> statement-breakpoint
CREATE TABLE "jira_connection" (
	"connection_id" serial PRIMARY KEY NOT NULL,
	"selected_jira_project_id" text NOT NULL,
	"jira_site_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connection_external_map" ADD CONSTRAINT "connection_external_map_connection_id_connection_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("connection_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jira_connection" ADD CONSTRAINT "jira_connection_connection_id_connection_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("connection_id") ON DELETE cascade ON UPDATE no action;