import { eq, and, gte, lte, lt } from "drizzle-orm";
import { db } from "../db";
import {
  accountBooks,
  accounts,
  transactions,
  categoryRules,
} from "../db/schema";
import type { QIFTransaction } from "./qifParser";

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
  historicalBalance: {
    month: string;
    debits: number;
    credits: number;
    balance?: number;
  }[];
}

export interface DatabaseAccountBook {
  id: string;
  name: string;
  updatedAt: string;
}

export interface DatabaseCategoryRule {
  id: string;
  accountBookId: string;
  keyword: string;
  category: string;
  subCategory: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveTransactions(
  qifTransactions: QIFTransaction[],
  accountId: string,
  accountBookId: string
): Promise<DatabaseTransaction[]> {
  const savedTransactions: DatabaseTransaction[] = [];
  // Apply category rules before saving
  const rules = await getCategoryRules(accountBookId);
  const normalizedRules = rules.map((r) => ({
    ...r,
    keywordLc: r.keyword.toLowerCase(),
  }));

  for (const qifTransaction of qifTransactions) {
    // If uncategorized, try to apply first matching rule by keyword substring on description
    const isUncategorized =
      !qifTransaction.category ||
      qifTransaction.category.toLowerCase() === "uncategorized";
    if (isUncategorized) {
      const descLc = (qifTransaction.description || "").toLowerCase();
      const match = normalizedRules.find((r) => descLc.includes(r.keywordLc));
      if (match) {
        qifTransaction.category = match.category;
        qifTransaction.subCategory = match.subCategory || "";
      }
    }
    const [transaction] = await db
      .insert(transactions)
      .values({
        transactionDate: new Date(qifTransaction.transactionDate),
        description: qifTransaction.description,
        category: qifTransaction.category,
        subCategory: qifTransaction.subCategory,
        debitAmount: qifTransaction.debitAmount.toString(),
        creditAmount: qifTransaction.creditAmount.toString(),
        linkedTransactionId: qifTransaction.linkedTransactionId
          ? qifTransaction.linkedTransactionId
          : null,
        accountId,
        accountBookId,
      })
      .returning();

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
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
  });
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
    .map(([month, totals]) => ({
      month,
      debits: totals.debits,
      credits: totals.credits,
    }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  let runningBalance = 0;
  const historicalBalance = monthly.map((m) => {
    runningBalance += m.credits - m.debits;
    return { ...m, balance: runningBalance };
  });

  // End-of-month running balance snapshot for current month (previous balance + this month's net)
  const currentMonthEntry = historicalBalance.find(
    (h) => h.month === currentMonth
  );
  const totalMonthlyBalance = currentMonthEntry
    ? currentMonthEntry.balance ??
      currentMonthEntry.credits - currentMonthEntry.debits
    : 0;

  await db
    .update(accounts)
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

  return transactionList.map((transaction) => ({
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

export async function getDistinctCategories(
  accountBookId: string
): Promise<string[]> {
  const list = await db.query.transactions.findMany({
    where: eq(transactions.accountBookId, accountBookId),
    orderBy: transactions.category,
  });
  const set = new Set<string>();
  for (const t of list) {
    if (t.category && t.category.trim().length > 0) set.add(t.category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function updateTransactionsCategory(
  transactionIds: string[],
  category: string,
  subCategory: string
): Promise<number> {
  let updated = 0;
  for (const id of transactionIds) {
    await db
      .update(transactions)
      .set({ category, subCategory, updatedAt: new Date() })
      .where(eq(transactions.id, id));
    // drizzle doesn't return affected rows count here; approximate
    updated += 1;
  }
  return updated;
}

export async function getCategoryRules(
  accountBookId: string
): Promise<DatabaseCategoryRule[]> {
  const rules = await db.query.categoryRules.findMany({
    where: eq(categoryRules.accountBookId, accountBookId),
    orderBy: categoryRules.createdAt,
  });
  return rules.map((r) => ({
    id: r.id,
    accountBookId: r.accountBookId,
    keyword: r.keyword,
    category: r.category,
    subCategory: r.subCategory,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createCategoryRule(
  accountBookId: string,
  keyword: string,
  category: string,
  subCategory: string
): Promise<DatabaseCategoryRule> {
  const [rule] = await db
    .insert(categoryRules)
    .values({
      accountBookId,
      keyword,
      category,
      subCategory,
    })
    .returning();
  return {
    id: rule.id,
    accountBookId: rule.accountBookId,
    keyword: rule.keyword,
    category: rule.category,
    subCategory: rule.subCategory,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function applyRulesToUncategorized(
  accountBookId: string
): Promise<number> {
  const rules = await getCategoryRules(accountBookId);
  if (rules.length === 0) return 0;
  const normalized = rules.map((r) => ({
    ...r,
    keywordLc: r.keyword.toLowerCase(),
  }));
  const list = await db.query.transactions.findMany({
    where: eq(transactions.accountBookId, accountBookId),
    orderBy: transactions.transactionDate,
  });
  let count = 0;
  for (const t of list) {
    const isUncategorized =
      !t.category || t.category.toLowerCase() === "uncategorized";
    if (!isUncategorized) continue;
    const descLc = (t.description || "").toLowerCase();
    const match = normalized.find((r) => descLc.includes(r.keywordLc));
    if (match) {
      await db
        .update(transactions)
        .set({
          category: match.category,
          subCategory: match.subCategory,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, t.id));
      count += 1;
    }
  }
  return count;
}

export async function clearAccountLastMonthData(
  accountId: string
): Promise<void> {
  const now = new Date();
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

export async function clearAccountMonthData(
  accountId: string,
  monthYYYYMM: string
): Promise<void> {
  // monthYYYYMM like '2025-03'
  const [yearStr, monthStr] = monthYYYYMM.split("-");
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

export async function getAccountsByAccountBook(
  accountBookId: string
): Promise<DatabaseAccount[]> {
  const accountList = await db.query.accounts.findMany({
    where: eq(accounts.accountBookId, accountBookId),
  });

  return accountList.map((account) => ({
    id: account.id,
    name: account.name,
    totalMonthlyBalance: parseFloat(account.totalMonthlyBalance),
    totalMonthlyDebits: parseFloat(account.totalMonthlyDebits),
    totalMonthlyCredits: parseFloat(account.totalMonthlyCredits),
    updatedAt: account.updatedAt.toISOString(),
    accountBookId: account.accountBookId,
    historicalBalance: (
      (account.historicalBalance as unknown as {
        month: string;
        debits: number;
        credits: number;
        balance?: number;
      }[]) || []
    ).map((h) => ({
      month: h.month,
      debits: h.debits,
      credits: h.credits,
      balance: h.balance,
    })),
  }));
}

export async function getAccountBooks(): Promise<DatabaseAccountBook[]> {
  const accountBookList = await db.query.accountBooks.findMany({
    orderBy: accountBooks.updatedAt,
  });

  return accountBookList.map((accountBook) => ({
    id: accountBook.id,
    name: accountBook.name,
    updatedAt: accountBook.updatedAt.toISOString(),
  }));
}

export async function createAccountBook(
  name: string
): Promise<DatabaseAccountBook> {
  const [accountBook] = await db
    .insert(accountBooks)
    .values({
      name,
    })
    .returning();

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

  const [account] = await db
    .insert(accounts)
    .values({
      name,
      totalMonthlyBalance: totalMonthlyBalance.toString(),
      totalMonthlyDebits: totalMonthlyDebits.toString(),
      totalMonthlyCredits: totalMonthlyCredits.toString(),
      accountBookId,
      historicalBalance: [
        {
          month: currentMonth,
          debits: totalMonthlyDebits,
          credits: totalMonthlyCredits,
        },
      ],
    })
    .returning();

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

export async function getAccountBook(
  id: string
): Promise<DatabaseAccountBook | null> {
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
