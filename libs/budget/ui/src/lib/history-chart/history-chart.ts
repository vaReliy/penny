import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { PieChartModule } from '@swimlane/ngx-charts';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';

/** One category's outcome total, already display-ready (major units, not `Money`). */
export interface HistoryChartEntry {
  readonly name: string;
  readonly value: number;
}

const TOOLTIP_LOCALE = 'uk-UA';

/**
 * Explicit categorical palette for the doughnut chart's per-category
 * slices/legend swatches. ngx-charts' built-in schemes (e.g. `aqua`) can
 * produce near-identical pale shades against this app's dark surface —
 * these hues are chosen to stay clearly distinguishable from each other and
 * from `--color-surface`/`--color-background` (see `code-style-angular.md`
 * dark design tokens). Cycled by category index, so two categories only
 * ever collide once the count exceeds the palette length.
 */
const CHART_PALETTE: readonly string[] = [
  '#60a5fa', // blue-400
  '#f472b6', // pink-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#a78bfa', // violet-400
  '#fb923c', // orange-400
  '#22d3ee', // cyan-400
  '#f87171', // red-400
];

/**
 * Dumb presentational chart: a doughnut of per-category outcome totals.
 * Pure function of `data` — no store/HTTP access, per `type:ui`'s boundary.
 *
 * No `[view]` input is bound: ngx-charts' `BaseChartComponent.getContainerDims()`
 * measures `getBoundingClientRect()` of the chart element's own *parent*
 * (`#chartHost` in the template) when `[view]` is unset, so giving that
 * parent an explicit, breakpoint-scaled height in CSS (`h-56 sm:h-64
 * lg:h-72`) is sufficient for a correct, deterministic ring size at every
 * viewport — no `ResizeObserver` required; ngx-charts re-measures on the
 * browser's native `resize` event, which fires when a breakpoint's media
 * query flips the height class too. The card itself (`min-h-80`, not a
 * fixed height) grows to fit the legend below the ring instead of
 * clipping it.
 *
 * The legend itself is hand-rolled (a `<ul>` below the ring) rather than
 * ngx-charts' built-in `[legend]` — its `LegendPosition.Below` layout for
 * pie charts does not reduce the ring's height to make room for the
 * legend row, so it overflows past the chart's own box regardless of how
 * that box is sized. A plain flex `<ul>` sibling avoids that entirely.
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

  protected readonly customColors = computed(() =>
    this.data().map((entry, index) => ({
      name: entry.name,
      value: CHART_PALETTE[index % CHART_PALETTE.length],
    })),
  );

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
