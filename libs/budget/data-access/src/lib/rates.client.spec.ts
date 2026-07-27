import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RatesClient } from './rates.client.js';

describe('RatesClient', () => {
  let client: RatesClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RatesClient, provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(RatesClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('sends GET to /api/rates, not /api/budget/rates', () => {
    client.get().subscribe();

    const req = httpController.expectOne('/api/rates');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.8' }],
      asOf: '2026-07-27T00:00:00.000Z',
    });
  });

  it('converts asOf to a Date and keeps rateToBase as a string', () => {
    let result:
      | { asOf: Date; rates: readonly { rateToBase: string }[] }
      | undefined;
    client.get().subscribe((rates) => (result = rates));

    const req = httpController.expectOne('/api/rates');
    req.flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.8' }],
      asOf: '2026-07-27T00:00:00.000Z',
    });

    expect(result?.asOf).toBeInstanceOf(Date);
    expect(result?.rates[0]?.rateToBase).toBe('41.8');
  });
});
