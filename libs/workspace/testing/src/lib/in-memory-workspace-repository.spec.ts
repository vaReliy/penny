import { DomainError } from 'shared-errors';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import { describe, expect, it } from 'vitest';

import { createInMemoryWorkspaceRepository } from './in-memory-workspace-repository.js';

/**
 * Behavioral parity with `MongoWorkspaceRepository`'s integration spec
 * (AC-1…AC-6) — same scenarios, in-memory implementation (AC-8).
 */
describe('createInMemoryWorkspaceRepository', () => {
  const buildWorkspace = (): Workspace =>
    Workspace.create('The Family', 'admin-user-1', 'admin-user-1');

  it('AC-1/AC-8: create then findById round-trips name, members, and version 0', async () => {
    const repository = createInMemoryWorkspaceRepository();

    const created = await repository.create(buildWorkspace());

    expect(created.id).not.toBe('');
    expect(created.version).toBe(0);

    const found = await repository.findById(created.id);

    expect(found?.name).toBe('The Family');
    expect(found?.version).toBe(0);
    expect(found?.members).toEqual([
      {
        userId: 'admin-user-1',
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: created.members[0]?.grantedAt,
        grantedBy: 'admin-user-1',
      },
    ]);
  });

  it('AC-2/AC-8: save with the current version persists changes and increments version', async () => {
    const repository = createInMemoryWorkspaceRepository();
    const created = await repository.create(buildWorkspace());
    const changed = created.addMember(
      'member-user-2',
      WorkspaceMemberRole.MEMBER,
      'admin-user-1',
    );

    const saved = await repository.save(changed);

    expect(saved.version).toBe(1);
    expect(saved.members).toHaveLength(2);

    const reloaded = await repository.findById(created.id);
    expect(reloaded?.version).toBe(1);
    expect(reloaded?.members).toHaveLength(2);
  });

  it('AC-3/AC-8: save with a stale version throws the conflict error and leaves the stored doc unchanged', async () => {
    const repository = createInMemoryWorkspaceRepository();
    const created = await repository.create(buildWorkspace());
    const changed = created.addMember(
      'member-user-2',
      WorkspaceMemberRole.MEMBER,
      'admin-user-1',
    );
    await repository.save(changed);

    const staleUpdate = created.addMember(
      'member-user-3',
      WorkspaceMemberRole.MEMBER,
      'admin-user-1',
    );

    await expect(repository.save(staleUpdate)).rejects.toThrow(DomainError);

    const reloaded = await repository.findById(created.id);
    expect(reloaded?.version).toBe(1);
    expect(reloaded?.members).toHaveLength(2);
  });

  it('AC-4/AC-8: findMembership returns the workspaceId/role/grantedAt for a member', async () => {
    const repository = createInMemoryWorkspaceRepository();
    const created = await repository.create(buildWorkspace());

    const membership = await repository.findMembership(
      created.id,
      'admin-user-1',
    );

    expect(membership).toEqual({
      workspaceId: created.id,
      role: WorkspaceMemberRole.ADMIN,
      grantedAt: created.members[0]?.grantedAt,
    });
  });

  it('AC-5/AC-8: findMembership returns null for a non-member, a nonexistent id, and a malformed id — never throws', async () => {
    const repository = createInMemoryWorkspaceRepository();
    const created = await repository.create(buildWorkspace());

    await expect(
      repository.findMembership(created.id, 'not-a-member'),
    ).resolves.toBeNull();
    await expect(
      repository.findMembership('64b7f3f3f3f3f3f3f3f3f3f3', 'admin-user-1'),
    ).resolves.toBeNull();
    await expect(
      repository.findMembership('not-an-id', 'admin-user-1'),
    ).resolves.toBeNull();
    await expect(
      repository.findMembership('zzzzzzzzzzzzzzzzzzzzzzzz', 'admin-user-1'),
    ).resolves.toBeNull();
  });

  it('findById returns null for a nonexistent id and malformed id variants', async () => {
    const repository = createInMemoryWorkspaceRepository();

    await expect(
      repository.findById('64b7f3f3f3f3f3f3f3f3f3f3'),
    ).resolves.toBeNull();
    await expect(repository.findById('not-an-id')).resolves.toBeNull();
    await expect(repository.findById('')).resolves.toBeNull();
  });

  it('AC-6/AC-8: findByMemberUserId returns exactly the workspaces containing that user', async () => {
    const repository = createInMemoryWorkspaceRepository();
    const workspaceWithMember = await repository.create(buildWorkspace());
    await repository.create(
      Workspace.create('Someone Else', 'other-admin', 'other-admin'),
    );

    const found = await repository.findByMemberUserId('admin-user-1');

    expect(found.map((workspace) => workspace.id)).toEqual([
      workspaceWithMember.id,
    ]);
    expect(
      await repository.findByMemberUserId('someone-not-a-member'),
    ).toHaveLength(0);
  });

  it('seed() bypasses id generation for direct store population', async () => {
    const repository = createInMemoryWorkspaceRepository();
    const seeded = new Workspace({
      id: 'seeded-id',
      name: 'Seeded',
      members: [],
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    repository.seed(seeded);

    expect(await repository.findById('seeded-id')).not.toBeNull();
  });
});
