CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"phone_number" varchar(20),
	"avatar_url" text,
	"password_hash" text,
	"refresh_token_hash" text,
	"google_id" varchar(255) UNIQUE,
	"facebook_id" varchar(255) UNIQUE,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL
);
