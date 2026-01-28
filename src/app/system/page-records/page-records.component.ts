import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

import { UnsubscriberComponent } from 'src/app/shared/core/unsubscriber';
import { AppEvent } from '../common/models/app-event.model';
import { Bill } from '../common/models/bill.model';
import { Category } from '../common/models/category.model';
import { AppEventService } from '../common/services/app-event.service';
import { BillService } from '../common/services/bill.service';
import { CategoriesService } from '../common/services/categories.service';

@Component({
  selector: 'app-page-records',
  templateUrl: './page-records.component.html',
  styleUrls: ['./page-records.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PageRecordsComponent
  extends UnsubscriberComponent
  implements OnInit
{
  isLoaded$ = new BehaviorSubject<boolean>(false);
  categories: Category[];
  bill: Bill;

  constructor(
    private categoryService: CategoriesService,
    private billService: BillService,
    private eventService: AppEventService,
    private title: Title
  ) {
    super();
    title.setTitle('Записи');
  }

  ngOnInit() {
    this.subs = this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.isLoaded$.next(true);
    });
    this.subs = this.billService.getBill().subscribe((bill: Bill) => {
      this.bill = bill;
    });
  }

  onAddEvent(event: AppEvent) {
    this.subs = this.eventService
      .addEvent(event)
      .subscribe((addedEvent: AppEvent) => {
        this.bill.value +=
          addedEvent.type === 'outcome'
            ? -addedEvent.amount
            : addedEvent.amount;
        this.billService
          .updateBill(this.bill)
          .subscribe((updatedBill: Bill) => {
            this.bill = updatedBill;
          });
      });
  }

  onAddCategory(category: Category) {
    this.subs = this.categoryService
      .addCategory(category)
      .subscribe((addedCategory: Category) => {
        this.categories.push(addedCategory);
      });
  }

  onEditCategory(category: Category) {
    this.subs = this.categoryService
      .updateCategory(category)
      .subscribe((updatedCategory: Category) => {
        console.log('updatedCategory', updatedCategory); // fixme
      });
  }
}
