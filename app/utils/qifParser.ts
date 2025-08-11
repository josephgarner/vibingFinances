export interface QIFTransaction {
  transactionDate: string;
  description: string;
  category: string;
  subCategory: string;
  debitAmount: number;
  creditAmount: number;
  linkedTransactionId?: string;
}

export interface QIFAccount {
  name: string;
  transactions: QIFTransaction[];
}

export function parseQIFContent(content: string): QIFTransaction[] {
  const transactions: QIFTransaction[] = [];
  const lines = content.split('\n');
  let currentTransaction: Partial<QIFTransaction> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('!Type:')) {
      // New account type, reset current transaction
      currentTransaction = {};
      continue;
    }

    if (line.startsWith('^')) {
      // End of transaction, save it
      if (currentTransaction.transactionDate && currentTransaction.description) {
        transactions.push({
          transactionDate: currentTransaction.transactionDate || new Date().toISOString(),
          description: currentTransaction.description || '',
          category: currentTransaction.category || 'Uncategorized',
          subCategory: currentTransaction.subCategory || '',
          debitAmount: currentTransaction.debitAmount || 0,
          creditAmount: currentTransaction.creditAmount || 0,
          linkedTransactionId: currentTransaction.linkedTransactionId
        });
      }
      currentTransaction = {};
      continue;
    }

    if (line.startsWith('D')) {
      // Date
      const dateStr = line.substring(1);
      currentTransaction.transactionDate = parseQIFDate(dateStr);
    } else if (line.startsWith('T')) {
      // Transaction amount
      const amountStr = line.substring(1);
      const amount = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
      if (amount > 0) {
        currentTransaction.creditAmount = amount;
        currentTransaction.debitAmount = 0;
      } else {
        currentTransaction.debitAmount = Math.abs(amount);
        currentTransaction.creditAmount = 0;
      }
    } else if (line.startsWith('P')) {
      // Payee/Description
      currentTransaction.description = line.substring(1);
    } else if (line.startsWith('L')) {
      // Category
      currentTransaction.category = line.substring(1);
    } else if (line.startsWith('S')) {
      // Sub-category
      currentTransaction.subCategory = line.substring(1);
    } else if (line.startsWith('M')) {
      // Memo (can be used for additional description)
      if (!currentTransaction.description) {
        currentTransaction.description = line.substring(1);
      }
    }
  }

  // Don't forget the last transaction
  if (currentTransaction.transactionDate && currentTransaction.description) {
    transactions.push({
      transactionDate: currentTransaction.transactionDate || new Date().toISOString(),
      description: currentTransaction.description || '',
      category: currentTransaction.category || 'Uncategorized',
      subCategory: currentTransaction.subCategory || '',
      debitAmount: currentTransaction.debitAmount || 0,
      creditAmount: currentTransaction.creditAmount || 0,
      linkedTransactionId: currentTransaction.linkedTransactionId
    });
  }

  return transactions;
}

function parseQIFDate(dateStr: string): string {
  // Normalize into ISO YYYY-MM-DD without time to avoid timezone shifts
  const s = dateStr.trim();

  // Patterns
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/; // D/M/Y or M/D/Y
  const dash = /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/;     // D-M-Y or M-D-Y
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;        // YYYY-MM-DD

  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

  const toIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

  const parseDMYorMDY = (a: number, b: number, year: number) => {
    // If first part > 12, it's definitely day (DD/MM)
    // If second part > 12, it's definitely month (MM/DD)
    // If both <= 12, prefer DD/MM for AU users
    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      day = a; month = b;
    } else if (b > 12 && a <= 12) {
      month = a; day = b;
    } else {
      // ambiguous: default to DD/MM
      day = a; month = b;
    }
    return toIso(year, month, day);
  };

  // ISO straight through
  let m = s.match(iso);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    return toIso(y, mo, d);
  }

  // Slash or dash formats with 2 or 4 digit year
  m = s.match(slash) || s.match(dash);
  if (m) {
    let a = parseInt(m[1], 10);
    let b = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    return parseDMYorMDY(a, b, y);
  }

  // Fallback: today as ISO date
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export async function parseQIFFile(file: File): Promise<QIFTransaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const transactions = parseQIFContent(content);
        resolve(transactions);
      } catch (error) {
        reject(new Error('Failed to parse QIF file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read QIF file'));
    };

    reader.readAsText(file);
  });
} 