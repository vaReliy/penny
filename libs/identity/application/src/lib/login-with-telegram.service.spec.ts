import { User, UserStatus } from 'identity-core';
import type { ServiceContext } from 'shared-kernel';
import type { TelegramLoginPayload } from 'shared-contracts';
import { InfrastructureError } from 'shared-errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInMemoryUserRepository,
  type IInMemoryUserRepository,
} from 'identity-testing';

import { LoginWithTelegramService } from './login-with-telegram.service.js';

const CONTEXT: ServiceContext = { config: {}, caller: null };

function buildPayload(
  overrides: Partial<TelegramLoginPayload> = {},
): TelegramLoginPayload {
  return {
    id: 123456789,
    firstName: 'Ada',
    lastName: 'Lovelace',
    username: 'ada',
    photoUrl: 'https://example.com/ada.png',
    authDate: Math.floor(Date.now() / 1000),
    hash: 'deadbeef',
    ...overrides,
  };
}

describe('LoginWithTelegramService', () => {
  let repository: IInMemoryUserRepository;
  let service: LoginWithTelegramService;

  beforeEach(() => {
    repository = createInMemoryUserRepository();
    service = new LoginWithTelegramService({ userRepository: repository });
  });

  it('creates a pending user for a never-before-seen telegram id', async () => {
    const payload = buildPayload();

    const outcome = await service.run(payload, CONTEXT);

    expect(outcome.data.status).toBe(UserStatus.PENDING);
    expect(outcome.data.user.telegramId).toBe(String(payload.id));
    expect(outcome.data.user.firstName).toBe('Ada');

    const persisted = await repository.findByTelegramId(String(payload.id));
    expect(persisted).not.toBeNull();
    expect(persisted?.id).not.toBe('');
  });

  it('does not create a duplicate user on a second login with the same telegram id', async () => {
    const payload = buildPayload();

    await service.run(payload, CONTEXT);
    await service.run(payload, CONTEXT);

    const persisted = await repository.findByTelegramId(String(payload.id));
    expect(persisted).not.toBeNull();
    // Only one record should exist for this telegramId — verified by
    // re-running login and confirming the same id is reused, not a new one.
    const firstId = persisted?.id;
    await service.run(payload, CONTEXT);
    const stillSame = await repository.findByTelegramId(String(payload.id));
    expect(stillSame?.id).toBe(firstId);
  });

  it('refreshes mutable profile fields for an existing telegram id, preserving status', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const existing = new User({
      id: 'existing-1',
      telegramId: '123456789',
      firstName: 'OldName',
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    repository.seed(existing);

    const payload = buildPayload({
      id: 123456789,
      firstName: 'NewName',
      username: 'newusername',
    });

    const outcome = await service.run(payload, CONTEXT);

    expect(outcome.data.user.id).toBe('existing-1');
    expect(outcome.data.user.firstName).toBe('NewName');
    expect(outcome.data.user.username).toBe('newusername');
    expect(outcome.data.status).toBe(UserStatus.ACTIVE);
  });

  it('does not mint a session token itself for a non-active user', async () => {
    const payload = buildPayload();

    const outcome = await service.run(payload, CONTEXT);

    // The result carries the User + status only — no token field exists on
    // LoginWithTelegramResult, so the interface layer cannot accidentally
    // forward a session for a pending user.
    expect(outcome.data).not.toHaveProperty('token');
    expect(outcome.data.status).not.toBe(UserStatus.ACTIVE);
  });

  it('rejects a payload missing required fields at the LIVR boundary', async () => {
    const payload = buildPayload();
    const { firstName, ...withoutFirstName } = payload;
    void firstName;

    await expect(
      service.run(withoutFirstName as TelegramLoginPayload, CONTEXT),
    ).rejects.toThrow();
  });

  it('does not overwrite status when refreshing profile (concurrent login + approval safety)', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const active = new User({
      id: 'active-1',
      telegramId: '555666777',
      firstName: 'OldName',
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    repository.seed(active);

    const payload = buildPayload({ id: 555666777, firstName: 'NewName' });
    const outcome = await service.run(payload, CONTEXT);

    expect(outcome.data.user.status).toBe(UserStatus.ACTIVE);
    expect(outcome.data.user.firstName).toBe('NewName');
    expect(outcome.data.status).toBe(UserStatus.ACTIVE);
  });

  it('throws InfrastructureError when the profile update race-loses (user deleted mid-flight)', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const existing = new User({
      id: 'existing-1',
      telegramId: '123456789',
      firstName: 'OldName',
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    repository.seed(existing);

    // Simulate a concurrent deletion between this service's
    // `findByTelegramId` read and its `updateProfile` write, by forcing the
    // fake repository's `updateProfile` to report "no longer found" for this
    // one call, mirroring the CAS-spy pattern used for `updateStatus`.
    vi.spyOn(repository, 'updateProfile').mockImplementationOnce(
      async () => null,
    );

    const payload = buildPayload({ id: 123456789 });

    await expect(service.run(payload, CONTEXT)).rejects.toBeInstanceOf(
      InfrastructureError,
    );
  });

  describe('LIVR max_length boundary validation on profile fields', () => {
    it('accepts a firstName at exactly 100 chars (max_length boundary)', async () => {
      const payload = buildPayload({ firstName: 'a'.repeat(100) });

      const outcome = await service.run(payload, CONTEXT);

      expect(outcome.data.user.firstName).toBe('a'.repeat(100));
    });

    it('rejects a firstName at 101 chars (over max_length boundary)', async () => {
      const payload = buildPayload({ firstName: 'a'.repeat(101) });

      await expect(service.run(payload, CONTEXT)).rejects.toThrow();
    });

    it('accepts a lastName at exactly 50 chars (max_length boundary)', async () => {
      const payload = buildPayload({ lastName: 'b'.repeat(50) });

      const outcome = await service.run(payload, CONTEXT);

      expect(outcome.data.user.lastName).toBe('b'.repeat(50));
    });

    it('rejects a lastName at 51 chars (over max_length boundary)', async () => {
      const payload = buildPayload({ lastName: 'b'.repeat(51) });

      await expect(service.run(payload, CONTEXT)).rejects.toThrow();
    });

    it('accepts a username at exactly 50 chars (max_length boundary)', async () => {
      const payload = buildPayload({ username: 'c'.repeat(50) });

      const outcome = await service.run(payload, CONTEXT);

      expect(outcome.data.user.username).toBe('c'.repeat(50));
    });

    it('rejects a username at 51 chars (over max_length boundary)', async () => {
      const payload = buildPayload({ username: 'c'.repeat(51) });

      await expect(service.run(payload, CONTEXT)).rejects.toThrow();
    });

    it('accepts a photoUrl at exactly 2048 chars (max_length boundary)', async () => {
      const payload = buildPayload({ photoUrl: 'd'.repeat(2048) });

      const outcome = await service.run(payload, CONTEXT);

      expect(outcome.data.user.photoUrl).toBe('d'.repeat(2048));
    });

    it('rejects a photoUrl at 2049 chars (over max_length boundary)', async () => {
      const payload = buildPayload({ photoUrl: 'd'.repeat(2049) });

      await expect(service.run(payload, CONTEXT)).rejects.toThrow();
    });
  });
});
