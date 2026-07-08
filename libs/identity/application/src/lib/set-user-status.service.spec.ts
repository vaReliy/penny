import { AuthenticationError, DomainError, NotFoundError } from 'shared-errors';
import { User, UserStatus } from 'identity-core';
import type { IUserRepository, UserProfileUpdate } from 'identity-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { Role } from 'shared-contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ADMIN_ROLE,
  ApproveUserService,
  RejectUserService,
} from './set-user-status.service.js';

/** In-memory `IUserRepository` fake, keyed by `id`. */
class FakeUserRepository implements IUserRepository {
  private readonly usersById = new Map<string, User>();

  public seed(user: User): void {
    this.usersById.set(user.id, user);
  }

  public async findById(id: string): Promise<User | null> {
    return this.usersById.get(id) ?? null;
  }

  public async findByTelegramId(telegramId: string): Promise<User | null> {
    for (const user of this.usersById.values()) {
      if (user.telegramId === telegramId) {
        return user;
      }
    }
    return null;
  }

  public async findByUsername(username: string): Promise<User | null> {
    for (const user of this.usersById.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  public async updateProfile(
    _id: string,
    _profile: Partial<UserProfileUpdate>,
  ): Promise<User | null> {
    return null;
  }

  public async save(entity: User): Promise<User> {
    this.usersById.set(entity.id, entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    this.usersById.delete(id);
  }
}

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
  roles: [ADMIN_ROLE],
};

const NON_ADMIN_CALLER: CallerIdentity = {
  userId: 'member-1',
  status: UserStatus.ACTIVE,
  roles: [Role.USER],
};

describe('ApproveUserService', () => {
  let repository: FakeUserRepository;
  let service: ApproveUserService;

  beforeEach(() => {
    repository = new FakeUserRepository();
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
});

describe('RejectUserService', () => {
  let repository: FakeUserRepository;
  let service: RejectUserService;

  beforeEach(() => {
    repository = new FakeUserRepository();
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
