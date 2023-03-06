import { Component, EventEmitter, Input, Output } from '@angular/core';

import { AppEvent } from '../../shared/models/app-event.model';
import { HistoryFilterData } from '../page-history.component';

@Component({
  selector: 'app-history-filter',
  templateUrl: './history-filter.component.html',
  styleUrls: ['./history-filter.component.scss'],
})
export class HistoryFilterComponent {
  @Input() categoryMap: Map<number, string>;
  @Input() events: AppEvent[];
  @Output() cancelFilter = new EventEmitter();
  @Output() applyFilter = new EventEmitter<HistoryFilterData>();
  selectedCategoryIds = new Set<string>();
  selectedEventsIds = new Set<string>();
  selectedPeriod: 'd' | 'w' | 'M' = 'd';
  eventTypes = AppEvent.TYPES;
  periodTypes = [
    { type: 'd', label: 'День' },
    { type: 'w', label: 'Тиждень' },
    { type: 'M', label: 'Місяць' },
  ];

  getEventLabelByType(eventType: string) {
    return AppEvent.getLabel(eventType);
  }

  eventTypeHandler({ checked, value }) {
    checked
      ? this.selectedEventsIds.add(value)
      : this.selectedEventsIds.delete(value);
  }

  categoryTypeHandler({ checked, value }) {
    checked
      ? this.selectedCategoryIds.add(value)
      : this.selectedCategoryIds.delete(value);
  }

  close() {
    this.cancelFilter.emit();
  }

  confirm() {
    this.applyFilter.emit({
      types: this.selectedEventsIds,
      categories: this.selectedCategoryIds,
      period: this.selectedPeriod,
    });
  }
}
