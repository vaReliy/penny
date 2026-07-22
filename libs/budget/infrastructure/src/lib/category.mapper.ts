import type { DocumentType } from '@typegoose/typegoose';

import { Category } from 'budget-core';

import type { CategoryModel } from './category.model.js';

/**
 * Plain persistence shape accepted by {@link MongoCategoryRepository} when
 * creating a document. Mirrors {@link CategoryModel}'s own fields (minus
 * Mongoose/Typegoose machinery) so callers outside this file never need to
 * reference Mongoose types.
 */
export interface CategoryPersistence {
  readonly workspaceId: string;
  readonly name: string;
}

/** `$set`-only update document scoped to the `name` field (rename). */
export interface CategoryNamePersistenceUpdate {
  readonly $set: Pick<CategoryPersistence, 'name'>;
}

/** `$set`-only update document scoped to the `archivedAt` field. */
export interface CategoryArchivePersistenceUpdate {
  readonly $set: { readonly archivedAt: Date };
}

/**
 * Translates between the domain `Category` entity and the Typegoose
 * `CategoryModel` persistence shape. Mongoose/Typegoose/BSON types are
 * confined to this file (and `category.model.ts`) — nothing leaks past
 * `MongoCategoryRepository`'s public surface, which only returns `Category`
 * domain entities.
 *
 * `Category`'s constructor is private — rehydration goes through its public
 * factories only: `Category.create(...)` for the base (non-archived) shape,
 * then `.archive(archivedAt)` when the persisted document is archived. This
 * reproduces the exact persisted `archivedAt` timestamp rather than
 * stamping a new one.
 */
export const CategoryMapper = {
  /** Converts a hydrated Mongoose document into a domain `Category` entity. */
  toDomain(doc: DocumentType<CategoryModel>): Category {
    const category = Category.create(
      doc._id.toString(),
      doc.workspaceId,
      doc.name,
    );
    return doc.archivedAt ? category.archive(doc.archivedAt) : category;
  },

  /** Converts a domain `Category` entity into the plain persistence shape. */
  toPersistence(category: Category): CategoryPersistence {
    return {
      workspaceId: category.workspaceId,
      name: category.name,
    };
  },

  /**
   * Converts a `name` value into a `$set` update document scoped exclusively
   * to that field. `workspaceId` and `archivedAt` are structurally absent
   * from the returned document, so a `findOneAndUpdate` call using this
   * output can never overwrite them.
   */
  toNamePersistenceUpdate(name: string): CategoryNamePersistenceUpdate {
    return { $set: { name } };
  },

  /**
   * Converts an `archivedAt` value into a `$set` update document scoped
   * exclusively to that field. `workspaceId` and `name` are structurally
   * absent from the returned document, so a `findOneAndUpdate` call using
   * this output can never overwrite them.
   */
  toArchivePersistenceUpdate(
    archivedAt: Date,
  ): CategoryArchivePersistenceUpdate {
    return { $set: { archivedAt } };
  },
};
