import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { UnsubscriberComponent } from 'src/app/shared/core/unsubscriber';
import { AppEvent } from '../../common/models/app-event.model';
import { Bill } from '../../common/models/bill.model';
import { Category } from '../../common/models/category.model';
import { CurrencyEnum } from '../../common/models/currency.enum';
import { AppEventService } from '../../common/services/app-event.service';
import { BillService } from '../../common/services/bill.service';
import { CategoriesService } from '../../common/services/categories.service';

@Component({
  selector: 'app-history-details',
  templateUrl: './history-details.component.html',
  styleUrls: ['./history-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HistoryDetailsComponent
  extends UnsubscriberComponent
  implements OnInit
{
  isLoaded$ = new BehaviorSubject<boolean>(false);
  event: AppEvent;
  category: Category;
  currency: CurrencyEnum;

  constructor(
    private route: ActivatedRoute,
    private eventService: AppEventService,
    private categoriesService: CategoriesService,
    private billService: BillService
  ) {
    super();
  }

  ngOnInit() {
    this.subs = this.route.params
      .pipe(
        mergeMap((param: Params) => this.eventService.getEventById(param.id)),
        mergeMap((event: AppEvent) => {
          this.event = event;
          return this.categoriesService.getCategoryById(event.category);
        }),
        mergeMap((category: Category) => {
          this.category = category;
          return this.billService.getBill();
        })
      )
      .subscribe((bill: Bill) => {
        this.currency = bill.currency;
        this.isLoaded$.next(true);
      });
  }

  getEventLabel(eventType: string): string {
    return AppEvent.getLabel(eventType);
  }

  getColorClass(eventType: string) {
    return eventType === AppEvent.TYPES[0] ? 'success' : 'danger';
  }
}
