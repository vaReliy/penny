/**
 * Unit tests for MongoUserRepository: the Mongoose model is mocked so these
 * tests run without a live MongoDB connection. They exercise branches that
 * require simulated driver errors — specifically the E11000 concurrent-insert
 * retry path inside `upsertByTelegramId` and the `isMongoDriverError` guard.
 */

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import pino from 'pino';
import { InfrastructureError } from 'shared-errors';
import { User, UserStatus } from 'identity-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const silentLogger = pino({ level: 'silent' });

// getUserModel is mocked so MongoUserRepository never tries to touch a real
// Mongoose connection. vi.mock is hoisted above imports by Vitest's transform.
vi.mock('./user.model.js');

import { getUserModel } from './user.model.js';
import type { UserModel } from './user.model.js';
import { MongoUserRepository } from './mongo-user-repository.js';

/** Fake connection — never consumed because getUserModel is mocked. */
const FAKE_CONNECTION = {} as Connection;

const buildUser = (telegramId: string): User =>
  new User({
    id: 'new',
    telegramId,
    firstName: 'Ada',
    lastName: 'Lovelace',
    username: 'ada',
    photoUrl: 'https://example.com/ada.png',
    status: UserStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

/**
 * Constructs an error that mirrors the real MongoDB driver's E11000 shape:
 * `{ code: 11000, name: 'MongoServerError' }`. The integration test in
 * mongo-user-repository.spec.ts confirms this shape against a live instance.
 */
const makeE11000 = (): Error & { code: number } => {
  const err = new Error(
    'E11000 duplicate key error collection: penny.users index: telegramId_1 dup key',
  );
  return Object.assign(err, { code: 11000, name: 'MongoServerError' });
};

/**
 * Minimal document shape returned by `findOne` in the retry path.
 * Only the fields accessed by `UserMapper.toDomain` need to be present.
 */
const makeWinnerDoc = (telegramId: string) => ({
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  telegramId,
  firstName: 'Ada',
  lastName: 'Lovelace',
  username: 'ada',
  photoUrl: 'https://example.com/ada.png',
  status: UserStatus.PENDING,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('MongoUserRepository (unit — mocked model)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('findByUsername', () => {
    const makeUsernameDoc = (username: string) => ({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      telegramId: '123456789',
      firstName: 'Ada',
      username,
      status: UserStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('returns a mapped User when a document with the given username exists', async () => {
      // Arrange
      const username = 'ada_lovelace';
      const doc = makeUsernameDoc(username);

      const mockModel = {
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(doc),
        }),
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act
      const result = await repository.findByUsername(username);

      // Assert
      expect(result).toBeInstanceOf(User);
      expect(result?.telegramId).toBe('123456789');
      expect(mockModel.findOne).toHaveBeenCalledWith({ username });
    });

    it('returns null when no document with the given username exists', async () => {
      // Arrange
      const mockModel = {
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act
      const result = await repository.findByUsername('ghost_user');

      // Assert
      expect(result).toBeNull();
    });

    it('throws InfrastructureError when the driver throws', async () => {
      // Arrange
      const mockModel = {
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(new Error('topology closed')),
        }),
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act + Assert
      await expect(
        repository.findByUsername('any_user'),
      ).rejects.toBeInstanceOf(InfrastructureError);
    });
  });

  describe('delete', () => {
    it('returns undefined without calling the model when the id is not a valid ObjectId', async () => {
      // Arrange
      const findByIdAndDeleteSpy = vi.fn();
      const mockModel = {
        findByIdAndDelete: findByIdAndDeleteSpy,
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act
      const result = await repository.delete('not-a-valid-id');

      // Assert
      expect(findByIdAndDeleteSpy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('resolves to undefined when the driver call succeeds', async () => {
      // Arrange
      const validId = '507f1f77bcf86cd799439011';
      const findByIdAndDeleteSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      const mockModel = {
        findByIdAndDelete: findByIdAndDeleteSpy,
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act
      const result = await repository.delete(validId);

      // Assert
      expect(findByIdAndDeleteSpy).toHaveBeenCalledOnce();
      expect(findByIdAndDeleteSpy).toHaveBeenCalledWith(validId);
      expect(result).toBeUndefined();
    });

    it('wraps a driver error as InfrastructureError when the driver throws', async () => {
      // Arrange
      const validId = '507f1f77bcf86cd799439011';
      const mockModel = {
        findByIdAndDelete: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(new Error('network error')),
        }),
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act + Assert
      await expect(repository.delete(validId)).rejects.toBeInstanceOf(
        InfrastructureError,
      );
    });
  });

  describe('upsertByTelegramId — E11000 concurrent-insert retry path', () => {
    it("resolves to the winner's User when findOneAndUpdate throws E11000 and findOne finds the winner", async () => {
      // Arrange
      const telegramId = '123456789';
      const winnerDoc = makeWinnerDoc(telegramId);

      const mockModel = {
        findOneAndUpdate: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(makeE11000()),
        }),
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(winnerDoc),
        }),
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act
      const result = await repository.save(buildUser(telegramId));

      // Assert: the retry fallback returned the winner's document as a domain entity
      expect(result).toBeInstanceOf(User);
      expect(result.telegramId).toBe(telegramId);
      expect(result.id).toBe('507f1f77bcf86cd799439011');

      // Confirm the retry actually ran: findOneAndUpdate threw, then findOne was called
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledOnce();
      expect(mockModel.findOne).toHaveBeenCalledWith({ telegramId });
    });

    it('throws InfrastructureError with DUPLICATE_TELEGRAM_ID when E11000 fires but findOne also finds nothing', async () => {
      // Arrange — simulates an extremely narrow race where the winner document
      // disappears between the E11000 and the retry findOne (e.g. deleted).
      const telegramId = '987654321';

      const mockModel = {
        findOneAndUpdate: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(makeE11000()),
        }),
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act + Assert
      await expect(
        repository.save(buildUser(telegramId)),
      ).rejects.toBeInstanceOf(InfrastructureError);
    });

    it('wraps a findOne error during E11000 retry as InfrastructureError', async () => {
      const telegramId = 'retry-read-fails';
      const entity = buildUser(telegramId);

      const mockModel = {
        findOneAndUpdate: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue({
            code: 11000,
            name: 'MongoServerError',
            message: 'dup key',
          }),
        }),
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(new Error('topology closed')),
        }),
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      await expect(repository.save(entity)).rejects.toBeInstanceOf(
        InfrastructureError,
      );
    });

    it('throws InfrastructureError (not retrying) when findOneAndUpdate throws a non-driver error with code 11000', async () => {
      // `isMongoDriverError` requires BOTH a numeric `code` AND a recognised
      // driver name (`MongoServerError` | `MongoError`). An unrelated error
      // that coincidentally carries code 11000 must bypass the retry path
      // and be wrapped by `toInfrastructureError` instead.
      const coincidentalError = Object.assign(
        new Error('coincidental numeric code'),
        {
          code: 11000,
          name: 'SomeOtherError',
        },
      );

      const findOneSpy = vi.fn();
      const mockModel = {
        findOneAndUpdate: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(coincidentalError),
        }),
        findOne: findOneSpy,
      };

      vi.mocked(getUserModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof UserModel>,
      );

      const repository = new MongoUserRepository(FAKE_CONNECTION, silentLogger);

      // Act + Assert: wraps as InfrastructureError, does NOT call findOne
      await expect(
        repository.save(buildUser('111222333')),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(findOneSpy).not.toHaveBeenCalled();
    });
  });
});
