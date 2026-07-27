import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import type { GetExchangeRatesService } from 'budget-infrastructure';
import type { ExchangeRatesResponse } from 'budget-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { TOKENS } from './tokens.js';

/**
 * Server-side proxy for the FX display rate `GET /api/rates`. Guarded like
 * every other budget endpoint (session + active-user), per this task's
 * default. `GetExchangeRatesService` (`budget-infrastructure`) owns the
 * TTL cache/stale-serving policy over `MonobankCurrencyClient` — this
 * controller never calls Monobank directly and never accepts any
 * caller-supplied parameter that could shape the upstream request, so there
 * is no browser-visible dependency on Monobank and no SSRF-shaped surface:
 * the browser only ever talks to this same-origin endpoint, leaving the
 * frontend's CSP `connect-src` unchanged.
 */
@Controller('rates')
@UseGuards(SessionGuard, ActiveUserGuard)
export class RatesController {
  public constructor(
    @Inject(TOKENS.GetExchangeRates)
    private readonly getExchangeRates: GetExchangeRatesService,
  ) {}

  @Get()
  public async get(): Promise<ExchangeRatesResponse> {
    return this.getExchangeRates.execute();
  }
}
