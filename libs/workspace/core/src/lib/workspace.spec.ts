import { DomainError, DomainErrorKind } from 'shared-errors';
import { describe, expect, it } from 'vitest';

import { WorkspaceMemberRole } from './workspace-member-role.js';
import { Workspace } from './workspace.js';

const NOW = new Date('2026-09-24T00:00:00.000Z');

describe('Workspace', () => {
  describe('create', () => {
    it('seeds exactly one member with role admin', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(workspace.members).toHaveLength(1);
      expect(workspace.members[0]).toMatchObject({
        userId: 'user-1',
        role: WorkspaceMemberRole.ADMIN,
        grantedBy: 'user-1',
      });
      expect(workspace.adminUserIds()).toEqual(['user-1']);
    });
  });

  describe('addMember', () => {
    it('throws and leaves members unchanged when userId already exists', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(() =>
        workspace.addMember(
          'user-1',
          WorkspaceMemberRole.MEMBER,
          'user-1',
          NOW,
        ),
      ).toThrow(DomainError);
      try {
        workspace.addMember(
          'user-1',
          WorkspaceMemberRole.MEMBER,
          'user-1',
          NOW,
        );
      } catch (error) {
        expect((error as DomainError).kind).toBe(DomainErrorKind.CONFLICT);
      }
      expect(workspace.members).toHaveLength(1);
    });

    it('does not mutate the original instance', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      workspace.addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      expect(workspace.members).toHaveLength(1);
      expect(workspace.version).toBe(0);
    });

    it('adds a new member and bumps version', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      const updated = workspace.addMember(
        'user-2',
        WorkspaceMemberRole.MEMBER,
        'user-1',
        NOW,
      );

      expect(updated.members).toHaveLength(2);
      expect(updated.version).toBe(workspace.version + 1);
    });
  });

  describe('changeRole', () => {
    it('throws when demoting the only admin', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(() =>
        workspace.changeRole('user-1', WorkspaceMemberRole.MEMBER, NOW),
      ).toThrow(DomainError);
      try {
        workspace.changeRole('user-1', WorkspaceMemberRole.MEMBER, NOW);
      } catch (error) {
        expect((error as DomainError).kind).toBe(DomainErrorKind.FORBIDDEN);
      }
    });

    it('throws when demoting the last admin even while other non-admin members exist', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      expect(() =>
        workspace.changeRole('user-1', WorkspaceMemberRole.MEMBER, NOW),
      ).toThrow(DomainError);
    });

    it('succeeds demoting one of two admins, and the other remains admin', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.ADMIN, 'user-1', NOW);

      const updated = workspace.changeRole(
        'user-1',
        WorkspaceMemberRole.MEMBER,
        NOW,
      );

      expect(updated.adminUserIds()).toEqual(['user-2']);
    });

    it('is a no-op when changing to the current role', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      const result = workspace.changeRole(
        'user-1',
        WorkspaceMemberRole.ADMIN,
        NOW,
      );

      expect(result.version).toBe(workspace.version);
      expect(result.members).toEqual(workspace.members);
    });

    it('throws when userId is not a member', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(() =>
        workspace.changeRole('ghost', WorkspaceMemberRole.MEMBER, NOW),
      ).toThrow(DomainError);
      try {
        workspace.changeRole('ghost', WorkspaceMemberRole.MEMBER, NOW);
      } catch (error) {
        expect((error as DomainError).kind).toBe(DomainErrorKind.CONFLICT);
      }
    });

    it('is a no-op when a non-admin member changes to their current role', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      const result = workspace.changeRole(
        'user-2',
        WorkspaceMemberRole.MEMBER,
        NOW,
      );

      expect(result.version).toBe(workspace.version);
      expect(result.members).toEqual(workspace.members);
    });

    it('does not mutate the original instance', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      workspace.changeRole('user-2', WorkspaceMemberRole.ADMIN, NOW);

      expect(workspace.membershipOf('user-2')?.role).toBe(
        WorkspaceMemberRole.MEMBER,
      );
    });
  });

  describe('removeMember', () => {
    it('throws when removing the only admin', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(() => workspace.removeMember('user-1', NOW)).toThrow(DomainError);
      try {
        workspace.removeMember('user-1', NOW);
      } catch (error) {
        expect((error as DomainError).kind).toBe(DomainErrorKind.FORBIDDEN);
      }
    });

    it('throws when removing the last admin even while other non-admin members exist', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      expect(() => workspace.removeMember('user-1', NOW)).toThrow(DomainError);
    });

    it('throws when userId is not a member', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(() => workspace.removeMember('ghost', NOW)).toThrow(DomainError);
      try {
        workspace.removeMember('ghost', NOW);
      } catch (error) {
        expect((error as DomainError).kind).toBe(DomainErrorKind.CONFLICT);
      }
    });

    it('removes a non-last-admin member', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      const updated = workspace.removeMember('user-2', NOW);

      expect(updated.members).toHaveLength(1);
      expect(updated.isMember('user-2')).toBe(false);
    });

    it('does not mutate the original instance', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      workspace.removeMember('user-2', NOW);

      expect(workspace.members).toHaveLength(2);
      expect(workspace.isMember('user-2')).toBe(true);
    });
  });

  describe('isMember / isAdmin / membershipOf', () => {
    it('reflects membership and role state', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(workspace.isMember('user-1')).toBe(true);
      expect(workspace.isAdmin('user-1')).toBe(true);
      expect(workspace.isMember('ghost')).toBe(false);
      expect(workspace.membershipOf('user-1')?.role).toBe(
        WorkspaceMemberRole.ADMIN,
      );
      expect(workspace.membershipOf('ghost')).toBeUndefined();
    });

    it('reports isAdmin false for a non-admin member', () => {
      const workspace = Workspace.create(
        'Family',
        'user-1',
        'user-1',
        NOW,
      ).addMember('user-2', WorkspaceMemberRole.MEMBER, 'user-1', NOW);

      expect(workspace.isMember('user-2')).toBe(true);
      expect(workspace.isAdmin('user-2')).toBe(false);
    });

    it('reports isAdmin false for a non-member', () => {
      const workspace = Workspace.create('Family', 'user-1', 'user-1', NOW);

      expect(workspace.isAdmin('ghost')).toBe(false);
    });
  });
});
