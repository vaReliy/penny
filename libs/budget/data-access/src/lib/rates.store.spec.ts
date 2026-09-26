import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RatesStore } from './rates.store.js';
import { BudgetApiErrorKind } from './budget-api-error.js';

describe('RatesStore', () => {
  let store: RatesStore;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RatesStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    store = TestBed.inject(RatesStore);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('load() populates the rates signal', () => {
    expect(store.loading()).toBe(false);
    store.load();
    expect(store.loading()).toBe(true);

    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });

    expect(store.loading()).toBe(false);
    expect(store.rates()?.base).toBe('UAH');
    expect(store.rates()?.rates).toEqual([
      { currency: 'USD', rateToBase: '41.5000' },
    ]);
    expect(store.rates()?.asOf).toEqual(new Date('2026-07-27T10:00:00.000Z'));
  });

  it('refresh() re-fetches rates via the same endpoint', () => {
    store.load();
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [],
      asOf: '2026-07-27T10:00:00.000Z',
    });

    store.refresh();
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'EUR', rateToBase: '45.0000' }],
      asOf: '2026-07-27T11:00:00.000Z',
    });

    expect(store.rates()?.rates).toEqual([
      { currency: 'EUR', rateToBase: '45.0000' },
    ]);
  });

  it('ignores a late-resolving superseded call: a stale first request never overwrites a second, newer call’s data', () => {
    // Calling refresh() while a load() is still pending fires a second,
    // independent HTTP request. BudgetRequestState's generation guard
    // ensures the second (newer) call always wins, regardless of which
    // response actually arrives first over the wire.
    store.load();
    store.refresh();

    const pending = httpController.match('/api/rates');
    expect(pending).toHaveLength(2);

    const [first, second] = pending;
    // Resolve the second (later) call first...
    second.flush({
      base: 'UAH',
      rates: [{ currency: 'EUR', rateToBase: '45.0000' }],
      asOf: '2026-07-27T11:00:00.000Z',
    });
    expect(store.rates()?.rates).toEqual([
      { currency: 'EUR', rateToBase: '45.0000' },
    ]);

    // ...then resolve the first (earlier, now-superseded) call, which is
    // dropped rather than overwriting the newer data.
    first.flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });
    expect(store.rates()?.rates).toEqual([
      { currency: 'EUR', rateToBase: '45.0000' },
    ]);
  });

  it('reset() clears the loaded rates', () => {
    store.load();
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });
    expect(store.rates()).not.toBeNull();

    store.reset();

    expect(store.rates()).toBeNull();
  });

  it('maps a failed request into the error signal and clears loading', () => {
    store.load();
    httpController
      .expectOne('/api/rates')
      .flush(
        { code: 'UNKNOWN_ERROR', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );

    expect(store.loading()).toBe(false);
    expect(store.error()?.kind).toBe(BudgetApiErrorKind.UNKNOWN);
  });
});
