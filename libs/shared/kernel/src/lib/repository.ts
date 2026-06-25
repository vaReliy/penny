/**
 * Generic, ORM-agnostic data access contract every repository implements.
 *
 * Kept intentionally minimal — no query builders, no ORM-specific types
 * (Prisma/TypeORM/Drizzle) may leak through this interface. Concrete
 * repositories (`type:infrastructure`) implement this against a specific
 * ORM; services and use cases (`type:core`/`type:application`) depend only
 * on this interface.
 *
 * @template TEntity - Domain entity shape returned/persisted by the repository.
 * @template TId - Identifier type for `TEntity` (e.g. `string` for UUIDs).
 */
export interface IRepository<TEntity, TId> {
  /** Finds a single entity by id, or `null` if no such entity exists. */
  findById(id: TId): Promise<TEntity | null>;

  /** Persists a new or updated entity and returns the persisted value. */
  save(entity: TEntity): Promise<TEntity>;

  /** Deletes the entity identified by `id`. No-op if it does not exist. */
  delete(id: TId): Promise<void>;
}
