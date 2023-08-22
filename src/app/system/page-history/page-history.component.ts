import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import * as dayjs from 'dayjs';
import * as isBetween from 'dayjs/plugin/isBetween';
import { BehaviorSubject, combineLatest } from 'rxjs';

import { UnsubscriberComponent } from 'src/app/shared/core/unsubscriber';
import { IChartData } from '../common/models/IChartData';
import { AppEvent } from '../common/models/app-event.model';
import { Category } from '../common/models/category.model';
import { AppEventService } from '../common/services/app-event.service';
import { CategoriesService } from '../common/services/categories.service';

export interface HistoryFilterData {
  types: Set<string>;
  categories: Set<string>;
  period: 'd' | 'w' | 'M';
}

@Component({
  selector: 'app-page-history',
  templateUrl: './page-history.component.html',
  styleUrls: ['./page-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHistoryComponent
  extends UnsubscriberComponent
  implements OnInit
{
  isLoaded$ = new BehaviorSubject<boolean>(false);
  categories: Category[];
  events: AppEvent[];
  filteredEvents: AppEvent[] = [];
  chartData: IChartData[];
  categoryMap: Map<number, string>;
  isFilterVisible = false;

  constructor(
    private categoryService: CategoriesService,
    private eventService: AppEventService,
    private title: Title
  ) {
    super();
    title.setTitle('Історія');
    dayjs.extend(isBetween);
  }

  ngOnInit() {
    this.subs = combineLatest([
      this.categoryService.getCategories(),
      this.eventService.getEvents(),
    ]).subscribe((data: [Category[], AppEvent[]]) => {
      this.categories = data[0];
      this.events = data[1];
      this.setOriginalEvents();
      this.generateChartData();
      this.categoryMap = this.generateCategoryMap();
      this.isLoaded$.next(true);
    });
  }

  onFilter() {
    this.toggleFilterVisibility(true);
  }

  onCancelFilter() {
    this.toggleFilterVisibility(false);
    this.setOriginalEvents();
    this.generateChartData();
  }

  onApplyFilter(filterData: HistoryFilterData) {
    this.toggleFilterVisibility(false);
    this.setOriginalEvents();

    const startOf = dayjs().startOf(filterData.period).startOf('d');
    const endOf = dayjs().endOf(filterData.period).endOf('d');

    this.filteredEvents = this.filteredEvents
      .filter((e: AppEvent) => {
        return filterData.types.has(e.type);
      })
      .filter((e: AppEvent) => {
        return filterData.categories.has(e.category.toString());
      })
      .filter((e: AppEvent) => {
        const dayjsDate = dayjs(e.date, 'DD.MM.YYYY HH:mm:ss');
        return dayjsDate.isBetween(startOf, endOf);
      });
    this.generateChartData();
  }

  private generateChartData() {
    const data: IChartData[] = [];
    this.categories.forEach(c => {
      const value = this.filteredEvents
        .filter(e => e.category === c.id && e.type === 'outcome')
        .reduce((sum, event) => {
          sum += event.amount;
          return sum;
        }, 0);
      data.push({ name: c.name, value });
    });
    this.chartData = data;
  }

  private generateCategoryMap(): Map<number, string> {
    const map = new Map();
    this.categories.forEach(c => {
      map.set(c.id, c.name);
    });
    return map;
  }

  private toggleFilterVisibility(value: boolean) {
    this.isFilterVisible = value;
  }

  private setOriginalEvents() {
    this.filteredEvents = this.events.slice();
  }
}
