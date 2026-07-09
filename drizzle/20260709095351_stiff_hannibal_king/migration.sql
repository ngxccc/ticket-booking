ALTER TABLE "users" ADD COLUMN "verification_token" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending_verification'::"user_status";--> statement-breakpoint
CREATE UNIQUE INDEX "users_verification_token_uidx" ON "users" ("verification_token");--> statement-breakpoint
CREATE INDEX "users_verification_expires_at_idx" ON "users" ("verification_expires_at") WHERE "status" = 'pending_verification';