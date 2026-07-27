import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import {
  MONOBANK_CURRENCY_URL,
  MONOBANK_REQUEST_TIMEOUT_MS,
  MonobankCurrencyClient,
} from './monobank-currency-client.js';

/** Builds a fake `AxiosInstance` exposing only the `get` method the client calls. */
function fakeHttpClient(get: ReturnType<typeof vi.fn>): AxiosInstance {
  return { get } as unknown as AxiosInstance;
}

/** A realistic captured Monobank `/bank/currency` response fixture. */
const REALISTIC_RESPONSE = [
  {
    currencyCodeA: 840,
    currencyCodeB: 980,
    date: 1_752_000_000,
    rateBuy: 41.5,
    rateSell: 42.1,
  },
  {
    currencyCodeA: 978,
    currencyCodeB: 980,
    date: 1_752_000_060,
    rateBuy: 45.0,
    rateSell: 45.8,
  },
  // Unrelated pair (not vs UAH) — must be filtered out.
  {
    currencyCodeA: 978,
    currencyCodeB: 840,
    date: 1_752_000_000,
    rateCross: 1.08,
  },
];

describe('MonobankCurrencyClient', () => {
  describe('fetchRates', () => {
    it('maps USD/EUR-vs-UAH entries, averaging rateBuy/rateSell, and filters unrelated pairs', async () => {
      const get = vi.fn().mockResolvedValue({ data: REALISTIC_RESPONSE });
      const client = new MonobankCurrencyClient(fakeHttpClient(get));

      const result = await client.fetchRates();

      expect(result.base).toBe('UAH');
      expect(result.rates).toEqual([
        { currency: 'USD', rateToBase: '41.8000' },
        { currency: 'EUR', rateToBase: '45.4000' },
      ]);
      expect(result.asOf).toBe(new Date(1_752_000_060 * 1000).toISOString());
      expect(get).toHaveBeenCalledWith(MONOBANK_CURRENCY_URL, {
        timeout: MONOBANK_REQUEST_TIMEOUT_MS,
      });
    });

    it('rounds the rateBuy/rateSell average to avoid float-precision artifacts', async () => {
      // Raw JS division: (27.1 + 27.3) / 2 === 27.200000000000003 — a
      // binary-float rounding artifact. `.toFixed(4)` must clean this up;
      // the old `.toString()` implementation would have failed this test.
      const get = vi.fn().mockResolvedValue({
        data: [
          {
            currencyCodeA: 840,
            currencyCodeB: 980,
            date: 1_752_000_000,
            rateBuy: 27.1,
            rateSell: 27.3,
          },
        ],
      });
      const client = new MonobankCurrencyClient(fakeHttpClient(get));

      const result = await client.fetchRates();

      expect(result.rates).toEqual([
        { currency: 'USD', rateToBase: '27.2000' },
      ]);
    });

    it('falls back to rateCross when rateBuy/rateSell are absent', async () => {
      const get = vi.fn().mockResolvedValue({
        data: [
          {
            currencyCodeA: 840,
            currencyCodeB: 980,
            date: 1_752_000_000,
            rateCross: 41.9,
          },
        ],
      });
      const client = new MonobankCurrencyClient(fakeHttpClient(get));

      const result = await client.fetchRates();

      expect(result.rates).toEqual([{ currency: 'USD', rateToBase: '41.9' }]);
    });

    it('rejects a malformed (non-array) upstream payload without throwing on nested access', async () => {
      const get = vi.fn().mockResolvedValue({ data: { unexpected: 'shape' } });
      const client = new MonobankCurrencyClient(fakeHttpClient(get));

      await expect(client.fetchRates()).rejects.toThrow();
    });

    it('filters out entries with the wrong shape instead of crashing', async () => {
      const get = vi.fn().mockResolvedValue({
        data: [
          { currencyCodeA: 840, currencyCodeB: 980 }, // missing date
          {
            currencyCodeA: '840',
            currencyCodeB: 980,
            date: 1_752_000_000,
            rateCross: 41.9,
          }, // wrong type
          null,
          'not an object',
        ],
      });
      const client = new MonobankCurrencyClient(fakeHttpClient(get));

      const result = await client.fetchRates();

      expect(result.rates).toEqual([]);
    });

    it('propagates an upstream rejection (network failure / timeout / 429) to the caller', async () => {
      const get = vi
        .fn()
        .mockRejectedValue(new Error('Request failed with status code 429'));
      const client = new MonobankCurrencyClient(fakeHttpClient(get));

      await expect(client.fetchRates()).rejects.toThrow('429');
    });
  });
});
