import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PieChartModule } from '@swimlane/ngx-charts';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';

/** One category's outcome total, already display-ready (major units, not `Money`). */
export interface HistoryChartEntry {
  readonly name: string;
  readonly value: number;
}

const TOOLTIP_LOCALE = 'uk-UA';

/**
 * Dumb presentational chart: a doughnut of per-category outcome totals.
 * Pure function of `data` — no store/HTTP access, per `type:ui`'s boundary.
 * Sizing intentionally omits ngx-charts' `[view]` input so the chart reads
 * its host container's dimensions instead of a hardcoded pixel size.
 */
@Component({
  selector: 'lib-history-chart',
  imports: [PieChartModule, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-chart.html',
  styleUrl: './history-chart.css',
})
export class HistoryChartComponent {
  public readonly data = input.required<readonly HistoryChartEntry[]>();

  protected readonly tooltipText = (entry: {
    data: HistoryChartEntry;
  }): string => {
    const formatted = new Intl.NumberFormat(TOOLTIP_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(entry.data.value);
    return `${entry.data.name}: ${formatted}`;
  };
}
