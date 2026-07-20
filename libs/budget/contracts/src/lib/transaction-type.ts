/**
 * Explicit sign for a `Transaction`. Amounts are always positive minor
 * units; the sign is conveyed by this field, never a negative amount.
 */
export const TransactionType = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];
