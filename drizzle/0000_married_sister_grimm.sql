CREATE TABLE "account_books" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"total_monthly_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_monthly_debits" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_monthly_credits" numeric(10, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"account_book_id" text NOT NULL,
	"historical_balance" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"sub_category" text NOT NULL,
	"debit_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"linked_transaction_id" text,
	"account_id" text NOT NULL,
	"account_book_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_account_book_id_account_books_id_fk" FOREIGN KEY ("account_book_id") REFERENCES "public"."account_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_book_id_account_books_id_fk" FOREIGN KEY ("account_book_id") REFERENCES "public"."account_books"("id") ON DELETE cascade ON UPDATE no action;