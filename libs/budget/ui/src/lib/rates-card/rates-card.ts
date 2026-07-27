import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';

import type { RateEntryDisplay } from '../rate-entry-display';

/**
 * Dumb presentational card: the FX rates table plus a refresh action. Pure
 * function of its inputs, emits `refresh` on button click — the caller
 * (`budget-feature-account`) owns the actual HTTP re-fetch, per `type:ui`'s
 * boundary (no store/HTTP access here).
 */
@Component({
  selector: 'lib-rates-card',
  imports: [DatePipe, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rates-card.html',
  styleUrl: './rates-card.css',
})
export class RatesCardComponent {
  public readonly rates = input.required<readonly RateEntryDisplay[]>();
  public readonly fetchedAt = input.required<Date>();
  /** True while a refresh request is in flight — disables the button and swaps its label. */
  public readonly refreshing = input(false);

  public readonly refresh = output<void>();

  protected onRefreshClick(): void {
    this.refresh.emit();
  }
}
