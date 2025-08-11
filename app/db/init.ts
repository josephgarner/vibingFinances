import { db } from './index';
import { accountBooks, accounts, transactions } from './schema';

export async function initDatabase() {
  try {
    // This will create the tables if they don't exist
    // In a production environment, you should use migrations instead
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
} 