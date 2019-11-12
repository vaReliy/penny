import { Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import * as moment from 'moment';
import { combineLatest, Subscription } from 'rxjs';

import { AppEvent } from '../shared/models/app-event.model';
import { Category } from '../shared/models/category.model';
import { IChartData } from '../shared/models/IChartData';
import { AppEventService } from '../shared/services/app-event.service';
import { CategoriesService } from '../shared/services/categories.service';

export interface HistoryFilterData {
  types: Set<string>;
  categories: Set<string>;
  period: 'd' | 'w' | 'M';
}


@Component({
  selector: 'app-page-history',
  templateUrl: './page-history.component.html',
  styleUrls: ['./page-history.component.scss']
})
export class PageHistoryComponent implements OnInit, OnDestroy {
  isLoaded = false;
  categories: Category[];
  events: AppEvent[];
  filteredEvents: AppEvent[] = [];
  chartData: IChartData[];
  categoryMap: Map<number, string>;
  isFilterVisible = false;
  private sub1: Subscription;

  constructor(
    private categoryService: CategoriesService,
    private eventService: AppEventService,
    private title: Title,
  ) {
    this.title.setTitle('Історія');
  }

  ngOnInit() {
    this.sub1 = combineLatest(
      this.categoryService.getCategories(),
      this.eventService.getEvents(),
    ).subscribe((data: [Category[], AppEvent[]]) => {
      this.categories = data[0];
      this.events = data[1];
      this.setOriginalEvents();
      this.generateChartData();
      this.categoryMap = this.generateCategoryMap();
      this.isLoaded = true;
    });
  }

  ngOnDestroy(): void {
    if (this.sub1) {
      this.sub1.unsubscribe();
    }
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

    const startOf = moment().startOf(filterData.period).startOf('d');
    const endOf = moment().endOf(filterData.period).endOf('d');

    this.filteredEvents = this.filteredEvents
      .filter((e: AppEvent) => {
        return filterData.types.has(e.type);
      })
      .filter((e: AppEvent) => {
        return filterData.categories.has(e.category.toString());
      })
      .filter((e: AppEvent) => {
        const momentDate = moment(e.date, 'DD.MM.YYYY HH:mm:ss');
        return momentDate.isBetween(startOf, endOf);
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
      data.push({name: c.name, value});
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
