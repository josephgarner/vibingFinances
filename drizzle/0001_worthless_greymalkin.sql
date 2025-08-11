BEGIN;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint

-- Drop existing FKs that depend on text types
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_book_id_account_books_id_fk";--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_account_book_id_account_books_id_fk";--> statement-breakpoint

-- Convert primary key columns to uuid with explicit USING casts
ALTER TABLE "account_books" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "account_books" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

ALTER TABLE "accounts" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

ALTER TABLE "transactions" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

-- Convert foreign key columns to uuid with explicit USING casts
ALTER TABLE "accounts" ALTER COLUMN "account_book_id" TYPE uuid USING "account_book_id"::uuid;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "linked_transaction_id" TYPE uuid USING "linked_transaction_id"::uuid;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_id" TYPE uuid USING "account_id"::uuid;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_book_id" TYPE uuid USING "account_book_id"::uuid;--> statement-breakpoint

-- Recreate foreign keys with uuid types
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_account_book_id_account_books_id_fk" FOREIGN KEY ("account_book_id") REFERENCES "public"."account_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_book_id_account_books_id_fk" FOREIGN KEY ("account_book_id") REFERENCES "public"."account_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

COMMIT;