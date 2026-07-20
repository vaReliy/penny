import type { IRepository } from 'shared-kernel';

import type { Category } from './category.js';

/**
 * Data access contract for {@link Category} aggregates. Extends the
 * kernel's generic {@link IRepository} (`findById`/`save`/`delete`) with
 * workspace-scoped lookups. Every finder takes `workspaceId`.
 */
export interface ICategoryRepository extends IRepository<Category, string> {
  /**
   * Finds all categories belonging to `workspaceId`. Archived categories
   * are excluded unless `includeArchived` is `true` (defaults to `false`).
   */
  findByWorkspace(
    workspaceId: string,
    includeArchived?: boolean,
  ): Promise<Category[]>;

  /** Finds a category by `id`, scoped to `workspaceId`, or `null` if none exists. */
  findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Category | null>;

  /**
   * Finds a non-archived category by `name` (case-insensitive), scoped to
   * `workspaceId`, or `null` if none exists. Used as the uniqueness-check
   * helper before creating a new category.
   */
  findByNameInWorkspace(
    name: string,
    workspaceId: string,
  ): Promise<Category | null>;

  /** Archives the category identified by `id`, scoped to `workspaceId`. */
  archive(id: string, workspaceId: string): Promise<void>;
}
