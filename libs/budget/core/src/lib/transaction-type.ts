/**
 * ADR-007 designates `libs/budget/contracts` as the permanent home for this
 * type once that lib is scaffolded (a later task); it lives here
 * provisionally so `Transaction` has something to reference today.
 */
export const TransactionType = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];
