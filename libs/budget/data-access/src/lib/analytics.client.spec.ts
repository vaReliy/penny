import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Money } from 'shared-util';
import { AnalyticsClient } from './analytics.client.js';

describe('AnalyticsClient', () => {
  let client: AnalyticsClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnalyticsClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(AnalyticsClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  describe('getBalance', () => {
    it('sends GET to /api/budget/balance and converts to Money', () => {
      let result: { balance: Money } | undefined;
      client.getBalance().subscribe((balance) => (result = balance));

      const req = httpController.expectOne('/api/budget/balance');
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({
        accountId: 'acc1',
        balance: { amount: '250000', currency: 'UAH' },
      });

      expect(result?.balance).toBeInstanceOf(Money);
      expect(result?.balance.amount).toBe(250000n);
    });
  });

  describe('getSummary', () => {
    it('sends GET to /api/budget/summary with the month query param', () => {
      client.getSummary('2026-07').subscribe();

      const req = httpController.expectOne(
        (candidate) =>
          candidate.url === '/api/budget/summary' &&
          candidate.params.get('month') === '2026-07',
      );
      req.flush({ month: '2026-07', categories: [] });
    });

    it('converts each category rollup amount to Money', () => {
      let result:
        | {
            categories: readonly {
              budgeted: Money;
              spent: Money;
              remaining: Money;
            }[];
          }
        | undefined;
      client.getSummary('2026-07').subscribe((summary) => (result = summary));

      const req = httpController.expectOne(
        (candidate) => candidate.url === '/api/budget/summary',
      );
      req.flush({
        month: '2026-07',
        categories: [
          {
            categoryId: 'c1',
            budgeted: { amount: '500000', currency: 'UAH' },
            spent: { amount: '300000', currency: 'UAH' },
            remaining: { amount: '200000', currency: 'UAH' },
          },
        ],
      });

      expect(result?.categories[0]?.budgeted).toBeInstanceOf(Money);
      expect(result?.categories[0]?.remaining.amount).toBe(200000n);
    });
  });

  describe('getChart', () => {
    it('sends GET with from/to converted to YYYY-MM-DD query params', () => {
      client
        .getChart({
          from: new Date('2026-07-01T00:00:00.000Z'),
          to: new Date('2026-07-31T00:00:00.000Z'),
        })
        .subscribe();

      const req = httpController.expectOne(
        (candidate) => candidate.url === '/api/budget/chart',
      );
      expect(req.request.params.get('from')).toBe('2026-07-01');
      expect(req.request.params.get('to')).toBe('2026-07-31');
      req.flush([]);
    });

    it('converts each entry value to Money', () => {
      let result: readonly { value: Money }[] | undefined;
      client.getChart().subscribe((entries) => (result = entries));

      const req = httpController.expectOne(
        (candidate) => candidate.url === '/api/budget/chart',
      );
      req.flush([
        {
          categoryId: 'c1',
          name: 'Groceries',
          value: { amount: '400000', currency: 'UAH' },
        },
      ]);

      expect(result?.[0]?.value).toBeInstanceOf(Money);
      expect(result?.[0]?.value.amount).toBe(400000n);
    });
  });
});
