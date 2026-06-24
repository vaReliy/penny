import type { CurrencyCode } from './currency-code.js';
import type { SerializedMoney } from './money.types.js';

/**
 * Immutable money value object.
 *
 * Backed by a `bigint` count of minor units (e.g. cents for `USD`) — never
 * a floating point number — so arithmetic is always exact, regardless of
 * magnitude. Two `Money` values can only be combined when they share the
 * same `currency`; mixing currencies throws.
 */
export class Money {
  private readonly minorUnits: bigint;
  private readonly currencyCode: CurrencyCode;

  private constructor(minorUnits: bigint, currency: CurrencyCode) {
    this.minorUnits = minorUnits;
    this.currencyCode = currency;
  }

  /** Currency code shared by this value (e.g. `USD`). */
  public get currency(): CurrencyCode {
    return this.currencyCode;
  }

  /** Integer amount in minor units (e.g. cents) as a `bigint`. */
  public get amount(): bigint {
    return this.minorUnits;
  }

  /**
   * Creates a `Money` value from an integer (or `bigint`) amount of minor
   * units. Throws on non-integer `number` input to guarantee no float
   * arithmetic ever enters the value.
   */
  public static fromMinorUnits(
    amount: number | bigint,
    currency: CurrencyCode,
  ): Money {
    return new Money(Money.toBigInt(amount), Money.normalizeCurrency(currency));
  }

  /** Zero-value `Money` for the given currency. */
  public static zero(currency: CurrencyCode): Money {
    return Money.fromMinorUnits(0n, currency);
  }

  /** Rehydrates a `Money` value from its serialized (JSON-safe) shape. */
  public static fromJSON(serialized: SerializedMoney): Money {
    return Money.fromMinorUnits(BigInt(serialized.amount), serialized.currency);
  }

  /** Returns a new `Money` value equal to `this + other`. Currencies must match. */
  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currencyCode);
  }

  /** Returns a new `Money` value equal to `this - other`. Currencies must match. */
  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currencyCode);
  }

  /**
   * Compares `this` to `other`. Returns a negative number if `this < other`,
   * zero if equal, and a positive number if `this > other`. Currencies must match.
   */
  public compare(other: Money): number {
    this.assertSameCurrency(other);
    if (this.minorUnits === other.minorUnits) {
      return 0;
    }
    return this.minorUnits > other.minorUnits ? 1 : -1;
  }

  /** True when `this` and `other` have the same currency and amount. */
  public equals(other: Money): boolean {
    return (
      this.currencyCode === other.currencyCode &&
      this.minorUnits === other.minorUnits
    );
  }

  /** True when `this` is greater than `other`. Currencies must match. */
  public isGreaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  /** True when `this` is less than `other`. Currencies must match. */
  public isLessThan(other: Money): boolean {
    return this.compare(other) < 0;
  }

  /** True when the amount is exactly zero. */
  public isZero(): boolean {
    return this.minorUnits === 0n;
  }

  /** True when the amount is negative. */
  public isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  /** Serializes to a JSON-safe, transport-stable shape. Use `Money.fromJSON` to rehydrate. */
  public toJSON(): SerializedMoney {
    return {
      amount: this.minorUnits.toString(),
      currency: this.currencyCode,
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currencyCode !== other.currencyCode) {
      throw new Error(
        `Cannot operate on Money values with mismatched currencies: ${this.currencyCode} vs ${other.currencyCode}`,
      );
    }
  }

  private static normalizeCurrency(currency: CurrencyCode): CurrencyCode {
    const normalized = currency.trim().toUpperCase();
    if (normalized.length === 0) {
      throw new Error('Money currency code must not be empty.');
    }
    return normalized;
  }

  private static toBigInt(amount: number | bigint): bigint {
    if (typeof amount === 'bigint') {
      return amount;
    }
    if (!Number.isInteger(amount)) {
      throw new Error(
        `Money amount must be an integer number of minor units, received: ${amount}`,
      );
    }
    return BigInt(amount);
  }
}
