import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { IChartData } from '../../common/models/IChartData';

@Component({
  selector: 'app-history-chart',
  templateUrl: './history-chart.component.html',
  styleUrls: ['./history-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryChartComponent {
  @Input() chartData: IChartData[];
}
