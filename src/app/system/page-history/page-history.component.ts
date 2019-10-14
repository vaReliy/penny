import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { AppEvent } from '../shared/models/app-event.model';
import { Category } from '../shared/models/category.model';

import { AppEventService } from '../shared/services/app-event.service';
import { CategoriesService } from '../shared/services/categories.service';

@Component({
  selector: 'app-page-history',
  templateUrl: './page-history.component.html',
  styleUrls: ['./page-history.component.scss']
})
export class PageHistoryComponent implements OnInit, OnDestroy {
  isLoaded = false;
  categories: Category[];
  events: AppEvent[];
  private sub1: Subscription;

  constructor(
    private categoryService: CategoriesService,
    private eventService: AppEventService,
  ) { }

  ngOnInit() {
    this.sub1 = combineLatest(
      this.categoryService.getCategories(),
      this.eventService.getEvents(),
    ).subscribe((data: [Category[], AppEvent[]]) => {
      this.categories = data[0];
      this.events = data[1];
      this.isLoaded = true;
    });
  }

  ngOnDestroy(): void {
    if (this.sub1) {
      this.sub1.unsubscribe();
    }
  }
}
