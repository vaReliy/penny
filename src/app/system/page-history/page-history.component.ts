import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import * as dayjs from 'dayjs';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import * as isBetween from 'dayjs/plugin/isBetween';
import { BehaviorSubject, combineLatest, of } from 'rxjs';

import { NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { catchError, filter, first } from 'rxjs/operators';
import { UnsubscriberComponent } from 'src/app/shared/core/unsubscriber';
import { DATE_FORMAT } from '../common/constats';
import { IChartData } from '../common/models/IChartData';
import { AppEvent } from '../common/models/app-event.model';
import { Category } from '../common/models/category.model';
import { AppEventService } from '../common/services/app-event.service';
import { CategoriesService } from '../common/services/categories.service';
import { HistoryFilterComponent } from './history-filter/history-filter.component';

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
  providers: [NgbModalConfig, NgbModal],
})
export class PageHistoryComponent
  extends UnsubscriberComponent
  implements OnInit
{
  isLoaded$ = new BehaviorSubject<boolean>(false);
  categories: Category[];
  events: AppEvent[];
  filtered$ = new BehaviorSubject<AppEvent[]>([]);
  chartData: IChartData[];
  categoryMap: Map<number, string>;

  constructor(
    private categoryService: CategoriesService,
    private eventService: AppEventService,
    private modalService: NgbModal,
    private title: Title
  ) {
    super();
    title.setTitle('Історія');
    dayjs.extend(customParseFormat);
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
    const modalRef = this.modalService.open(HistoryFilterComponent, {
      backdrop: 'static',
    });
    modalRef.componentInstance.categoryMap = this.categoryMap;
    modalRef.componentInstance.events = this.events;
    this.subs = modalRef.closed
      .pipe(
        first(),
        catchError(() => of(null)),
        filter(v => !!v)
      )
      .subscribe(filterData => {
        this.onApplyFilter(filterData);
      });
  }

  onCancelFilter() {
    this.setOriginalEvents();
    this.generateChartData();
  }

  private onApplyFilter(filterData: HistoryFilterData) {
    this.setOriginalEvents();

    const startOf = dayjs().startOf(filterData.period);
    const endOf = dayjs().endOf(filterData.period);

    const events = this.filtered$
      .getValue()
      .filter((e: AppEvent) => {
        return filterData.types.has(e.type);
      })
      .filter((e: AppEvent) => {
        return filterData.categories.has(e.category.toString());
      })
      .filter((e: AppEvent) => {
        const dayjsDate = dayjs(e.date, DATE_FORMAT);
        return dayjsDate.isBetween(startOf, endOf);
      });

    this.filtered$.next(events);
    this.generateChartData();
  }

  private generateChartData() {
    const data: IChartData[] = [];
    this.categories.forEach(c => {
      const value = this.filtered$
        .getValue()
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

  private setOriginalEvents() {
    this.filtered$.next(this.events.slice());
  }
}
