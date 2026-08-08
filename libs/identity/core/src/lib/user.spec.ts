import { describe, expect, it } from 'vitest';

import { User, type UserProps } from './user.js';
import { UserStatus } from './user-status.js';

const baseProps = (overrides: Partial<UserProps> = {}): UserProps => ({
  id: 'user-1',
  telegramId: '123456789',
  status: UserStatus.PENDING,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('User', () => {
  describe('accessors', () => {
    it('exposes all identity and profile properties', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-02-01T12:00:00.000Z');
      const user = new User(
        baseProps({
          id: 'user-42',
          telegramId: '9876543210',
          firstName: 'John',
          lastName: 'Doe',
          username: 'johndoe',
          photoUrl: 'https://example.com/photo.jpg',
          status: UserStatus.ACTIVE,
          createdAt,
          updatedAt,
          roles: ['superadmin'],
        }),
      );

      expect(user.id).toBe('user-42');
      expect(user.telegramId).toBe('9876543210');
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.username).toBe('johndoe');
      expect(user.photoUrl).toBe('https://example.com/photo.jpg');
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.createdAt).toEqual(createdAt);
      expect(user.updatedAt).toEqual(updatedAt);
      expect(user.roles).toEqual(['superadmin']);
    });

    it('handles optional profile fields correctly', () => {
      const user = new User(baseProps({}));

      expect(user.firstName).toBeUndefined();
      expect(user.lastName).toBeUndefined();
      expect(user.username).toBeUndefined();
      expect(user.photoUrl).toBeUndefined();
    });

    it('normalizes roles to empty array when not provided', () => {
      const user = new User(baseProps({ roles: undefined }));

      expect(user.roles).toEqual([]);
    });
  });

  describe('canLogin', () => {
    it('returns true only when status is active', () => {
      const active = new User(baseProps({ status: UserStatus.ACTIVE }));
      const pending = new User(baseProps({ status: UserStatus.PENDING }));
      const rejected = new User(baseProps({ status: UserStatus.REJECTED }));

      expect(active.canLogin()).toBe(true);
      expect(pending.canLogin()).toBe(false);
      expect(rejected.canLogin()).toBe(false);
    });
  });

  describe('isActive / isPending / isRejected', () => {
    it('reflects the current status', () => {
      const active = new User(baseProps({ status: UserStatus.ACTIVE }));
      expect(active.isActive()).toBe(true);
      expect(active.isPending()).toBe(false);
      expect(active.isRejected()).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('allows pending -> active', () => {
      const pending = new User(baseProps({ status: UserStatus.PENDING }));

      const result = pending.approve();

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(result.canLogin()).toBe(true);
    });

    it('allows pending -> rejected', () => {
      const pending = new User(baseProps({ status: UserStatus.PENDING }));

      const result = pending.reject();

      expect(result.status).toBe(UserStatus.REJECTED);
    });

    it('forbids active -> pending', () => {
      const active = new User(baseProps({ status: UserStatus.ACTIVE }));

      expect(() => active.transitionTo(UserStatus.PENDING)).toThrow(
        /cannot transition user/i,
      );
    });

    it('forbids active -> rejected', () => {
      const active = new User(baseProps({ status: UserStatus.ACTIVE }));

      expect(() => active.transitionTo(UserStatus.REJECTED)).toThrow(
        /cannot transition user/i,
      );
    });

    it('forbids rejected -> active', () => {
      const rejected = new User(baseProps({ status: UserStatus.REJECTED }));

      expect(() => rejected.transitionTo(UserStatus.ACTIVE)).toThrow(
        /cannot transition user/i,
      );
    });

    it('forbids rejected -> pending', () => {
      const rejected = new User(baseProps({ status: UserStatus.REJECTED }));

      expect(() => rejected.transitionTo(UserStatus.PENDING)).toThrow(
        /cannot transition user/i,
      );
    });

    it('reports canTransitionTo without throwing', () => {
      const pending = new User(baseProps({ status: UserStatus.PENDING }));
      const active = new User(baseProps({ status: UserStatus.ACTIVE }));

      expect(pending.canTransitionTo(UserStatus.ACTIVE)).toBe(true);
      expect(pending.canTransitionTo(UserStatus.REJECTED)).toBe(true);
      expect(active.canTransitionTo(UserStatus.REJECTED)).toBe(false);
    });

    it('forbids transitioning to the same status (pending -> pending)', () => {
      const pending = new User(baseProps({ status: UserStatus.PENDING }));

      expect(pending.canTransitionTo(UserStatus.PENDING)).toBe(false);
      expect(() => pending.transitionTo(UserStatus.PENDING)).toThrow(
        /cannot transition user/i,
      );
    });

    it('forbids transitioning a terminal status to itself (active -> active, rejected -> rejected)', () => {
      const active = new User(baseProps({ status: UserStatus.ACTIVE }));
      const rejected = new User(baseProps({ status: UserStatus.REJECTED }));

      expect(active.canTransitionTo(UserStatus.ACTIVE)).toBe(false);
      expect(rejected.canTransitionTo(UserStatus.REJECTED)).toBe(false);
    });

    it('does not mutate the original instance (immutable transitions)', () => {
      const pending = new User(baseProps({ status: UserStatus.PENDING }));

      pending.approve();

      expect(pending.status).toBe(UserStatus.PENDING);
    });

    it('updates updatedAt on a successful transition', () => {
      const pending = new User(baseProps({ status: UserStatus.PENDING }));
      const now = new Date('2026-06-25T12:00:00.000Z');

      const result = pending.approve(now);

      expect(result.updatedAt).toEqual(now);
    });
  });

  describe('updateProfile', () => {
    it('merges mutable profile fields without changing the identity key or status', () => {
      const user = new User(baseProps({ status: UserStatus.ACTIVE }));

      const updated = user.updateProfile({ firstName: 'Ada', username: 'ada' });

      expect(updated.firstName).toBe('Ada');
      expect(updated.username).toBe('ada');
      expect(updated.telegramId).toBe(user.telegramId);
      expect(updated.status).toBe(user.status);
    });

    it('is permitted regardless of status (pending and rejected users can update their profile)', () => {
      const pending = new User(baseProps({ status: UserStatus.PENDING }));
      const rejected = new User(baseProps({ status: UserStatus.REJECTED }));

      const updatedPending = pending.updateProfile({ firstName: 'Ada' });
      const updatedRejected = rejected.updateProfile({ firstName: 'Ada' });

      expect(updatedPending.firstName).toBe('Ada');
      expect(updatedPending.status).toBe(UserStatus.PENDING);
      expect(updatedRejected.firstName).toBe('Ada');
      expect(updatedRejected.status).toBe(UserStatus.REJECTED);
    });

    it('does not mutate the original instance (immutable update)', () => {
      const user = new User(baseProps({ firstName: 'Original' }));

      user.updateProfile({ firstName: 'Changed' });

      expect(user.firstName).toBe('Original');
    });

    it('bumps updatedAt even when no fields are provided', () => {
      const user = new User(baseProps());
      const now = new Date('2026-06-25T12:00:00.000Z');

      const updated = user.updateProfile({}, now);

      expect(updated.updatedAt).toEqual(now);
      expect(updated.firstName).toBe(user.firstName);
    });

    it('defaults updatedAt to the current time when now is not provided', () => {
      const user = new User(baseProps());
      const before = Date.now();

      const updated = user.updateProfile({ firstName: 'Ada' });

      const after = Date.now();
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated.updatedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
