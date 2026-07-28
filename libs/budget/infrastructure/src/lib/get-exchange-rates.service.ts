import type { ExchangeRatesResponse } from 'budget-contracts';

/**
 * Minimal client contract `GetExchangeRatesService` depends on — decouples
 * it from `MonobankCurrencyClient` so tests can supply a fake without
 * mocking HTTP.
 */
export interface IExchangeRateClient {
  fetchRates(): Promise<ExchangeRatesResponse>;
}

/**
 * TTL for the in-memory exchange-rate cache. Mirrors Monobank's documented
 * public rate limit on `/bank/currency` (assumed ~1 request per 5 minutes
 * before a 429 — see https://api.monobank.ua/docs/; confirm against current
 * docs if this ever needs tightening). Kept a few seconds above 5 minutes
 * so a cache-refresh call never lands slightly early due to timer jitter.
 */
export const EXCHANGE_RATE_CACHE_TTL_MS = 5 * 60 * 1000 + 5_000;

/**
 * Framework-free application service — no `@Injectable()` decorator
 * (`type:infrastructure` libs keep application-shaped services plain per
 * this repo's convention; only `apps/api` controllers use NestJS DI).
 *
 * Caches the last successful `ExchangeRatesResponse` in memory. A fresh
 * cache hit returns immediately with no upstream call. On a cache-miss or
 * stale cache it calls the upstream client; on upstream failure it serves
 * the last-known-good cached response instead of propagating the error —
 * that response's `asOf` is therefore not necessarily "now": it may lag by
 * as much as one failed-refresh interval whenever upstream is down or
 * rate-limited. Only a cold cache (no successful fetch has ever completed)
 * lets the upstream failure propagate to the caller.
 *
 * Concurrent `execute()` calls that land during the same cache-miss window
 * share a single in-flight `fetchRates()` promise instead of each firing
 * its own upstream request — otherwise N concurrent callers would hammer
 * Monobank's ~1-request-per-5-minutes rate limit. The in-flight slot
 * tracks only "is a fetch currently running", independent of the TTL
 * cache's own read/write lifecycle: it is populated right before the
 * upstream call starts and cleared once that call settles — resolved or
 * rejected — so a later cache-miss window always starts a fresh request.
 */
export class GetExchangeRatesService {
  private readonly client: IExchangeRateClient;
  private readonly now: () => number;
  private cachedResponse: ExchangeRatesResponse | undefined;
  private cachedAtMs: number | undefined;
  private inFlightFetch: Promise<ExchangeRatesResponse> | undefined;

  public constructor(
    client: IExchangeRateClient,
    now: () => number = Date.now,
  ) {
    this.client = client;
    this.now = now;
  }

  public async execute(): Promise<ExchangeRatesResponse> {
    if (this.isCacheFresh() && this.cachedResponse) {
      return this.cachedResponse;
    }

    try {
      const fresh = await this.fetchRatesDeduped();
      this.cachedResponse = fresh;
      this.cachedAtMs = this.now();
      return fresh;
    } catch (error) {
      if (this.cachedResponse) {
        return this.cachedResponse;
      }
      throw error;
    }
  }

  private fetchRatesDeduped(): Promise<ExchangeRatesResponse> {
    if (!this.inFlightFetch) {
      this.inFlightFetch = this.client.fetchRates().finally(() => {
        this.inFlightFetch = undefined;
      });
    }
    return this.inFlightFetch;
  }

  private isCacheFresh(): boolean {
    return (
      this.cachedAtMs !== undefined &&
      this.now() - this.cachedAtMs < EXCHANGE_RATE_CACHE_TTL_MS
    );
  }
}
