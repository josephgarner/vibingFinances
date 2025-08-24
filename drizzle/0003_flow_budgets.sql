CREATE TABLE "flow_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "account_book_id" uuid NOT NULL,
  "income_account_id" uuid,
  "income_amount" numeric(12,2) NOT NULL DEFAULT '0',
  "rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "flow_budgets" ADD CONSTRAINT "flow_budgets_account_book_id_account_books_id_fk" FOREIGN KEY ("account_book_id") REFERENCES "public"."account_books"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "flow_budgets" ADD CONSTRAINT "flow_budgets_income_account_id_accounts_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;



