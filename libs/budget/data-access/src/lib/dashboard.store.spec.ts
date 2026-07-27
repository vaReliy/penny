import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DashboardStore } from './dashboard.store.js';

describe('DashboardStore', () => {
  let store: DashboardStore;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    store = TestBed.inject(DashboardStore);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('loadBalance() populates the balance signal', () => {
    store.loadBalance();
    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '100000', currency: 'UAH' },
    });

    expect(store.balance()?.accountId).toBe('a1');
  });

  it('loadSummary() populates the summary signal', () => {
    store.loadSummary('2026-07');
    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/summary' &&
          candidate.params.get('month') === '2026-07',
      )
      .flush({ month: '2026-07', categories: [] });

    expect(store.summary()?.month).toBe('2026-07');
  });

  it('loadChart() populates the chart signal', () => {
    store.loadChart();
    httpController.expectOne('/api/budget/chart').flush([]);

    expect(store.chart()).toEqual([]);
  });

  it('refresh() re-fetches balance but not summary when no month was ever loaded', () => {
    store.refresh();

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '100000', currency: 'UAH' },
    });
    httpController.expectNone(
      (candidate) => candidate.url === '/api/budget/summary',
    );
  });

  it('refresh() re-fetches both balance and the last-loaded month summary', () => {
    store.loadSummary('2026-07');
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({ month: '2026-07', categories: [] });

    store.refresh();

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '150000', currency: 'UAH' },
    });
    const summaryReq = httpController.expectOne(
      (candidate) =>
        candidate.url === '/api/budget/summary' &&
        candidate.params.get('month') === '2026-07',
    );
    summaryReq.flush({ month: '2026-07', categories: [] });

    expect(store.balance()?.balance.amount).toBe(150000n);
  });

  it('balanceLoading stays true while a summary request resolves first', () => {
    store.loadBalance();
    store.loadSummary('2026-07');

    expect(store.balanceLoading()).toBe(true);
    expect(store.summaryLoading()).toBe(true);

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/summary' &&
          candidate.params.get('month') === '2026-07',
      )
      .flush({ month: '2026-07', categories: [] });

    expect(store.summaryLoading()).toBe(false);
    expect(store.balanceLoading()).toBe(true);

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '100000', currency: 'UAH' },
    });

    expect(store.balanceLoading()).toBe(false);
  });

  it('an error on one concern leaves another concern error signal null', () => {
    store.loadSummary('2026-07');
    store.loadBalance();

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/summary' &&
          candidate.params.get('month') === '2026-07',
      )
      .flush('summary failed', { status: 500, statusText: 'Server Error' });

    expect(store.summaryError()).not.toBeNull();
    expect(store.balanceError()).toBeNull();

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '100000', currency: 'UAH' },
    });

    expect(store.balanceError()).toBeNull();
  });

  it('chartLoading and chartError stay isolated from a concurrent balance failure', () => {
    store.loadChart();
    store.loadBalance();

    expect(store.chartLoading()).toBe(true);

    httpController
      .expectOne('/api/budget/balance')
      .flush('balance failed', { status: 500, statusText: 'Server Error' });

    expect(store.balanceError()).not.toBeNull();
    expect(store.chartError()).toBeNull();
    expect(store.chartLoading()).toBe(true);

    httpController.expectOne('/api/budget/chart').flush([]);

    expect(store.chartLoading()).toBe(false);
    expect(store.chartError()).toBeNull();
  });
});
