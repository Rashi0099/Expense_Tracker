import { Share, Alert, NativeModules, Platform } from 'react-native';
import { ExpenseModel, IncomeModel } from '../domain/models';
import { formatDisplayDate } from './date';

export interface UnifiedTransactionExportItem {
  id: string;
  type: 'EXPENSE' | 'INCOME';
  date: string;
  walletName: string;
  categoryName: string;
  payeeOrSource: string;
  paymentMethod: string;
  amountCents: number;
  currency: string;
  note?: string;
}

/**
 * Normalizes Expense and Income models into a unified exportable item list
 */
export function normalizeTransactionsForExport(
  expenses: ExpenseModel[],
  incomes: IncomeModel[]
): UnifiedTransactionExportItem[] {
  const expenseItems: UnifiedTransactionExportItem[] = expenses.map((e) => ({
    id: e.id,
    type: 'EXPENSE',
    date: e.transactionDate,
    walletName: e.walletName || 'Default Wallet',
    categoryName: e.categoryName || 'General',
    payeeOrSource: e.payee || e.categoryName || 'Expense',
    paymentMethod: (e.paymentMethod || 'OTHER').replace(/_/g, ' '),
    amountCents: e.amountCents,
    currency: e.currency || 'INR',
    note: e.note,
  }));

  const incomeItems: UnifiedTransactionExportItem[] = incomes.map((i) => ({
    id: i.id,
    type: 'INCOME',
    date: i.transactionDate,
    walletName: i.walletName || 'Default Wallet',
    categoryName: i.categoryName || 'Income',
    payeeOrSource: i.source || i.categoryName || 'Income',
    paymentMethod: (i.paymentMethod || 'OTHER').replace(/_/g, ' '),
    amountCents: i.amountCents,
    currency: i.currency || 'INR',
    note: i.note,
  }));

  return [...expenseItems, ...incomeItems].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Escapes values according to RFC 4180 CSV standard
 */
function escapeCsvValue(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates RFC 4180 CSV string for Excel, Google Sheets, Numbers
 */
export function generateCSV(items: UnifiedTransactionExportItem[]): string {
  const headers = [
    'Date',
    'Type',
    'Wallet',
    'Category',
    'Payee / Source',
    'Payment Method',
    'Amount',
    'Currency',
    'Note',
  ];

  const headerRow = headers.map(escapeCsvValue).join(',');

  const rows = items.map((item) => {
    const formattedAmount = (item.amountCents / 100).toFixed(2);
    const amountVal = item.type === 'EXPENSE' ? `-${formattedAmount}` : formattedAmount;
    return [
      escapeCsvValue(item.date),
      escapeCsvValue(item.type),
      escapeCsvValue(item.walletName),
      escapeCsvValue(item.categoryName),
      escapeCsvValue(item.payeeOrSource),
      escapeCsvValue(item.paymentMethod),
      escapeCsvValue(amountVal),
      escapeCsvValue(item.currency),
      escapeCsvValue(item.note || ''),
    ].join(',');
  });

  return [headerRow, ...rows].join('\n');
}

/**
 * Generates formatted Financial Statement summary
 */
export function generateFinancialStatement(
  items: UnifiedTransactionExportItem[],
  currency: string = 'INR',
  title: string = 'Spending Book Financial Statement'
): string {
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;

  items.forEach((item) => {
    if (item.type === 'INCOME') totalIncomeCents += item.amountCents;
    if (item.type === 'EXPENSE') totalExpenseCents += item.amountCents;
  });

  const netCents = totalIncomeCents - totalExpenseCents;
  const nowStr = new Date().toLocaleString();

  let text = `========================================\n`;
  text += `${title.toUpperCase()}\n`;
  text += `Generated: ${nowStr}\n`;
  text += `========================================\n\n`;

  text += `FINANCIAL SUMMARY\n`;
  text += `----------------------------------------\n`;
  text += `Total Income:   +${currency} ${(totalIncomeCents / 100).toFixed(2)}\n`;
  text += `Total Expenses: -${currency} ${(totalExpenseCents / 100).toFixed(2)}\n`;
  text += `Net Cashflow:   ${netCents >= 0 ? '+' : '-'}${currency} ${(Math.abs(netCents) / 100).toFixed(2)}\n`;
  text += `Transactions:   ${items.length} records\n\n`;

  text += `DETAILED TRANSACTIONS\n`;
  text += `----------------------------------------\n`;

  items.forEach((item, idx) => {
    const sign = item.type === 'INCOME' ? '+' : '-';
    const amt = `${sign}${currency} ${(item.amountCents / 100).toFixed(2)}`;
    text += `${idx + 1}. [${item.date}] ${item.type} | ${amt}\n`;
    text += `   Category: ${item.categoryName} (${item.walletName})\n`;
    text += `   Detail: ${item.payeeOrSource}${item.note ? ` • Note: ${item.note}` : ''}\n`;
    text += `----------------------------------------\n`;
  });

  text += `\nExported from Spending Book — Offline-First Expense Tracker\n`;
  return text;
}

/**
 * Shares export content as an authentic file attachment (.csv, .txt, .html)
 * via Native FileProvider so WhatsApp, Google Drive, and Gmail receive actual files.
 */
export async function shareExportContent(
  fileName: string,
  content: string,
  mimeType: string = 'text/csv'
): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && NativeModules.FileShareModule?.shareFile) {
      await NativeModules.FileShareModule.shareFile(
        fileName,
        content,
        mimeType,
        `Share ${fileName}`
      );
      return true;
    }

    const result = await Share.share({
      title: fileName,
      message: content,
    });
    return result.action === Share.sharedAction;
  } catch (err: any) {
    Alert.alert('Export Error', err?.message || 'Could not open share sheet.');
    return false;
  }
}
