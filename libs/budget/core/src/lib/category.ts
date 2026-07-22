import { DomainError } from 'shared-errors';

/** Constructor input for {@link Category}. */
export interface CategoryProps {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  /** Soft-delete marker. `undefined` while active. */
  readonly archivedAt?: Date;
}

/**
 * A workspace-scoped, type-agnostic transaction tag (aggregate root).
 *
 * No `income`/`expense` field — both transaction types may reference the
 * same category freely; classification is left to the user. Archiving is
 * one-way soft-delete: it hides the category from selection UIs but never
 * from historical aggregation queries (`sumExpenseByCategory` still
 * includes archived tags). Unarchive is intentionally not supported.
 */
export class Category {
  private readonly props: CategoryProps;

  private constructor(props: CategoryProps) {
    this.props = props;
  }

  public get id(): string {
    return this.props.id;
  }

  public get workspaceId(): string {
    return this.props.workspaceId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get archivedAt(): Date | undefined {
    return this.props.archivedAt;
  }

  /** True once the category has been archived. */
  public isArchived(): boolean {
    return this.props.archivedAt !== undefined;
  }

  /**
   * Creates a new, non-archived `Category`.
   *
   * @throws {DomainError} If `workspaceId` or `name` is blank.
   */
  public static create(
    id: string,
    workspaceId: string,
    name: string,
  ): Category {
    const trimmedWorkspaceId = workspaceId.trim();
    if (trimmedWorkspaceId.length === 0) {
      throw DomainError.unprocessable(
        'Category workspaceId must not be blank.',
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw DomainError.unprocessable('Category name must not be blank.');
    }

    return new Category({
      id,
      workspaceId: trimmedWorkspaceId,
      name: trimmedName,
    });
  }

  /**
   * Returns a new, archived `Category`.
   *
   * @throws {DomainError} If the category is already archived.
   */
  public archive(now: Date = new Date()): Category {
    if (this.isArchived()) {
      throw DomainError.conflict(
        `Category "${this.props.id}" is already archived.`,
      );
    }

    return new Category({ ...this.props, archivedAt: now });
  }

  /**
   * Returns a new `Category` with `name` replaced, preserving `id`,
   * `workspaceId`, and `archivedAt` as-is. Mutator, not a mutation: the
   * receiver is left untouched, matching `archive()`'s immutable style.
   *
   * @throws {DomainError} If `name` is blank.
   */
  public rename(name: string): Category {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw DomainError.unprocessable('Category name must not be blank.');
    }

    return new Category({ ...this.props, name: trimmedName });
  }
}
