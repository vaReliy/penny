import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import pino from 'pino';
import type { Connection } from 'mongoose';

import {
  createMongoConnection,
  disconnectMongoConnection,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { MongoWorkspaceRepository } from './mongo-workspace-repository.js';
import { generateTestDbName } from './test-db-name.js';

const silentLogger = pino({ level: 'silent' });

/**
 * Integration test: exercises `MongoWorkspaceRepository` against a real
 * MongoDB instance, proving the onion's persistence boundary holds
 * end-to-end.
 *
 * Runs locally: `docker compose up -d mongo` first (auth per `.env`
 * MONGO_USER/MONGO_PASSWORD), then set MONGO_TEST_URI and run this test.
 * Runs in CI: GitHub Actions job provides mongo:7 service container with MONGO_TEST_URI set.
 */
describe('MongoWorkspaceRepository (integration)', () => {
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
    dbName: generateTestDbName('penny-test'),
  };

  let connection: Connection;
  let repository: MongoWorkspaceRepository;

  const buildWorkspace = (): Workspace =>
    Workspace.create('The Family', 'admin-user-1', 'admin-user-1');

  const persistWorkspace = (): Promise<Workspace> =>
    repository.create(buildWorkspace());

  beforeAll(async () => {
    connection = await createMongoConnection(config);
    repository = new MongoWorkspaceRepository(connection, silentLogger);
  });

  afterEach(async () => {
    if (!connection) return;
    await connection.collection('workspaces').deleteMany({});
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await disconnectMongoConnection(connection);
  });

  it('AC-1: create then findById round-trips name, members, and version 0', async () => {
    const created = await repository.create(buildWorkspace());

    expect(created.id).not.toBe('');
    expect(created.version).toBe(0);

    const found = await repository.findById(created.id);

    expect(found).not.toBeNull();
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

  it('AC-2: save with the current version persists changes and increments version', async () => {
    const created = await persistWorkspace();
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

  it('AC-3: save with a stale version throws the conflict error and leaves the stored doc unchanged', async () => {
    const created = await persistWorkspace();
    const changed = created.addMember(
      'member-user-2',
      WorkspaceMemberRole.MEMBER,
      'admin-user-1',
    );
    await repository.save(changed); // advances stored version to 1

    // `created` still carries the stale version:0 snapshot.
    const staleUpdate = created.addMember(
      'member-user-3',
      WorkspaceMemberRole.MEMBER,
      'admin-user-1',
    );

    await expect(repository.save(staleUpdate)).rejects.toThrow();

    const reloaded = await repository.findById(created.id);
    expect(reloaded?.version).toBe(1);
    expect(reloaded?.members).toHaveLength(2);
  });

  it('save with a malformed id throws InfrastructureError, not a raw Mongoose CastError', async () => {
    const created = await persistWorkspace();
    const changed = created.addMember(
      'member-user-2',
      WorkspaceMemberRole.MEMBER,
      'admin-user-1',
    );
    const malformed = Object.create(
      Object.getPrototypeOf(changed),
      Object.getOwnPropertyDescriptors(changed),
    ) as Workspace;
    Object.defineProperty(malformed, 'id', { value: 'not-an-id' });

    await expect(repository.save(malformed)).rejects.toThrow(
      expect.not.objectContaining({ name: 'CastError' }),
    );
  });

  it('AC-4: findMembership returns the workspaceId/role/grantedAt for a member', async () => {
    const created = await persistWorkspace();

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

  it('AC-5: findMembership returns null for a non-member, a nonexistent id, and a malformed id — never throws', async () => {
    const created = await persistWorkspace();

    await expect(
      repository.findMembership(created.id, 'not-a-member'),
    ).resolves.toBeNull();
    await expect(
      repository.findMembership('64b7f3f3f3f3f3f3f3f3f3f3', 'admin-user-1'),
    ).resolves.toBeNull();
    await expect(
      repository.findMembership('not-an-id', 'admin-user-1'),
    ).resolves.toBeNull();
    // Right length (24 chars) but non-hex characters.
    await expect(
      repository.findMembership('zzzzzzzzzzzzzzzzzzzzzzzz', 'admin-user-1'),
    ).resolves.toBeNull();
  });

  it('findById returns null for a nonexistent valid ObjectId and malformed id variants — never throws', async () => {
    await expect(
      repository.findById('64b7f3f3f3f3f3f3f3f3f3f3'),
    ).resolves.toBeNull();
    await expect(repository.findById('not-an-id')).resolves.toBeNull();
    await expect(repository.findById('')).resolves.toBeNull();
    // Right length (24 chars) but non-hex characters — a plausible-looking
    // near-miss that a naive length-only check would wrongly accept.
    await expect(
      repository.findById('zzzzzzzzzzzzzzzzzzzzzzzz'),
    ).resolves.toBeNull();
  });

  it('AC-6: findByMemberUserId returns exactly the workspaces containing that user', async () => {
    const workspaceWithMember = await persistWorkspace();
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
});
