import { Component, Input, OnInit } from '@angular/core';

import { AppEvent } from '../../shared/models/app-event.model';
import { Category } from '../../shared/models/category.model';

@Component({
  selector: 'app-history-events',
  templateUrl: './history-events.component.html',
  styleUrls: ['./history-events.component.scss'],
})
export class HistoryEventsComponent implements OnInit {
  @Input() events: AppEvent[];
  @Input() categories: Category[];
  @Input() categoryMap: Map<number, string>;
  searchPlaceholder = '';
  searchValue = '';
  searchType = '';

  ngOnInit() {
    this.changeFilterType('amount');
  }

  getCategoryName(categoryId: number): string {
    return this.categoryMap.get(categoryId);
  }

  getEventLabel(eventType: string): string {
    return AppEvent.getLabel(eventType);
  }

  getColorClass(eventType: string) {
    return eventType === AppEvent.TYPES[0] ? 'success' : 'danger';
  }

  changeFilterType(type: string) {
    const filterMap = {
      amount: 'Сума',
      date: 'Дата',
      category: 'Категорія',
      type: 'Тип',
    };
    this.searchType = type;
    this.searchPlaceholder = filterMap[type];
    this.searchValue = '';
  }
}
