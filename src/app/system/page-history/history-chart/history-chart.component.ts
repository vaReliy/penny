import { Component, Input } from '@angular/core';

import { IChartData } from '../../shared/models/IChartData';

@Component({
  selector: 'app-history-chart',
  templateUrl: './history-chart.component.html',
  styleUrls: ['./history-chart.component.scss'],
})
export class HistoryChartComponent {
  @Input() chartData: IChartData[];
}
