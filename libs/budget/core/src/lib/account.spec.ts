import { describe, expect, it } from 'vitest';

import { Account } from './account.js';

const NOW = new Date('2026-07-01T00:00:00.000Z');

describe('Account', () => {
  describe('create', () => {
    it('creates an account with the given fields', () => {
      const account = Account.create('acc-1', 'ws-1', 'Cash', 'UAH', NOW);

      expect(account.id).toBe('acc-1');
      expect(account.workspaceId).toBe('ws-1');
      expect(account.name).toBe('Cash');
      expect(account.currency).toBe('UAH');
      expect(account.createdAt).toEqual(NOW);
    });

    it('trims whitespace from workspaceId, name, and currency', () => {
      const account = Account.create('acc-1', ' ws-1 ', ' Cash ', ' UAH ', NOW);

      expect(account.workspaceId).toBe('ws-1');
      expect(account.name).toBe('Cash');
      expect(account.currency).toBe('UAH');
    });

    it('defaults createdAt to the current time when now is not provided', () => {
      const before = Date.now();

      const account = Account.create('acc-1', 'ws-1', 'Cash', 'UAH');

      const after = Date.now();
      expect(account.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(account.createdAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('rejects a blank workspaceId', () => {
      expect(() => Account.create('acc-1', '  ', 'Cash', 'UAH', NOW)).toThrow(
        /workspaceId must not be blank/i,
      );
    });

    it('rejects a blank name', () => {
      expect(() => Account.create('acc-1', 'ws-1', '  ', 'UAH', NOW)).toThrow(
        /name must not be blank/i,
      );
    });

    it('rejects a blank currency', () => {
      expect(() => Account.create('acc-1', 'ws-1', 'Cash', '  ', NOW)).toThrow(
        /currency must not be blank/i,
      );
    });
  });
});
