import {
  AuthenticationError,
  DomainError,
  HttpStatus,
  NotFoundError,
} from 'shared-errors';
import { User, UserStatus } from 'identity-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { Role } from 'shared-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInMemoryUserRepository,
  type IInMemoryUserRepository,
} from 'identity-testing';

import {
  SUPERADMIN_ROLE,
  ApproveUserService,
  RejectUserService,
} from './set-user-status.service.js';

function buildPendingUser(id = 'user-1'): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id,
    telegramId: '123456789',
    firstName: 'Ada',
    status: UserStatus.PENDING,
    createdAt: now,
    updatedAt: now,
  });
}

function buildContext(caller: CallerIdentity | null): ServiceContext {
  return { config: {}, caller };
}

const ADMIN_CALLER: CallerIdentity = {
  userId: 'admin-1',
  status: UserStatus.ACTIVE,
  roles: [SUPERADMIN_ROLE],
};

const NON_ADMIN_CALLER: CallerIdentity = {
  userId: 'member-1',
  status: UserStatus.ACTIVE,
  roles: [Role.USER],
};

describe('ApproveUserService', () => {
  let repository: IInMemoryUserRepository;
  let service: ApproveUserService;

  beforeEach(() => {
    repository = createInMemoryUserRepository();
    service = new ApproveUserService({ userRepository: repository });
  });

  it('flips a pending user to active when called by an admin', async () => {
    const pending = buildPendingUser();
    repository.seed(pending);

    const outcome = await service.run(
      { userId: pending.id },
      buildContext(ADMIN_CALLER),
    );

    expect(outcome.data.status).toBe(UserStatus.ACTIVE);
    const persisted = await repository.findById(pending.id);
    expect(persisted?.status).toBe(UserStatus.ACTIVE);
  });

  it('throws AuthenticationError for a non-admin caller', async () => {
    const pending = buildPendingUser();
    repository.seed(pending);

    await expect(
      service.run({ userId: pending.id }, buildContext(NON_ADMIN_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when there is no caller at all', async () => {
    const pending = buildPendingUser();
    repository.seed(pending);

    await expect(
      service.run({ userId: pending.id }, buildContext(null)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws DomainError when approving an already-active user (illegal transition)', async () => {
    const active = buildPendingUser().approve();
    repository.seed(active);

    await expect(
      service.run({ userId: active.id }, buildContext(ADMIN_CALLER)),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('throws DomainError when approving an already-rejected user (illegal transition)', async () => {
    const rejected = buildPendingUser().reject();
    repository.seed(rejected);

    await expect(
      service.run({ userId: rejected.id }, buildContext(ADMIN_CALLER)),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('throws NotFoundError when the userId does not resolve to any user', async () => {
    await expect(
      service.run({ userId: 'missing' }, buildContext(ADMIN_CALLER)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('surfaces a 409 DomainError (not a silent overwrite) when a concurrent status change wins the CAS race', async () => {
    const pending = buildPendingUser();
    repository.seed(pending);

    // Simulate a concurrent admin action that already flipped the status
    // in the store between this test's read and its write, by rejecting the
    // user out from under the in-flight `service.run` call above the fake
    // repository's `updateStatus` layer.
    const updateStatusSpy = vi.spyOn(repository, 'updateStatus');
    updateStatusSpy.mockImplementationOnce(async () => null);

    const error = await service
      .run({ userId: pending.id }, buildContext(ADMIN_CALLER))
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(HttpStatus.CONFLICT);
    expect(updateStatusSpy).toHaveBeenCalledWith(
      pending.id,
      UserStatus.ACTIVE,
      UserStatus.PENDING,
    );

    // The user's status must remain untouched by the failed write — no
    // silent partial success.
    const stillPending = await repository.findById(pending.id);
    expect(stillPending?.status).toBe(UserStatus.PENDING);
  });
});

describe('RejectUserService', () => {
  let repository: IInMemoryUserRepository;
  let service: RejectUserService;

  beforeEach(() => {
    repository = createInMemoryUserRepository();
    service = new RejectUserService({ userRepository: repository });
  });

  it('flips a pending user to rejected when called by an admin', async () => {
    const pending = buildPendingUser();
    repository.seed(pending);

    const outcome = await service.run(
      { userId: pending.id },
      buildContext(ADMIN_CALLER),
    );

    expect(outcome.data.status).toBe(UserStatus.REJECTED);
  });

  it('throws AuthenticationError for a non-admin caller', async () => {
    const pending = buildPendingUser();
    repository.seed(pending);

    await expect(
      service.run({ userId: pending.id }, buildContext(NON_ADMIN_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws DomainError when rejecting an already-active user (illegal transition)', async () => {
    const active = buildPendingUser().approve();
    repository.seed(active);

    await expect(
      service.run({ userId: active.id }, buildContext(ADMIN_CALLER)),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
