import { DomainError } from 'shared-errors';
import { MONTH_PATTERN as MONTH_PATTERN_STRING } from 'shared-util';
import type { Money } from 'shared-util';

/** Matches a `'YYYY-MM'` calendar month, e.g. `'2026-07'`. */
const MONTH_PATTERN = new RegExp(MONTH_PATTERN_STRING);

/** Constructor input for {@link MonthlyBudget}. */
export interface MonthlyBudgetProps {
  readonly id: string;
  readonly workspaceId: string;
  readonly categoryId: string;
  /** Calendar month this budget targets, `'YYYY-MM'`. */
  readonly month: string;
  /** Ceiling target for expense spending in this category/month. */
  readonly amount: Money;
}

/**
 * A workspace-scoped spending ceiling for one category in one calendar
 * month (aggregate root). Unique per `(workspaceId, categoryId, month)` —
 * enforced by the repository/persistence layer, not this entity.
 *
 * Applies to expense only — income transactions are never compared to a
 * budget. "Monthly" is permanent: non-monthly periods (weekly, yearly,
 * savings goals) become new aggregates, never a field addition here. No
 * lifecycle — budgets exist, are upserted, or deleted; no approval/draft
 * states.
 */
export class MonthlyBudget {
  private readonly props: MonthlyBudgetProps;

  private constructor(props: MonthlyBudgetProps) {
    this.props = props;
  }

  public get id(): string {
    return this.props.id;
  }

  public get workspaceId(): string {
    return this.props.workspaceId;
  }

  public get categoryId(): string {
    return this.props.categoryId;
  }

  public get month(): string {
    return this.props.month;
  }

  public get amount(): Money {
    return this.props.amount;
  }

  /**
   * Creates a new `MonthlyBudget`.
   *
   * @throws {DomainError} If `workspaceId` or `categoryId` is blank, `month`
   * is not `'YYYY-MM'`, or `amount` is not strictly positive.
   */
  public static create(
    id: string,
    workspaceId: string,
    categoryId: string,
    month: string,
    amount: Money,
  ): MonthlyBudget {
    const trimmedWorkspaceId = workspaceId.trim();
    if (trimmedWorkspaceId.length === 0) {
      throw DomainError.unprocessable(
        'MonthlyBudget workspaceId must not be blank.',
      );
    }

    const trimmedCategoryId = categoryId.trim();
    if (trimmedCategoryId.length === 0) {
      throw DomainError.unprocessable(
        'MonthlyBudget categoryId must not be blank.',
      );
    }

    if (!MONTH_PATTERN.test(month)) {
      throw DomainError.unprocessable(
        `MonthlyBudget month must be in "YYYY-MM" format, received: "${month}".`,
      );
    }

    if (amount.isNegative() || amount.isZero()) {
      throw DomainError.unprocessable(
        'MonthlyBudget amount must be greater than zero.',
      );
    }

    return new MonthlyBudget({
      id,
      workspaceId: trimmedWorkspaceId,
      categoryId: trimmedCategoryId,
      month,
      amount,
    });
  }
}
