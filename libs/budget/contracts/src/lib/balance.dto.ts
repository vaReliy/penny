import type { SerializedMoney } from 'shared-util';

/** Response body for `GET /budget/accounts/:id/balance`. */
export interface BalanceResponse {
  readonly accountId: string;
  /** `Σ(income) − Σ(expense)`, derived from the account's transactions. */
  readonly balance: SerializedMoney;
}
