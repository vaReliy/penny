import axios, { type AxiosInstance } from 'axios';

import type {
  ExchangeRateEntry,
  ExchangeRatesResponse,
} from 'budget-contracts';

/**
 * Monobank's public currency-rate endpoint. Fixed constant, never
 * interpolated/configurable per-request — this call takes no path/query
 * parameters derived from caller input, closing off any SSRF-shaped
 * request-forgery surface.
 */
export const MONOBANK_CURRENCY_URL = 'https://api.monobank.ua/bank/currency';

/**
 * Request timeout for the Monobank call. This sits in the request path of
 * `GetExchangeRatesService`'s cache-miss branch, so a hung upstream must
 * fail fast rather than stall callers indefinitely.
 */
export const MONOBANK_REQUEST_TIMEOUT_MS = 5_000;

/**
 * Upper bound on the Monobank response/request body size, in bytes. The real
 * currency-list payload is a few KB; 1 MiB is generous headroom above that
 * while still rejecting a runaway/malicious response instead of letting
 * axios buffer it unbounded (CWE-400 uncontrolled resource consumption).
 */
export const MONOBANK_MAX_BODY_BYTES = 1_048_576;

/** ISO 4217 numeric currency codes Monobank's payload uses. */
const ISO_4217_NUMERIC = {
  UAH: 980,
  USD: 840,
  EUR: 978,
} as const;

/**
 * Decimal places kept when averaging `rateBuy`/`rateSell` into `rateToBase`.
 * Rounding (rather than raw `.toString()`) avoids emitting binary-float
 * artifacts (e.g. `"27.200000000000003"`) that would defeat the DTO's
 * documented purpose of a transport-safe decimal string.
 */
const RATE_AVERAGE_DECIMAL_PLACES = 4;

/** Currencies (beyond the fixed `UAH` base) this client resolves a rate for. */
const SUPPORTED_CURRENCIES: ReadonlyArray<{
  readonly code: 'USD' | 'EUR';
  readonly numeric: number;
}> = [
  { code: 'USD', numeric: ISO_4217_NUMERIC.USD },
  { code: 'EUR', numeric: ISO_4217_NUMERIC.EUR },
];

/** Monobank's raw `GET /bank/currency` entry shape, prior to runtime validation. */
interface RawMonobankRate {
  readonly currencyCodeA: number;
  readonly currencyCodeB: number;
  readonly date: number;
  readonly rateBuy?: number;
  readonly rateSell?: number;
  readonly rateCross?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

/**
 * Validates one upstream array entry's shape before any field is read off
 * it — Monobank's response is untrusted external input, so nested-property
 * access must never be trusted without a runtime check first. Malformed
 * entries are filtered out by the caller rather than throwing.
 */
function isRawMonobankRate(value: unknown): value is RawMonobankRate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    isFiniteNumber(candidate['currencyCodeA']) &&
    isFiniteNumber(candidate['currencyCodeB']) &&
    isFiniteNumber(candidate['date']) &&
    isOptionalFiniteNumber(candidate['rateBuy']) &&
    isOptionalFiniteNumber(candidate['rateSell']) &&
    isOptionalFiniteNumber(candidate['rateCross'])
  );
}

/**
 * Resolves one validated entry's `rateToBase`: averages `rateBuy`/`rateSell`
 * when both are present, otherwise falls back to `rateCross`. Returns
 * `undefined` when neither is available (the entry is dropped upstream).
 */
function resolveRateToBase(entry: RawMonobankRate): string | undefined {
  if (entry.rateBuy !== undefined && entry.rateSell !== undefined) {
    return ((entry.rateBuy + entry.rateSell) / 2).toFixed(
      RATE_AVERAGE_DECIMAL_PLACES,
    );
  }
  if (entry.rateCross !== undefined) {
    return entry.rateCross.toString();
  }
  return undefined;
}

/**
 * Typed client for Monobank's public `GET /bank/currency` endpoint (no API
 * key required). Surfaces any upstream failure (network error, timeout,
 * HTTP 429, malformed payload) by throwing/rejecting — stale-serving is the
 * caller's responsibility (`GetExchangeRatesService`), not this client's.
 */
export class MonobankCurrencyClient {
  private readonly httpClient: AxiosInstance;

  public constructor(httpClient: AxiosInstance = axios) {
    this.httpClient = httpClient;
  }

  public async fetchRates(): Promise<ExchangeRatesResponse> {
    const response = await this.httpClient.get<unknown>(MONOBANK_CURRENCY_URL, {
      timeout: MONOBANK_REQUEST_TIMEOUT_MS,
      maxContentLength: MONOBANK_MAX_BODY_BYTES,
      maxBodyLength: MONOBANK_MAX_BODY_BYTES,
    });

    if (!Array.isArray(response.data)) {
      throw new Error('Monobank currency response was not an array.');
    }

    const validEntries = response.data.filter(isRawMonobankRate);

    const rates: ExchangeRateEntry[] = [];
    let latestDateSeconds: number | undefined;

    for (const supported of SUPPORTED_CURRENCIES) {
      const entry = validEntries.find(
        (candidate) =>
          candidate.currencyCodeA === supported.numeric &&
          candidate.currencyCodeB === ISO_4217_NUMERIC.UAH,
      );
      if (!entry) {
        continue;
      }

      const rateToBase = resolveRateToBase(entry);
      if (rateToBase === undefined) {
        continue;
      }

      rates.push({ currency: supported.code, rateToBase });
      if (latestDateSeconds === undefined || entry.date > latestDateSeconds) {
        latestDateSeconds = entry.date;
      }
    }

    // Monobank's own `date` (unix seconds, carried per-entry) is when the
    // bank computed the rate — more accurate to "as of" than this process's
    // fetch time, which additionally carries network/queue latency. Falls
    // back to the fetch time only when no entry resolved (empty `rates`).
    const asOf = new Date(
      (latestDateSeconds ?? Math.floor(Date.now() / 1000)) * 1000,
    ).toISOString();

    return { base: 'UAH', rates, asOf };
  }
}
