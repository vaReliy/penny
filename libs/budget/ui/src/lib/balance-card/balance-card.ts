import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { Money } from 'shared-util';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';

import type { RateEntryDisplay } from '../rate-entry-display';
import { convertBalanceToCurrency } from '../convert-balance.util';
import { formatMoney } from '../format-money.util';

/** One row of the balance breakdown: a currency code and its formatted amount. */
interface BalanceRow {
  readonly currency: string;
  readonly formatted: string;
}

/**
 * Dumb presentational card: the account balance in its base currency plus a
 * breakdown converted into every currency `rates` names. Pure function of
 * its inputs — no store/HTTP access, per `type:ui`'s boundary.
 */
@Component({
  selector: 'lib-balance-card',
  imports: [TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './balance-card.html',
  styleUrl: './balance-card.css',
})
export class BalanceCardComponent {
  public readonly balance = input.required<Money>();
  public readonly rates = input<readonly RateEntryDisplay[]>([]);

  protected readonly isZero = computed(() => this.balance().amount === 0n);

  protected readonly rows = computed<readonly BalanceRow[]>(() => {
    const balance = this.balance();
    const baseRow: BalanceRow = {
      currency: balance.currency,
      formatted: formatMoney(balance),
    };
    const convertedRows = this.rates().map((rate) => ({
      currency: rate.currency,
      formatted: formatMoney(convertBalanceToCurrency(balance, rate)),
    }));
    return [baseRow, ...convertedRows];
  });
}
