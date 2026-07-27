import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TransactionType } from 'budget-contracts';
import { TransactionClient } from './transaction.client.js';

describe('TransactionClient', () => {
  let client: TransactionClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TransactionClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(TransactionClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  describe('record', () => {
    it('sends POST with the Date converted to a YYYY-MM-DD string', () => {
      client
        .record({
          accountId: 'a1',
          categoryId: 'c1',
          type: TransactionType.EXPENSE,
          amountMinorUnits: 15000,
          date: new Date('2026-07-27T12:00:00.000Z'),
        })
        .subscribe();

      const req = httpController.expectOne('/api/budget/transactions');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        accountId: 'a1',
        categoryId: 'c1',
        type: TransactionType.EXPENSE,
        amountMinorUnits: 15000,
        date: '2026-07-27',
      });

      req.flush({
        id: 't1',
        accountId: 'a1',
        categoryId: 'c1',
        type: TransactionType.EXPENSE,
        amount: { amount: '15000', currency: 'UAH' },
        date: '2026-07-27',
        createdBy: 'u1',
        createdAt: '2026-07-27T12:00:00.000Z',
      });
    });

    it('includes description only when provided', () => {
      client
        .record({
          accountId: 'a1',
          categoryId: 'c1',
          type: TransactionType.INCOME,
          amountMinorUnits: 1000,
          date: new Date('2026-07-01T00:00:00.000Z'),
        })
        .subscribe();

      const req = httpController.expectOne('/api/budget/transactions');
      expect(req.request.body.description).toBeUndefined();

      req.flush({
        id: 't2',
        accountId: 'a1',
        categoryId: 'c1',
        type: TransactionType.INCOME,
        amount: { amount: '1000', currency: 'UAH' },
        date: '2026-07-01',
        createdBy: 'u1',
        createdAt: '2026-07-01T00:00:00.000Z',
      });
    });

    it('converts the response date/createdAt strings into Date instances', () => {
      let result: { date: Date; createdAt: Date } | undefined;
      client
        .record({
          accountId: 'a1',
          categoryId: 'c1',
          type: TransactionType.EXPENSE,
          amountMinorUnits: 15000,
          date: new Date('2026-07-27T00:00:00.000Z'),
        })
        .subscribe((transaction) => (result = transaction));

      const req = httpController.expectOne('/api/budget/transactions');
      req.flush({
        id: 't1',
        accountId: 'a1',
        categoryId: 'c1',
        type: TransactionType.EXPENSE,
        amount: { amount: '15000', currency: 'UAH' },
        date: '2026-07-27',
        createdBy: 'u1',
        createdAt: '2026-07-27T12:34:56.000Z',
      });

      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.createdAt.toISOString()).toBe('2026-07-27T12:34:56.000Z');
    });
  });

  describe('list', () => {
    it('sends GET with from/to converted to YYYY-MM-DD query params', () => {
      client
        .list({
          from: new Date('2026-07-01T00:00:00.000Z'),
          to: new Date('2026-07-31T00:00:00.000Z'),
          categoryId: 'c1',
        })
        .subscribe();

      const req = httpController.expectOne(
        (candidate) => candidate.url === '/api/budget/transactions',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('from')).toBe('2026-07-01');
      expect(req.request.params.get('to')).toBe('2026-07-31');
      expect(req.request.params.get('categoryId')).toBe('c1');
      req.flush([]);
    });

    it('omits filters that were not supplied', () => {
      client.list().subscribe();

      const req = httpController.expectOne(
        (candidate) => candidate.url === '/api/budget/transactions',
      );
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });
  });

  describe('get', () => {
    it('sends GET to /api/budget/transactions/:id', () => {
      client.get('t1').subscribe();

      const req = httpController.expectOne('/api/budget/transactions/t1');
      expect(req.request.method).toBe('GET');
      req.flush({
        id: 't1',
        accountId: 'a1',
        categoryId: 'c1',
        type: TransactionType.EXPENSE,
        amount: { amount: '15000', currency: 'UAH' },
        date: '2026-07-27',
        createdBy: 'u1',
        createdAt: '2026-07-27T00:00:00.000Z',
      });
    });
  });
});
