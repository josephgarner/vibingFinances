import { pgTable, text, timestamp, integer, decimal, jsonb, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const accountBooks = pgTable('account_books', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  totalMonthlyBalance: decimal('total_monthly_balance', { precision: 10, scale: 2 }).notNull().default('0'),
  totalMonthlyDebits: decimal('total_monthly_debits', { precision: 10, scale: 2 }).notNull().default('0'),
  totalMonthlyCredits: decimal('total_monthly_credits', { precision: 10, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  accountBookId: uuid('account_book_id').notNull().references(() => accountBooks.id, { onDelete: 'cascade' }),
  historicalBalance: jsonb('historical_balance').$type<{ month: string; debits: number; credits: number; balance?: number }[]>().notNull().default([]),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionDate: timestamp('transaction_date').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  subCategory: text('sub_category').notNull(),
  debitAmount: decimal('debit_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  creditAmount: decimal('credit_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  linkedTransactionId: uuid('linked_transaction_id'),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  accountBookId: uuid('account_book_id').notNull().references(() => accountBooks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const accountBooksRelations = relations(accountBooks, ({ many }) => ({
  accounts: many(accounts),
  transactions: many(transactions),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  accountBook: one(accountBooks, {
    fields: [accounts.accountBookId],
    references: [accountBooks.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  accountBook: one(accountBooks, {
    fields: [transactions.accountBookId],
    references: [accountBooks.id],
  }),
})); 