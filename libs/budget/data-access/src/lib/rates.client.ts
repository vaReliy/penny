import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ExchangeRatesResponse } from 'budget-contracts';

import type { ExchangeRatesView } from './budget-view-models';
import { fromIsoDate } from './date-boundary.util';

/** Not nested under `/api/budget` — mirrors `RatesController`'s own top-level `@Controller('rates')`. */
const RATES_URL = '/api/rates';

function toExchangeRatesView(
  response: ExchangeRatesResponse,
): ExchangeRatesView {
  return {
    base: response.base,
    rates: response.rates,
    asOf: fromIsoDate(response.asOf),
  };
}

/** Typed HTTP client for the FX display rate proxy endpoint. */
@Injectable({ providedIn: 'root' })
export class RatesClient {
  private readonly http = inject(HttpClient);

  public get(): Observable<ExchangeRatesView> {
    return this.http
      .get<ExchangeRatesResponse>(RATES_URL, { withCredentials: true })
      .pipe(map(toExchangeRatesView));
  }
}
