import { eq, and, gte, lte, lt } from 'drizzle-orm';
import { db } from '../db';
import { accountBooks, accounts, transactions } from '../db/schema';
import type { QIFTransaction } from './qifParser';

export interface DatabaseTransaction {
  id: string;
  transactionDate: string;
  description: string;
  category: string;
  subCategory: string;
  debitAmount: number;
  creditAmount: number;
  linkedTransactionId?: string;
  accountId: string;
  accountBookId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseAccount {
  id: string;
  name: string;
  totalMonthlyBalance: number;
  totalMonthlyDebits: number;
  totalMonthlyCredits: number;
  updatedAt: string;
  accountBookId: string;
  historicalBalance: { month: string; debits: number; credits: number }[];
}

export interface DatabaseAccountBook {
  id: string;
  name: string;
  updatedAt: string;
}

export async function saveTransactions(
  qifTransactions: QIFTransaction[], 
  accountId: string, 
  accountBookId: string
): Promise<DatabaseTransaction[]> {
  const savedTransactions: DatabaseTransaction[] = [];
  
  for (const qifTransaction of qifTransactions) {
    const [transaction] = await db.insert(transactions).values({
      transactionDate: new Date(qifTransaction.transactionDate),
      description: qifTransaction.description,
      category: qifTransaction.category,
      subCategory: qifTransaction.subCategory,
      debitAmount: qifTransaction.debitAmount.toString(),
      creditAmount: qifTransaction.creditAmount.toString(),
      linkedTransactionId: qifTransaction.linkedTransactionId ? qifTransaction.linkedTransactionId : null,
      accountId,
      accountBookId,
    }).returning();

    savedTransactions.push({
      id: transaction.id,
      transactionDate: transaction.transactionDate.toISOString(),
      description: transaction.description,
      category: transaction.category,
      subCategory: transaction.subCategory,
      debitAmount: parseFloat(transaction.debitAmount),
      creditAmount: parseFloat(transaction.creditAmount),
      linkedTransactionId: transaction.linkedTransactionId || undefined,
      accountId: transaction.accountId,
      accountBookId: transaction.accountBookId,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    });
  }

  // Update account totals
  await updateAccountTotals(accountId);
  
  return savedTransactions;
}

export async function updateAccountTotals(accountId: string): Promise<void> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!account) return;

  // Fetch all transactions for this account and group by month (YYYY-MM)
  const allTransactions = await db.query.transactions.findMany({
    where: eq(transactions.accountId, accountId),
    orderBy: transactions.transactionDate,
  });

  const monthToTotals = new Map<string, { debits: number; credits: number }>();
  for (const t of allTransactions) {
    const monthKey = t.transactionDate.toISOString().slice(0, 7);
    const entry = monthToTotals.get(monthKey) || { debits: 0, credits: 0 };
    entry.debits += parseFloat(t.debitAmount);
    entry.credits += parseFloat(t.creditAmount);
    monthToTotals.set(monthKey, entry);
  }

  // Current month totals
  const currentMonth = new Date().toISOString().slice(0, 7);
  const current = monthToTotals.get(currentMonth) || { debits: 0, credits: 0 };
  const totalMonthlyDebits = current.debits;
  const totalMonthlyCredits = current.credits;

  // Historical balances for all months with running balance snapshot
  const monthly = Array.from(monthToTotals.entries())
    .map(([month, totals]) => ({ month, debits: totals.debits, credits: totals.credits }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  let runningBalance = 0;
  const historicalBalance = monthly.map((m) => {
    runningBalance += m.credits - m.debits;
    return { ...m, balance: runningBalance };
  });

  // End-of-month running balance snapshot for current month (previous balance + this month's net)
  const currentMonthEntry = historicalBalance.find((h) => h.month === currentMonth);
  const totalMonthlyBalance = currentMonthEntry ? currentMonthEntry.balance ?? (currentMonthEntry.credits - currentMonthEntry.debits) : 0;

  await db.update(accounts)
    .set({
      totalMonthlyBalance: totalMonthlyBalance.toString(),
      totalMonthlyDebits: totalMonthlyDebits.toString(),
      totalMonthlyCredits: totalMonthlyCredits.toString(),
      updatedAt: new Date(),
      historicalBalance,
    })
    .where(eq(accounts.id, accountId));
}

export async function getTransactionsByAccountAndMonth(
  accountId: string, 
  month: Date
): Promise<DatabaseTransaction[]> {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  const transactionList = await db.query.transactions.findMany({
    where: and(
      eq(transactions.accountId, accountId),
      gte(transactions.transactionDate, monthStart),
      lte(transactions.transactionDate, monthEnd)
    ),
    orderBy: transactions.transactionDate,
  });

  return transactionList.map(transaction => ({
    id: transaction.id,
    transactionDate: transaction.transactionDate.toISOString(),
    description: transaction.description,
    category: transaction.category,
    subCategory: transaction.subCategory,
    debitAmount: parseFloat(transaction.debitAmount),
    creditAmount: parseFloat(transaction.creditAmount),
    linkedTransactionId: transaction.linkedTransactionId || undefined,
    accountId: transaction.accountId,
    accountBookId: transaction.accountBookId,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  }));
}

export async function clearAccountLastMonthData(accountId: string): Promise<void> {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        gte(transactions.transactionDate, startOfLastMonth),
        lte(transactions.transactionDate, endOfLastMonth)
      )
    );

  await updateAccountTotals(accountId);
}

