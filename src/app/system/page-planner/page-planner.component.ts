import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, combineLatest } from 'rxjs';

import { UnsubscriberComponent } from 'src/app/shared/core/unsubscriber';
import { AppEvent } from '../common/models/app-event.model';
import { Bill } from '../common/models/bill.model';
import { Category } from '../common/models/category.model';
import { AppEventService } from '../common/services/app-event.service';
import { BillService } from '../common/services/bill.service';
import { CategoriesService } from '../common/services/categories.service';

@Component({
  selector: 'app-page-planner',
  templateUrl: './page-planner.component.html',
  styleUrls: ['./page-planner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PagePlannerComponent
  extends UnsubscriberComponent
  implements OnInit
{
  isLoadied$ = new BehaviorSubject<boolean>(false);
  bill: Bill;
  events: AppEvent[];
  categories: Category[];

  constructor(
    private billService: BillService,
    private eventService: AppEventService,
    private categoriesService: CategoriesService,
    private title: Title
  ) {
    super();
    title.setTitle('Планувальник');
  }

  ngOnInit() {
    this.subs = combineLatest([
      this.billService.getBill(),
      this.eventService.getEvents(),
      this.categoriesService.getCategories(),
    ]).subscribe((data: [Bill, AppEvent[], Category[]]) => {
      this.bill = data[0];
      this.events = data[1];
      this.categories = data[2];
      this.isLoadied$.next(true);
    });
  }

  getCategorySpendValue(category: Category): number {
    const events = this.events.filter(
      e => e.category === category.id && e.type === 'outcome'
    );
    return events.reduce((acc, el) => {
      acc += el.amount;
      return acc;
    }, 0);
  }

  getCategoryLeftValue(category: Category): number {
    const spendValue = this.getCategorySpendValue(category);
    return +category.capacity - spendValue;
  }

  getProgressPercent(category: Category): number {
    const spendValue = this.getCategorySpendValue(category);
    return this.getPercent(spendValue, +category.capacity);
  }

  getProgressWidthValue(category: Category): string {
    const value = this.getProgressPercent(category);
    return value >= 100 ? '100%' : `${value}%`;
  }

  getProgressColor(category: Category) {
    const percent = this.getProgressPercent(category);
    return percent > 90 ? 'danger' : percent > 60 ? 'warning' : 'success';
  }

  private getPercent(value: number, base: number): number {
    const percent = Math.round(((value * 100) / base) * 100) / 100;
    return Math.max(0, percent);
  }
}
