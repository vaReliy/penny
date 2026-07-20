import type { SerializedMoney } from 'shared-util';

import type { TransactionType } from './transaction-type.js';

/** Request body for `POST /budget/transactions`. */
export interface CreateTransactionRequest {
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  /** Always positive, in integer minor units — sign is conveyed by `type`. */
  readonly amountMinorUnits: number;
  /** Economic date, `'YYYY-MM-DD'`. */
  readonly date: string;
  readonly description?: string;
}

/**
 * Query params for `GET /budget/transactions`. All fields are optional
 * narrowing filters; `from`/`to` and `month` are mutually exclusive ways to
 * scope a date range — callers pick one.
 */
export interface TransactionFilterQuery {
  readonly type?: TransactionType;
  readonly categoryId?: string;
  readonly accountId?: string;
  /** Inclusive range start, `'YYYY-MM-DD'`. */
  readonly from?: string;
  /** Inclusive range end, `'YYYY-MM-DD'`. */
  readonly to?: string;
  /** Calendar month shorthand for the range, `'YYYY-MM'`. */
  readonly month?: string;
}

/** Response shape for a single transaction. */
export interface TransactionResponse {
  readonly id: string;
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  readonly amount: SerializedMoney;
  /** Economic date, `'YYYY-MM-DD'`. */
  readonly date: string;
  readonly description?: string;
  readonly createdBy: string;
  /** ISO date-time string. */
  readonly createdAt: string;
}

/** Response body for `GET /budget/transactions`. */
export type TransactionListResponse = readonly TransactionResponse[];