export async function clearAccountAllData(accountId: string): Promise<void> {
  await db.delete(transactions).where(eq(transactions.accountId, accountId));
  await updateAccountTotals(accountId);
}

export async function deleteAccount(accountId: string): Promise<void> {
  // Transactions have ON DELETE CASCADE, so removing account cleans dependent rows
  await db.delete(accounts).where(eq(accounts.id, accountId));
}

export async function clearAccountMonthData(accountId: string, monthYYYYMM: string): Promise<void> {
  // monthYYYYMM like '2025-03'
  const [yearStr, monthStr] = monthYYYYMM.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr) - 1; // JS month 0-based
  const start = new Date(y, m, 1);
  const nextMonth = new Date(y, m + 1, 1);

  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        gte(transactions.transactionDate, start),
        lt(transactions.transactionDate, nextMonth)
      )
    );

  await updateAccountTotals(accountId);
}

export async function getAccountsByAccountBook(accountBookId: string): Promise<DatabaseAccount[]> {
  const accountList = await db.query.accounts.findMany({
    where: eq(accounts.accountBookId, accountBookId),
  });

  return accountList.map(account => ({
    id: account.id,
    name: account.name,
    totalMonthlyBalance: parseFloat(account.totalMonthlyBalance),
    totalMonthlyDebits: parseFloat(account.totalMonthlyDebits),
    totalMonthlyCredits: parseFloat(account.totalMonthlyCredits),
    updatedAt: account.updatedAt.toISOString(),
    accountBookId: account.accountBookId,
    historicalBalance: (account.historicalBalance as any) || [],
  }));
}

export async function getAccountBooks(): Promise<DatabaseAccountBook[]> {
  const accountBookList = await db.query.accountBooks.findMany({
    orderBy: accountBooks.updatedAt,
  });

  return accountBookList.map(accountBook => ({
    id: accountBook.id,
    name: accountBook.name,
    updatedAt: accountBook.updatedAt.toISOString(),
  }));
}

export async function createAccountBook(name: string): Promise<DatabaseAccountBook> {
  const [accountBook] = await db.insert(accountBooks).values({
    name,
  }).returning();

  return {
    id: accountBook.id,
    name: accountBook.name,
    updatedAt: accountBook.updatedAt.toISOString(),
  };
}

export async function createAccount(
  name: string,
  totalMonthlyBalance: number,
  totalMonthlyDebits: number,
  totalMonthlyCredits: number,
  accountBookId: string
): Promise<DatabaseAccount> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const [account] = await db.insert(accounts).values({
    name,
    totalMonthlyBalance: totalMonthlyBalance.toString(),
    totalMonthlyDebits: totalMonthlyDebits.toString(),
    totalMonthlyCredits: totalMonthlyCredits.toString(),
    accountBookId,
    historicalBalance: [
      { month: currentMonth, debits: totalMonthlyDebits, credits: totalMonthlyCredits }
    ],
  }).returning();

  return {
    id: account.id,
    name: account.name,
    totalMonthlyBalance: parseFloat(account.totalMonthlyBalance),
    totalMonthlyDebits: parseFloat(account.totalMonthlyDebits),
    totalMonthlyCredits: parseFloat(account.totalMonthlyCredits),
    updatedAt: account.updatedAt.toISOString(),
    accountBookId: account.accountBookId,
    historicalBalance: account.historicalBalance || [],
  };
}

export async function getAccountBook(id: string): Promise<DatabaseAccountBook | null> {
  const accountBook = await db.query.accountBooks.findFirst({
    where: eq(accountBooks.id, id),
  });

  if (!accountBook) return null;

  return {
    id: accountBook.id,
    name: accountBook.name,
    updatedAt: accountBook.updatedAt.toISOString(),
  };
} 