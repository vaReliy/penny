import 'reflect-metadata';

import { describe, it, expect, beforeEach } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

import { AuthController } from './auth.controller.js';
import {
  TELEGRAM_LOGIN_THROTTLE_TTL_MS,
  TELEGRAM_LOGIN_THROTTLE_LIMIT,
} from './telegram-login-throttle.constants.js';

/** Shape returned by {@link ThrottlerStorage.increment} — not exported from the package's public API. */
interface FakeThrottlerStorageRecord {
  readonly totalHits: number;
  readonly timeToExpire: number;
  readonly isBlocked: boolean;
  readonly timeToBlockExpire: number;
}

/** In-memory stand-in for ThrottlerStorage — tracks hit counts per key, no Redis/TTL sweep. */
class FakeThrottlerStorage implements ThrottlerStorage {
  private readonly hits = new Map<string, number>();

  public async increment(
    key: string,
    _ttl: number,
    limit: number,
  ): Promise<FakeThrottlerStorageRecord> {
    const totalHits = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, totalHits);
    return {
      totalHits,
      timeToExpire: TELEGRAM_LOGIN_THROTTLE_TTL_MS,
      isBlocked: totalHits > limit,
      timeToBlockExpire: TELEGRAM_LOGIN_THROTTLE_TTL_MS,
    };
  }
}

function makeContext(): ExecutionContext {
  const req = { ip: '127.0.0.1', headers: {} };
  const res = { header: (): void => undefined };
  return {
    getHandler: () => AuthController.prototype.telegramLogin,
    getClass: () => AuthController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe('POST /auth/telegram route metadata', () => {
  it('includes ThrottlerGuard among the guards applied to telegramLogin', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuthController.prototype.telegramLogin,
    ) as unknown[] | undefined;

    expect(guards).toContain(ThrottlerGuard);
  });
});

describe('ThrottlerGuard applied to POST /auth/telegram', () => {
  const options: ThrottlerModuleOptions = [
    {
      ttl: TELEGRAM_LOGIN_THROTTLE_TTL_MS,
      limit: TELEGRAM_LOGIN_THROTTLE_LIMIT,
    },
  ];
  const reflector = {
    getAllAndOverride: () => undefined,
  } as unknown as Reflector;

  let guard: ThrottlerGuard;

  // Fresh guard + storage per test — the fake storage key is derived from the
  // (stable) class/handler name and tracker IP, so sharing an instance across
  // tests would leak hit counts between them.
  beforeEach(async () => {
    guard = new ThrottlerGuard(options, new FakeThrottlerStorage(), reflector);
    await guard.onModuleInit();
  });

  it('allows requests while under the configured limit', async () => {
    const context = makeContext();

    for (let i = 0; i < TELEGRAM_LOGIN_THROTTLE_LIMIT; i += 1) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
  });

  it('blocks the request that exceeds the configured limit with a 429', async () => {
    const context = makeContext();

    for (let i = 0; i < TELEGRAM_LOGIN_THROTTLE_LIMIT; i += 1) {
      await guard.canActivate(context);
    }

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
    try {
      await guard.canActivate(context);
    } catch (err) {
      expect((err as ThrottlerException).getStatus()).toBe(429);
    }
  });
});
