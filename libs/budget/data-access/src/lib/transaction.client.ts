import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Money } from 'shared-util';
import type {
  CreateTransactionRequest,
  TransactionListResponse,
  TransactionResponse,
} from 'budget-contracts';

import type {
  ListTransactionsParams,
  RecordTransactionParams,
  TransactionView,
} from './budget-view-models';
import { fromIsoDate, toIsoDateOnly } from './date-boundary.util';

const TRANSACTIONS_BASE = '/api/budget/transactions';

function toTransactionView(response: TransactionResponse): TransactionView {
  return {
    id: response.id,
    accountId: response.accountId,
    categoryId: response.categoryId,
    type: response.type,
    amount: Money.fromJSON(response.amount),
    date: fromIsoDate(response.date),
    ...(response.description !== undefined
      ? { description: response.description }
      : {}),
    createdBy: response.createdBy,
    createdAt: fromIsoDate(response.createdAt),
  };
}

function toCreateTransactionRequest(
  params: RecordTransactionParams,
): CreateTransactionRequest {
  return {
    accountId: params.accountId,
    categoryId: params.categoryId,
    type: params.type,
    amountMinorUnits: params.amountMinorUnits,
    date: toIsoDateOnly(params.date),
    ...(params.description !== undefined
      ? { description: params.description }
      : {}),
  };
}

function toTransactionFilterQuery(
  params: ListTransactionsParams,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.type !== undefined) query['type'] = params.type;
  if (params.categoryId !== undefined) query['categoryId'] = params.categoryId;
  if (params.accountId !== undefined) query['accountId'] = params.accountId;
  if (params.from !== undefined) query['from'] = toIsoDateOnly(params.from);
  if (params.to !== undefined) query['to'] = toIsoDateOnly(params.to);
  if (params.month !== undefined) query['month'] = params.month;
  return query;
}

/** Typed HTTP client for the budget vertical's `Transaction` operations. */
@Injectable({ providedIn: 'root' })
export class TransactionClient {
  private readonly http = inject(HttpClient);

  public record(params: RecordTransactionParams): Observable<TransactionView> {
    return this.http
      .post<TransactionResponse>(
        TRANSACTIONS_BASE,
        toCreateTransactionRequest(params),
        { withCredentials: true },
      )
      .pipe(map(toTransactionView));
  }

  public list(
    params: ListTransactionsParams = {},
  ): Observable<readonly TransactionView[]> {
    return this.http
      .get<TransactionListResponse>(TRANSACTIONS_BASE, {
        withCredentials: true,
        params: toTransactionFilterQuery(params),
      })
      .pipe(map((transactions) => transactions.map(toTransactionView)));
  }

  public get(id: string): Observable<TransactionView> {
    return this.http
      .get<TransactionResponse>(`${TRANSACTIONS_BASE}/${id}`, {
        withCredentials: true,
      })
      .pipe(map(toTransactionView));
  }
}
