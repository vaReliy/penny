import type { DocumentType } from '@typegoose/typegoose';
import { describe, expect, it } from 'vitest';

import { Category } from 'budget-core';

import { CategoryMapper } from './category.mapper.js';
import type { CategoryModel } from './category.model.js';

/** Minimal hydrated-document shape `CategoryMapper.toDomain` reads from. */
function buildDoc(archivedAt?: Date): DocumentType<CategoryModel> {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    workspaceId: 'ws-1',
    name: 'Groceries',
    archivedAt,
  } as unknown as DocumentType<CategoryModel>;
}

describe('CategoryMapper', () => {
  describe('toDomain', () => {
    it('maps a non-archived document to a non-archived domain Category', () => {
      const category = CategoryMapper.toDomain(buildDoc());

      expect(category).toBeInstanceOf(Category);
      expect(category.id).toBe('507f1f77bcf86cd799439011');
      expect(category.workspaceId).toBe('ws-1');
      expect(category.name).toBe('Groceries');
      expect(category.archivedAt).toBeUndefined();
      expect(category.isArchived()).toBe(false);
    });

    it('maps an archived document to an archived domain Category, preserving the exact archivedAt', () => {
      const archivedAt = new Date('2026-06-15T12:00:00.000Z');

      const category = CategoryMapper.toDomain(buildDoc(archivedAt));

      expect(category.isArchived()).toBe(true);
      expect(category.archivedAt).toEqual(archivedAt);
    });
  });

  describe('toPersistence', () => {
    it('carries workspaceId and name, omitting archivedAt', () => {
      const category = Category.create('cat-1', 'ws-1', 'Groceries');

      const persistence = CategoryMapper.toPersistence(category);

      expect(persistence).toEqual({ workspaceId: 'ws-1', name: 'Groceries' });
      expect(Object.keys(persistence)).not.toContain('archivedAt');
    });
  });

  describe('toNamePersistenceUpdate', () => {
    it('scopes the update document to name only', () => {
      const update = CategoryMapper.toNamePersistenceUpdate('Utilities');

      expect(update).toEqual({ $set: { name: 'Utilities' } });
    });
  });

  describe('toArchivePersistenceUpdate', () => {
    it('scopes the update document to archivedAt only', () => {
      const archivedAt = new Date('2026-06-15T12:00:00.000Z');

      const update = CategoryMapper.toArchivePersistenceUpdate(archivedAt);

      expect(update).toEqual({ $set: { archivedAt } });
    });
  });
});
