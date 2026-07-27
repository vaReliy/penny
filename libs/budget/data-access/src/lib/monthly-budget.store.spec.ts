import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonthlyBudgetStore } from './monthly-budget.store.js';

describe('MonthlyBudgetStore', () => {
  let store: MonthlyBudgetStore;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MonthlyBudgetStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    store = TestBed.inject(MonthlyBudgetStore);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('loadByMonth() populates data with Money-converted amounts', () => {
    store.loadByMonth('2026-07');

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/monthly-budgets' &&
          candidate.params.get('month') === '2026-07',
      )
      .flush([
        {
          id: 'b1',
          categoryId: 'c1',
          month: '2026-07',
          amount: { amount: '500000', currency: 'UAH' },
        },
      ]);

    expect(store.data()).toHaveLength(1);
    expect(store.data()[0]?.amount.amount).toBe(500000n);
  });

  it('upsert() appends a new budget when it is not already in data', () => {
    store.upsert({
      categoryId: 'c1',
      month: '2026-07',
      amountMinorUnits: 500000,
    });

    httpController.expectOne('/api/budget/monthly-budgets').flush({
      id: 'b1',
      categoryId: 'c1',
      month: '2026-07',
      amount: { amount: '500000', currency: 'UAH' },
    });

    expect(store.data()).toHaveLength(1);
  });

  it('upsert() replaces an existing budget with the same id', () => {
    store.loadByMonth('2026-07');
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/monthly-budgets')
      .flush([
        {
          id: 'b1',
          categoryId: 'c1',
          month: '2026-07',
          amount: { amount: '500000', currency: 'UAH' },
        },
      ]);

    store.upsert({
      categoryId: 'c1',
      month: '2026-07',
      amountMinorUnits: 600000,
    });
    httpController.expectOne('/api/budget/monthly-budgets').flush({
      id: 'b1',
      categoryId: 'c1',
      month: '2026-07',
      amount: { amount: '600000', currency: 'UAH' },
    });

    expect(store.data()).toHaveLength(1);
    expect(store.data()[0]?.amount.amount).toBe(600000n);
  });
});
