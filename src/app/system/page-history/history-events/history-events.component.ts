import { Component, Input, OnInit } from '@angular/core';

import { AppEvent } from '../../shared/models/app-event.model';
import { Category } from '../../shared/models/category.model';

@Component({
  selector: 'app-history-events',
  templateUrl: './history-events.component.html',
  styleUrls: ['./history-events.component.scss']
})
export class HistoryEventsComponent implements OnInit {
  @Input() events: AppEvent[];
  @Input() categories: Category[];
  @Input() categoryMap: Map<number, string>;


  constructor() { }

  ngOnInit() {
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
}
