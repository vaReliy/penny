import { describe, expect, it } from 'vitest';
import { User, UserStatus } from 'identity-core';
import type { UserProps } from 'identity-core';
import { Role } from 'shared-contracts';

import { createInMemoryUserRepository } from './in-memory-user-repository.js';

function makeUser(overrides?: Partial<UserProps>): User {
  return new User({
    id: 'user-1',
    telegramId: 'tg-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    username: 'ada',
    photoUrl: 'https://example.com/ada.png',
    status: UserStatus.PENDING,
    roles: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

describe('createInMemoryUserRepository', () => {
  it('seed() inserts a user directly, retrievable via findById()', async () => {
    const repo = createInMemoryUserRepository();
    const user = makeUser();

    repo.seed(user);

    await expect(repo.findById('user-1')).resolves.toBe(user);
  });

  it('findById() returns null when no user with that id exists', async () => {
    const repo = createInMemoryUserRepository();

    await expect(repo.findById('missing')).resolves.toBeNull();
  });

  it('findByTelegramId() finds a seeded user by telegramId', async () => {
    const repo = createInMemoryUserRepository();
    const user = makeUser({ telegramId: 'tg-42' });
    repo.seed(user);

    await expect(repo.findByTelegramId('tg-42')).resolves.toBe(user);
  });

  it('findByTelegramId() returns null when no user has that telegramId', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ telegramId: 'tg-42' }));

    await expect(repo.findByTelegramId('not-there')).resolves.toBeNull();
  });

  it('findByUsername() finds a seeded user by username', async () => {
    const repo = createInMemoryUserRepository();
    const user = makeUser({ username: 'grace' });
    repo.seed(user);

    await expect(repo.findByUsername('grace')).resolves.toBe(user);
  });

  it('findByUsername() returns null when no user has that username', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ username: 'grace' }));

    await expect(repo.findByUsername('not-there')).resolves.toBeNull();
  });

  it('save() generates an id when entity.id is empty and persists the entity', async () => {
    const repo = createInMemoryUserRepository();
    const entity = makeUser({ id: '' });

    const saved = await repo.save(entity);

    expect(saved.id).toBe('generated-1');
    await expect(repo.findById('generated-1')).resolves.toEqual(saved);
  });

  it('save() generates sequentially increasing ids across multiple empty-id saves', async () => {
    const repo = createInMemoryUserRepository();

    const first = await repo.save(makeUser({ id: '' }));
    const second = await repo.save(makeUser({ id: '' }));

    expect(first.id).toBe('generated-1');
    expect(second.id).toBe('generated-2');
  });

  it('save() persists using the provided id when entity.id is non-empty', async () => {
    const repo = createInMemoryUserRepository();
    const entity = makeUser({ id: 'explicit-id' });

    const saved = await repo.save(entity);

    expect(saved.id).toBe('explicit-id');
    await expect(repo.findById('explicit-id')).resolves.toEqual(saved);
  });

  it('updateProfile() merges profile fields and never touches status', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(
      makeUser({ id: 'user-1', status: UserStatus.ACTIVE, username: 'old' }),
    );

    const updated = await repo.updateProfile('user-1', { username: 'new' });

    expect(updated?.username).toBe('new');
    expect(updated?.status).toBe(UserStatus.ACTIVE);
  });

  it('updateProfile() returns null when the id does not exist', async () => {
    const repo = createInMemoryUserRepository();

    await expect(
      repo.updateProfile('missing', { username: 'x' }),
    ).resolves.toBeNull();
  });

  it('updateStatus() succeeds without a CAS check when expectedCurrentStatus is omitted', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1', status: UserStatus.PENDING }));

    const updated = await repo.updateStatus('user-1', UserStatus.ACTIVE);

    expect(updated?.status).toBe(UserStatus.ACTIVE);
  });

  it('updateStatus() succeeds when expectedCurrentStatus matches the persisted status', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1', status: UserStatus.PENDING }));

    const updated = await repo.updateStatus(
      'user-1',
      UserStatus.ACTIVE,
      UserStatus.PENDING,
    );

    expect(updated?.status).toBe(UserStatus.ACTIVE);
  });

  it('updateStatus() returns null (CAS failure) when expectedCurrentStatus does not match', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1', status: UserStatus.ACTIVE }));

    const result = await repo.updateStatus(
      'user-1',
      UserStatus.REJECTED,
      UserStatus.PENDING,
    );

    expect(result).toBeNull();
    await expect(repo.findById('user-1')).resolves.toMatchObject({
      status: UserStatus.ACTIVE,
    });
  });

  it('updateStatus() returns null when the id does not exist', async () => {
    const repo = createInMemoryUserRepository();

    await expect(
      repo.updateStatus('missing', UserStatus.ACTIVE),
    ).resolves.toBeNull();
  });

  it('updateRoles() succeeds without a CAS check when expectedRoles is omitted', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1', roles: [] }));

    const updated = await repo.updateRoles('user-1', [Role.USER]);

    expect(updated?.roles).toEqual([Role.USER]);
  });

  it('updateRoles() succeeds when expectedRoles matches the persisted roles (same order)', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1', roles: [Role.USER, Role.SUPERADMIN] }));

    const updated = await repo.updateRoles(
      'user-1',
      [Role.SUPERADMIN],
      [Role.USER, Role.SUPERADMIN],
    );

    expect(updated?.roles).toEqual([Role.SUPERADMIN]);
  });

  it('updateRoles() returns null (CAS failure) when expectedRoles has a different length', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1', roles: [Role.USER] }));

    const result = await repo.updateRoles(
      'user-1',
      [Role.SUPERADMIN],
      [Role.USER, Role.SUPERADMIN],
    );

    expect(result).toBeNull();
    await expect(repo.findById('user-1')).resolves.toMatchObject({
      roles: [Role.USER],
    });
  });

  it('updateRoles() returns null (CAS failure) when expectedRoles has the same length but different order', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1', roles: [Role.USER, Role.SUPERADMIN] }));

    const result = await repo.updateRoles(
      'user-1',
      [Role.SUPERADMIN],
      [Role.SUPERADMIN, Role.USER],
    );

    expect(result).toBeNull();
  });

  it('updateRoles() returns null when the id does not exist', async () => {
    const repo = createInMemoryUserRepository();

    await expect(repo.updateRoles('missing', [Role.USER])).resolves.toBeNull();
  });

  it('delete() removes a seeded user so subsequent findById() returns null', async () => {
    const repo = createInMemoryUserRepository();
    repo.seed(makeUser({ id: 'user-1' }));

    await repo.delete('user-1');

    await expect(repo.findById('user-1')).resolves.toBeNull();
  });

  it('delete() is a no-op when the id does not exist', async () => {
    const repo = createInMemoryUserRepository();

    await expect(repo.delete('missing')).resolves.toBeUndefined();
  });
});
