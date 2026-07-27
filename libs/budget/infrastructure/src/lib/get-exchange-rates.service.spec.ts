import type { ExchangeRatesResponse } from 'budget-contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  EXCHANGE_RATE_CACHE_TTL_MS,
  GetExchangeRatesService,
  type IExchangeRateClient,
} from './get-exchange-rates.service.js';

const RESPONSE_A: ExchangeRatesResponse = {
  base: 'UAH',
  rates: [{ currency: 'USD', rateToBase: '41.8' }],
  asOf: '2026-07-01T00:00:00.000Z',
};

const RESPONSE_B: ExchangeRatesResponse = {
  base: 'UAH',
  rates: [{ currency: 'USD', rateToBase: '42.0' }],
  asOf: '2026-07-01T00:10:00.000Z',
};

/** Fake `IExchangeRateClient` with a controllable, spy-wrapped `fetchRates`. */
function fakeClient(
  fetchRates: () => Promise<ExchangeRatesResponse>,
): IExchangeRateClient {
  return { fetchRates };
}

describe('GetExchangeRatesService', () => {
  describe('execute', () => {
    it('calls the upstream client on a cold cache and returns the fresh result', async () => {
      const fetchRates = vi.fn().mockResolvedValue(RESPONSE_A);
      const service = new GetExchangeRatesService(fakeClient(fetchRates));

      const result = await service.execute();

      expect(result).toEqual(RESPONSE_A);
      expect(fetchRates).toHaveBeenCalledOnce();
    });

    it('serves the cached result on a second call within the TTL, making no second upstream call', async () => {
      const fetchRates = vi.fn().mockResolvedValue(RESPONSE_A);
      let currentMs = 1_000_000;
      const service = new GetExchangeRatesService(
        fakeClient(fetchRates),
        () => currentMs,
      );

      await service.execute();
      currentMs += EXCHANGE_RATE_CACHE_TTL_MS - 1;
      const second = await service.execute();

      expect(second).toEqual(RESPONSE_A);
      expect(fetchRates).toHaveBeenCalledOnce();
    });

    it('refreshes once the TTL has elapsed', async () => {
      const fetchRates = vi
        .fn()
        .mockResolvedValueOnce(RESPONSE_A)
        .mockResolvedValueOnce(RESPONSE_B);
      let currentMs = 1_000_000;
      const service = new GetExchangeRatesService(
        fakeClient(fetchRates),
        () => currentMs,
      );

      await service.execute();
      currentMs += EXCHANGE_RATE_CACHE_TTL_MS + 1;
      const second = await service.execute();

      expect(second).toEqual(RESPONSE_B);
      expect(fetchRates).toHaveBeenCalledTimes(2);
    });

    it('serves the last-known-good stale cache (with its original asOf) when upstream fails after a prior success', async () => {
      const fetchRates = vi
        .fn()
        .mockResolvedValueOnce(RESPONSE_A)
        .mockRejectedValueOnce(new Error('upstream 429'));
      let currentMs = 1_000_000;
      const service = new GetExchangeRatesService(
        fakeClient(fetchRates),
        () => currentMs,
      );

      await service.execute();
      currentMs += EXCHANGE_RATE_CACHE_TTL_MS + 1;
      const second = await service.execute();

      expect(second).toEqual(RESPONSE_A);
      expect(second.asOf).toBe(RESPONSE_A.asOf);
    });

    it('propagates the upstream error when there is no cache at all yet', async () => {
      const fetchRates = vi
        .fn()
        .mockRejectedValue(new Error('network timeout'));
      const service = new GetExchangeRatesService(fakeClient(fetchRates));

      await expect(service.execute()).rejects.toThrow('network timeout');
    });

    it('falls back to stale cache on a timeout the same way as any other upstream failure', async () => {
      const fetchRates = vi
        .fn()
        .mockResolvedValueOnce(RESPONSE_A)
        .mockRejectedValueOnce(new Error('timeout of 5000ms exceeded'));
      let currentMs = 1_000_000;
      const service = new GetExchangeRatesService(
        fakeClient(fetchRates),
        () => currentMs,
      );

      await service.execute();
      currentMs += EXCHANGE_RATE_CACHE_TTL_MS + 1;

      await expect(service.execute()).resolves.toEqual(RESPONSE_A);
    });
  });
});
