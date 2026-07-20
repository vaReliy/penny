import { DomainError } from 'shared-errors';
import type { CurrencyCode } from 'shared-util';

/** Constructor input for {@link Account}. */
export interface AccountProps {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly currency: CurrencyCode;
  readonly createdAt: Date;
}

/**
 * A workspace-scoped account (aggregate root).
 *
 * Carries no stored balance — balance is derived by aggregating this
 * account's transactions (`Σ(income) − Σ(expense)`), never persisted here.
 * Immutable: there are currently no mutators; a future soft-delete
 * (`archivedAt`) would follow `Category`'s pattern and return a new
 * instance rather than mutate in place.
 */
export class Account {
  private readonly props: AccountProps;

  private constructor(props: AccountProps) {
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

  public get currency(): CurrencyCode {
    return this.props.currency;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Creates a new `Account`.
   *
   * @throws {DomainError} If `workspaceId`, `name`, or `currency` is blank.
   */
  public static create(
    id: string,
    workspaceId: string,
    name: string,
    currency: CurrencyCode,
    now: Date = new Date(),
  ): Account {
    const trimmedWorkspaceId = workspaceId.trim();
    if (trimmedWorkspaceId.length === 0) {
      throw DomainError.unprocessable('Account workspaceId must not be blank.');
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw DomainError.unprocessable('Account name must not be blank.');
    }

    const trimmedCurrency = currency.trim();
    if (trimmedCurrency.length === 0) {
      throw DomainError.unprocessable('Account currency must not be blank.');
    }

    return new Account({
      id,
      workspaceId: trimmedWorkspaceId,
      name: trimmedName,
      currency: trimmedCurrency,
      createdAt: now,
    });
  }
}
