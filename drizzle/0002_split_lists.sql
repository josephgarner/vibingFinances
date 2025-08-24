CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint

CREATE TABLE "split_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "account_book_id" uuid NOT NULL,
  "data" jsonb NOT NULL DEFAULT '{"items":[]}'::jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "split_lists" ADD CONSTRAINT "split_lists_account_book_id_account_books_id_fk" FOREIGN KEY ("account_book_id") REFERENCES "public"."account_books"("id") ON DELETE cascade ON UPDATE no action;


