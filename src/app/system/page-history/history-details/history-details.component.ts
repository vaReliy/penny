import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Subscription } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { AppEvent } from '../../shared/models/app-event.model';
import { Bill } from '../../shared/models/bill.model';
import { Category } from '../../shared/models/category.model';
import { CurrencyEnum } from '../../shared/models/currency.enum';
import { AppEventService } from '../../shared/services/app-event.service';
import { BillService } from '../../shared/services/bill.service';
import { CategoriesService } from '../../shared/services/categories.service';

@Component({
  selector: 'app-history-details',
  templateUrl: './history-details.component.html',
  styleUrls: ['./history-details.component.scss']
})
export class HistoryDetailsComponent implements OnInit, OnDestroy {
  isLoaded = false;
  event: AppEvent;
  category: Category;
  currency: CurrencyEnum;
  private s1: Subscription;

  constructor(
    private route: ActivatedRoute,
    private eventService: AppEventService,
    private categoriesService: CategoriesService,
    private billService: BillService,
  ) { }

  ngOnInit() {
    this.route.params
      .pipe(
        mergeMap((param: Params) => this.eventService.getEventById(param.id)),
        mergeMap((event: AppEvent) => {
          this.event = event;
          return this.categoriesService.getCategoryById(event.category);
        }),
        mergeMap((category: Category) => {
          this.category = category;
          return this.billService.getBill();
        }),
      )
      .subscribe((bill: Bill) => {
        this.currency = bill.currency;
        this.isLoaded = true;
      });
  }

  getEventLabel(eventType: string): string {
    return AppEvent.getLabel(eventType);
  }

  getColorClass(eventType: string) {
    return eventType === AppEvent.TYPES[0] ? 'success' : 'danger';
  }

  ngOnDestroy(): void {
    if (this.s1) {
      this.s1.unsubscribe();
    }
  }
}
