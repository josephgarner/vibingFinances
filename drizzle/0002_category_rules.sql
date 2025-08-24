BEGIN;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "category_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_book_id" uuid NOT NULL,
  "keyword" text NOT NULL,
  "category" text NOT NULL,
  "sub_category" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "category_rules" 
  ADD CONSTRAINT "category_rules_account_book_id_account_books_id_fk" 
  FOREIGN KEY ("account_book_id") REFERENCES "public"."account_books"("id") 
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_category_rules_account_book_id" ON "category_rules" ("account_book_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_rules_keyword" ON "category_rules" USING gin (to_tsvector('english', "keyword"));--> statement-breakpoint
COMMIT;

