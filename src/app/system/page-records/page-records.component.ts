import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';
import { startWith, switchMap, takeUntil } from 'rxjs/operators';

import { AppEvent } from '../shared/models/app-event.model';
import { Bill } from '../shared/models/bill.model';
import { Category } from '../shared/models/category.model';
import { AppEventService } from '../shared/services/app-event.service';
import { BillService } from '../shared/services/bill.service';
import { CategoriesService } from '../shared/services/categories.service';

@Component({
  selector: 'app-page-records',
  templateUrl: './page-records.component.html',
  styleUrls: ['./page-records.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageRecordsComponent implements OnInit, OnDestroy {
  categories$: Observable<Category[]>;
  bill$: Observable<Bill>;
  private refreshBill$ = new Subject();
  private refreshCategories$ = new Subject();
  private doUnsubscribe$ = new Subject();

  constructor(
    private categoryService: CategoriesService,
    private billService: BillService,
    private eventService: AppEventService,
    private title: Title,
  ) {
    this.title.setTitle('Записи');
  }

  ngOnInit() {
    this.categories$ = this.refreshCategories$.pipe(
      startWith({}),
      takeUntil(this.doUnsubscribe$),
      switchMap(() => this.categoryService.getCategories())
    );

    this.bill$ = this.refreshBill$.pipe(
      startWith({}),
      takeUntil(this.doUnsubscribe$),
      switchMap(() => this.billService.getBill())
    );
  }

  onAddEvent(event: AppEvent, bill: Bill) {
    this.eventService.addEvent(event).pipe(
      switchMap((addedEvent: AppEvent) => {
        bill.value += (addedEvent.type === 'outcome') ? -addedEvent.amount : addedEvent.amount;
        return this.billService.updateBill(bill)
      })
    ).subscribe(() => this.refreshBill$.next());
  }

  onAddCategory(category: Category) {
    this.categoryService.addCategory(category)
      .subscribe(() => this.refreshCategories$.next({}));
  }

  onEditCategory(category: Category) {
    this.categoryService.updateCategory(category)
      .subscribe(() => this.refreshCategories$.next({}));
  }

  ngOnDestroy() {
    this.doUnsubscribe$.next();
    this.doUnsubscribe$.complete();
  }
}
