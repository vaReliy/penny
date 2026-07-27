import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Money } from 'shared-util';
import { MonthlyBudgetClient } from './monthly-budget.client.js';

describe('MonthlyBudgetClient', () => {
  let client: MonthlyBudgetClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MonthlyBudgetClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(MonthlyBudgetClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  describe('listByMonth', () => {
    it('sends GET with the month as a query param', () => {
      client.listByMonth('2026-07').subscribe();

      const req = httpController.expectOne(
        (candidate) =>
          candidate.url === '/api/budget/monthly-budgets' &&
          candidate.params.get('month') === '2026-07',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush([]);
    });

    it('converts SerializedMoney amounts into Money values', () => {
      let result: readonly { amount: Money }[] | undefined;
      client.listByMonth('2026-07').subscribe((budgets) => (result = budgets));

      const req = httpController.expectOne(
        (candidate) => candidate.url === '/api/budget/monthly-budgets',
      );
      req.flush([
        {
          id: 'b1',
          categoryId: 'c1',
          month: '2026-07',
          amount: { amount: '500000', currency: 'UAH' },
        },
      ]);

      expect(result?.[0]?.amount).toBeInstanceOf(Money);
      expect(result?.[0]?.amount.amount).toBe(500000n);
      expect(result?.[0]?.amount.currency).toBe('UAH');
    });
  });

  describe('upsert', () => {
    it('sends PUT with the request body, amount as integer minor units', () => {
      client
        .upsert({
          categoryId: 'c1',
          month: '2026-07',
          amountMinorUnits: 500000,
        })
        .subscribe();

      const req = httpController.expectOne('/api/budget/monthly-budgets');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        categoryId: 'c1',
        month: '2026-07',
        amountMinorUnits: 500000,
      });
      req.flush({
        id: 'b1',
        categoryId: 'c1',
        month: '2026-07',
        amount: { amount: '500000', currency: 'UAH' },
      });
    });
  });
});
