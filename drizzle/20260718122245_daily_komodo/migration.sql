ALTER TABLE "users" ADD COLUMN "reset_password_token" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_password_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_reset_password_token_uidx" ON "users" ("reset_password_token");--> statement-breakpoint
CREATE INDEX "users_reset_password_expires_at_idx" ON "users" ("reset_password_expires_at") WHERE "reset_password_token" IS NOT NULL;