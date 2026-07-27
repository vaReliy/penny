import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TransactionType } from 'budget-contracts';
import { TransactionStore } from './transaction.store.js';
import { DashboardStore } from './dashboard.store.js';

describe('TransactionStore', () => {
  let store: TransactionStore;
  let dashboardStore: DashboardStore;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TransactionStore,
        DashboardStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    store = TestBed.inject(TransactionStore);
    dashboardStore = TestBed.inject(DashboardStore);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('load() populates data', () => {
    store.load({ month: '2026-07' });

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/transactions' &&
          candidate.params.get('month') === '2026-07',
      )
      .flush([]);

    expect(store.data()).toEqual([]);
  });

  it('record() prepends the new transaction to data', () => {
    store.record({
      accountId: 'a1',
      categoryId: 'c1',
      type: TransactionType.EXPENSE,
      amountMinorUnits: 15000,
      date: new Date('2026-07-27T00:00:00.000Z'),
    });

    httpController.expectOne('/api/budget/transactions').flush({
      id: 't1',
      accountId: 'a1',
      categoryId: 'c1',
      type: TransactionType.EXPENSE,
      amount: { amount: '15000', currency: 'UAH' },
      date: '2026-07-27',
      createdBy: 'u1',
      createdAt: '2026-07-27T00:00:00.000Z',
    });

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '85000', currency: 'UAH' },
    });

    expect(store.data()).toHaveLength(1);
    expect(store.data()[0]?.id).toBe('t1');
  });

  it('record() triggers DashboardStore.refresh(), refetching balance and the last-loaded summary month', () => {
    dashboardStore.loadSummary('2026-07');
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({ month: '2026-07', categories: [] });

    store.record({
      accountId: 'a1',
      categoryId: 'c1',
      type: TransactionType.EXPENSE,
      amountMinorUnits: 15000,
      date: new Date('2026-07-27T00:00:00.000Z'),
    });

    httpController.expectOne('/api/budget/transactions').flush({
      id: 't1',
      accountId: 'a1',
      categoryId: 'c1',
      type: TransactionType.EXPENSE,
      amount: { amount: '15000', currency: 'UAH' },
      date: '2026-07-27',
      createdBy: 'u1',
      createdAt: '2026-07-27T00:00:00.000Z',
    });

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '85000', currency: 'UAH' },
    });
    const summaryReq = httpController.expectOne(
      (candidate) =>
        candidate.url === '/api/budget/summary' &&
        candidate.params.get('month') === '2026-07',
    );
    summaryReq.flush({ month: '2026-07', categories: [] });

    expect(dashboardStore.balance()?.balance.amount).toBe(85000n);
  });
});
