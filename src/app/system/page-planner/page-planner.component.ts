import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';

import { AppEvent } from '../shared/models/app-event.model';
import { Bill } from '../shared/models/bill.model';
import { Category } from '../shared/models/category.model';
import { AppEventService } from '../shared/services/app-event.service';
import { BillService } from '../shared/services/bill.service';
import { CategoriesService } from '../shared/services/categories.service';

@Component({
  selector: 'app-page-planner',
  templateUrl: './page-planner.component.html',
  styleUrls: ['./page-planner.component.scss']
})
export class PagePlannerComponent implements OnInit, OnDestroy {
  isLoaded = false;
  bill: Bill;
  events: AppEvent[];
  categories: Category[];
  private sub1: Subscription;

  constructor(
    private billService: BillService,
    private eventService: AppEventService,
    private categoriesService: CategoriesService,
  ) {
  }

  ngOnInit() {
    this.sub1 = combineLatest(
      this.billService.getBill(),
      this.eventService.getEvents(),
      this.categoriesService.getCategories(),
    ).subscribe((data: [Bill, AppEvent[], Category[]]) => {
      this.bill = data[0];
      this.events = data[1];
      this.categories = data[2];
      this.isLoaded = true;
    });
  }

  getCategorySpendValue(category: Category): number {
    const events = this.events.filter((e) => e.category === category.id && e.type === 'outcome');
    return events.reduce((acc, el) => {
      acc += el.amount;
      return acc;
    }, 0);
  }

  getCategoryLeftValue(category: Category): number {
    const spendValue = this.getCategorySpendValue(category);
    console.log(category.name, this.getPercent(spendValue, +category.capacity));
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
    return percent > 90 ? 'danger' :
      percent > 60 ? 'warning' : 'success';
  }

  ngOnDestroy(): void {
    if (this.sub1) {
      this.sub1.unsubscribe();
    }
  }

  private getPercent(value: number, base: number): number {
    const percent = Math.round(value * 100 / base * 100) / 100;
    return Math.max(0, percent);
  }
}
