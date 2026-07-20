import { DomainError } from 'shared-errors';
import type { Money } from 'shared-util';

import { TransactionType } from 'budget-contracts';

/** Constructor input for {@link Transaction}. */
export interface TransactionProps {
  readonly id: string;
  readonly workspaceId: string;
  /** Required — attributed for per-account derived balance math. */
  readonly accountId: string;
  /** Required — tagged for analytics. */
  readonly categoryId: string;
  readonly type: TransactionType;
  /** Always positive; the sign is conveyed by `type`, never a negative amount. */
  readonly amount: Money;
  /** Economic date (e.g. purchase date) — drives `MonthlyBudget` month attribution. */
  readonly date: Date;
  readonly description?: string;
  /** `userId` of the caller who recorded this transaction (audit trail). */
  readonly createdBy: string;
  readonly createdAt: Date;
}

/**
 * A workspace-scoped ledger entry (aggregate root).
 *
 * Immutable at MVP: no edit/delete mutators (deferred to a later phase, see
 * ADR-007 §Transaction). No lifecycle/state machine — a transaction, once
 * recorded, has no status transitions.
 */
export class Transaction {
  private readonly props: TransactionProps;

  private constructor(props: TransactionProps) {
    this.props = props;
  }

  public get id(): string {
    return this.props.id;
  }

  public get workspaceId(): string {
    return this.props.workspaceId;
  }

  public get accountId(): string {
    return this.props.accountId;
  }

  public get categoryId(): string {
    return this.props.categoryId;
  }

  public get type(): TransactionType {
    return this.props.type;
  }

  public get amount(): Money {
    return this.props.amount;
  }

  public get date(): Date {
    return this.props.date;
  }

  public get description(): string | undefined {
    return this.props.description;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Creates a new `Transaction`.
   *
   * @throws {DomainError} If `workspaceId`, `accountId`, `categoryId`, or
   * `createdBy` is blank, or if `amount` is not strictly positive.
   */
  public static create(
    id: string,
    workspaceId: string,
    accountId: string,
    categoryId: string,
    type: TransactionType,
    amount: Money,
    date: Date,
    createdBy: string,
    description?: string,
    now: Date = new Date(),
  ): Transaction {
    const trimmedWorkspaceId = workspaceId.trim();
    if (trimmedWorkspaceId.length === 0) {
      throw DomainError.unprocessable(
        'Transaction workspaceId must not be blank.',
      );
    }

    const trimmedAccountId = accountId.trim();
    if (trimmedAccountId.length === 0) {
      throw DomainError.unprocessable(
        'Transaction accountId must not be blank.',
      );
    }

    const trimmedCategoryId = categoryId.trim();
    if (trimmedCategoryId.length === 0) {
      throw DomainError.unprocessable(
        'Transaction categoryId must not be blank.',
      );
    }

    const trimmedCreatedBy = createdBy.trim();
    if (trimmedCreatedBy.length === 0) {
      throw DomainError.unprocessable(
        'Transaction createdBy must not be blank.',
      );
    }

    if (amount.isNegative() || amount.isZero()) {
      throw DomainError.unprocessable(
        'Transaction amount must be greater than zero.',
      );
    }

    return new Transaction({
      id,
      workspaceId: trimmedWorkspaceId,
      accountId: trimmedAccountId,
      categoryId: trimmedCategoryId,
      type,
      amount,
      date,
      description,
      createdBy: trimmedCreatedBy,
      createdAt: now,
    });
  }
}
