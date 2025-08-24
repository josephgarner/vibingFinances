BEGIN;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_account_month" ON "transactions" ("account_id", "transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_book" ON "transactions" ("account_book_id");--> statement-breakpoint
COMMIT;

