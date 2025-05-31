CREATE TYPE "public"."provider" AS ENUM('jira');--> statement-breakpoint
ALTER TABLE "connection" ALTER COLUMN "connection_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "connection_external_map" ALTER COLUMN "provider" SET DATA TYPE "public"."provider" USING "provider"::"public"."provider";--> statement-breakpoint
ALTER TABLE "connection_external_map" ALTER COLUMN "connection_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "jira_connection" ALTER COLUMN "connection_id" SET DATA TYPE uuid;