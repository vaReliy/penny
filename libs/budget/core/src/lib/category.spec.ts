import { describe, expect, it } from 'vitest';

import { Category } from './category.js';

const NOW = new Date('2026-07-01T00:00:00.000Z');

describe('Category', () => {
  describe('create', () => {
    it('creates a non-archived category', () => {
      const category = Category.create('cat-1', 'ws-1', 'Groceries');

      expect(category.id).toBe('cat-1');
      expect(category.workspaceId).toBe('ws-1');
      expect(category.name).toBe('Groceries');
      expect(category.archivedAt).toBeUndefined();
      expect(category.isArchived()).toBe(false);
    });

    it('trims whitespace from workspaceId and name', () => {
      const category = Category.create('cat-1', ' ws-1 ', ' Groceries ');

      expect(category.workspaceId).toBe('ws-1');
      expect(category.name).toBe('Groceries');
    });

    it('rejects a blank workspaceId', () => {
      expect(() => Category.create('cat-1', '  ', 'Groceries')).toThrow(
        /workspaceId must not be blank/i,
      );
    });

    it('rejects a blank name', () => {
      expect(() => Category.create('cat-1', 'ws-1', '  ')).toThrow(
        /name must not be blank/i,
      );
    });
  });

  describe('archive', () => {
    it('returns a new archived instance', () => {
      const category = Category.create('cat-1', 'ws-1', 'Groceries');

      const archived = category.archive(NOW);

      expect(archived.isArchived()).toBe(true);
      expect(archived.archivedAt).toEqual(NOW);
    });

    it('does not mutate the original instance', () => {
      const category = Category.create('cat-1', 'ws-1', 'Groceries');

      category.archive(NOW);

      expect(category.isArchived()).toBe(false);
    });

    it('defaults archivedAt to the current time when now is not provided', () => {
      const category = Category.create('cat-1', 'ws-1', 'Groceries');
      const before = Date.now();

      const archived = category.archive();

      const after = Date.now();
      expect(archived.archivedAt?.getTime()).toBeGreaterThanOrEqual(before);
      expect(archived.archivedAt?.getTime()).toBeLessThanOrEqual(after);
    });

    it('throws when the category is already archived', () => {
      const archived = Category.create('cat-1', 'ws-1', 'Groceries').archive(
        NOW,
      );

      expect(() => archived.archive(NOW)).toThrow(/already archived/i);
    });
  });
});
