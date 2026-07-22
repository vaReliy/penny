import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose';
import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

/**
 * Typegoose schema for the `categories` collection. Mirrors the domain
 * `Category` entity's persisted fields (per `DECISIONS.md` ADR-007).
 * Mongoose's own `_id` is used as the document id and mapped to the domain
 * `id` (string) by {@link CategoryMapper} — `CategoryModel` itself never
 * appears outside `budget-infrastructure`.
 *
 * Two indexes:
 * - Unique `{workspaceId:1, name:1}`, case-insensitive (collation strength
 *   2), scoped to non-archived documents only via `partialFilterExpression`
 *   — a renamed/re-created category can reuse a name once the prior
 *   category holding it is archived.
 * - `{workspaceId:1, archivedAt:1}` — supports `findByWorkspace`'s
 *   archived/non-archived filter.
 */
@index(
  { workspaceId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    // MongoDB's partialFilterExpression grammar only supports `$exists:
    // true` (not `false`) — `{ archivedAt: null }` is the documented way to
    // match "absent or null" (per DECISIONS.md ADR-007), which is
    // equivalent here since the field is never explicitly set to null.
    partialFilterExpression: { archivedAt: null },
  },
)
@index({ workspaceId: 1, archivedAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'categories',
  },
})
export class CategoryModel {
  @prop({ required: true })
  public workspaceId!: string;

  @prop({ required: true })
  public name!: string;

  /** Soft-delete marker. Absent (not merely `undefined`) while active. */
  @prop()
  public archivedAt?: Date;
}

/**
 * Builds (or returns the cached) Typegoose model for {@link CategoryModel}
 * bound to the given Mongoose `connection`. Each distinct connection gets
 * its own model instance — Typegoose caches per-connection internally.
 */
export function getCategoryModel(
  connection: Connection,
): ReturnModelType<typeof CategoryModel> {
  return getModelForClass(CategoryModel, { existingConnection: connection });
}
