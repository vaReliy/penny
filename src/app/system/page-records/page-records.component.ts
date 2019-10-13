import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { AppEvent } from '../shared/models/app-event.model';
import { Bill } from '../shared/models/bill.model';
import { Category } from '../shared/models/category.model';
import { BillService } from '../shared/services/bill.service';
import { CategoriesService } from '../shared/services/categories.service';

@Component({
  selector: 'app-page-records',
  templateUrl: './page-records.component.html',
  styleUrls: ['./page-records.component.scss']
})
export class PageRecordsComponent implements OnInit, OnDestroy {
  isLoaded = false;
  categories: Category[];
  bill: Bill;
  private sub1: Subscription;
  private sub2: Subscription;
  private sub3: Subscription;
  private sub4: Subscription;

  constructor(
    private categoryService: CategoriesService,
    private billService: BillService,
  ) { }

  ngOnInit() {
    this.sub1 = this.categoryService.getCategories()
      .subscribe((categories) => {
        this.categories = categories;
        this.isLoaded = true;
      });
    this.sub4 = this.billService.getBill()
      .subscribe((bill: Bill) => {
        this.bill = bill;
      });
  }

  onAddEvent(event: AppEvent) {
    console.log(event);
  }

  onAddCategory(category: Category) {
    this.sub2 = this.categoryService.addCategory(category)
      .subscribe((addedCategory: Category) => {
        this.categories.push(addedCategory);
      });
  }

  onEditCategory(category: Category) {
    this.sub3 = this.categoryService.updateCategory(category)
      .subscribe((updatedCategory: Category) => {
        console.log('updatedCategory', updatedCategory);
      });
  }

  ngOnDestroy(): void {
    if (this.sub1) {
      this.sub1.unsubscribe();
    }
    if (this.sub2) {
      this.sub2.unsubscribe();
    }
    if (this.sub3) {
      this.sub3.unsubscribe();
    }
    if (this.sub4) {
      this.sub4.unsubscribe();
    }
  }

}
