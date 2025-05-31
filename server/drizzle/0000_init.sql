CREATE SCHEMA "juncture-core";
--> statement-breakpoint
CREATE TYPE "juncture-core"."provider" AS ENUM('jira');--> statement-breakpoint
CREATE TABLE "juncture-core"."connection" (
	"connection_id" uuid PRIMARY KEY NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "juncture-core"."connection_external_map" (
	"external_id" text NOT NULL,
	"provider" "juncture-core"."provider" NOT NULL,
	"connection_id" uuid NOT NULL,
	CONSTRAINT "connection_external_map_external_id_provider_pk" PRIMARY KEY("external_id","provider")
);
--> statement-breakpoint
CREATE TABLE "juncture-core"."jira_connection" (
	"connection_id" uuid PRIMARY KEY NOT NULL,
	"selected_jira_project_id" text NOT NULL,
	"jira_site_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "juncture-core"."connection_external_map" ADD CONSTRAINT "connection_external_map_connection_id_connection_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "juncture-core"."connection"("connection_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "juncture-core"."jira_connection" ADD CONSTRAINT "jira_connection_connection_id_connection_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "juncture-core"."connection"("connection_id") ON DELETE cascade ON UPDATE no action;