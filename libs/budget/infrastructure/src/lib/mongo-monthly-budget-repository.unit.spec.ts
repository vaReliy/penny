/**
 * Unit tests for MongoMonthlyBudgetRepository: the Mongoose model is mocked
 * so these tests run without a live MongoDB connection. They exercise that
 * `upsertAmount` issues exactly one atomic `findOneAndUpdate` with
 * `upsert: true` keyed on the unique compound index — no prior read.
 */

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import pino from 'pino';
import { InfrastructureError } from 'shared-errors';
import { Money } from 'shared-util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const silentLogger = pino({ level: 'silent' });

vi.mock('./monthly-budget.model.js');

import { getMonthlyBudgetModel } from './monthly-budget.model.js';
import type { MonthlyBudgetModel } from './monthly-budget.model.js';
import { MongoMonthlyBudgetRepository } from './mongo-monthly-budget-repository.js';

const FAKE_CONNECTION = {} as Connection;

describe('MongoMonthlyBudgetRepository (unit — mocked model)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('upsertAmount', () => {
    it('issues exactly one atomic findOneAndUpdate with upsert:true — no prior read call', async () => {
      const findOneAndUpdateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({}),
      });
      const findOneSpy = vi.fn();
      const mockModel = {
        findOneAndUpdate: findOneAndUpdateSpy,
        findOne: findOneSpy,
      };
      vi.mocked(getMonthlyBudgetModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof MonthlyBudgetModel>,
      );

      const repository = new MongoMonthlyBudgetRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const amount = Money.fromMinorUnits(150000n, 'UAH');

      await repository.upsertAmount('ws-1', 'cat-1', '2026-07', amount);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { workspaceId: 'ws-1', categoryId: 'cat-1', month: '2026-07' },
        { $set: { amount: 150000n, currency: 'UAH' } },
        { upsert: true },
      );
      // No read-then-write: findOne must never be called by upsertAmount.
      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('wraps a driver error as InfrastructureError', async () => {
      const mockModel = {
        findOneAndUpdate: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(new Error('topology closed')),
        }),
      };
      vi.mocked(getMonthlyBudgetModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof MonthlyBudgetModel>,
      );

      const repository = new MongoMonthlyBudgetRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const amount = Money.fromMinorUnits(150000n, 'UAH');

      await expect(
        repository.upsertAmount('ws-1', 'cat-1', '2026-07', amount),
      ).rejects.toBeInstanceOf(InfrastructureError);
    });

    it('retries once and succeeds when the first attempt loses an upsert race (E11000)', async () => {
      const duplicateKeyError = Object.assign(
        new Error(
          'E11000 duplicate key error collection: penny.monthlyBudgets index: workspaceId_1_categoryId_1_month_1 dup key',
        ),
        { code: 11000, name: 'MongoServerError' },
      );
      const findOneAndUpdateSpy = vi
        .fn()
        .mockReturnValueOnce({
          exec: vi.fn().mockRejectedValue(duplicateKeyError),
        })
        .mockReturnValueOnce({
          exec: vi.fn().mockResolvedValue({}),
        });
      const mockModel = { findOneAndUpdate: findOneAndUpdateSpy };
      vi.mocked(getMonthlyBudgetModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof MonthlyBudgetModel>,
      );

      const repository = new MongoMonthlyBudgetRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const amount = Money.fromMinorUnits(150000n, 'UAH');

      await expect(
        repository.upsertAmount('ws-1', 'cat-1', '2026-07', amount),
      ).resolves.toBeUndefined();
      expect(findOneAndUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it('wraps a second consecutive E11000 (retry also loses) as InfrastructureError', async () => {
      const duplicateKeyError = Object.assign(
        new Error('E11000 duplicate key error'),
        { code: 11000, name: 'MongoServerError' },
      );
      const findOneAndUpdateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockRejectedValue(duplicateKeyError),
      });
      const mockModel = { findOneAndUpdate: findOneAndUpdateSpy };
      vi.mocked(getMonthlyBudgetModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof MonthlyBudgetModel>,
      );

      const repository = new MongoMonthlyBudgetRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const amount = Money.fromMinorUnits(150000n, 'UAH');

      await expect(
        repository.upsertAmount('ws-1', 'cat-1', '2026-07', amount),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(findOneAndUpdateSpy).toHaveBeenCalledTimes(2);
    });
  });
});
