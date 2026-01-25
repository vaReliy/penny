import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AppEvent } from '../../common/models/app-event.model';

@Component({
    selector: 'app-history-filter',
    templateUrl: './history-filter.component.html',
    styleUrls: ['./history-filter.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class HistoryFilterComponent {
  categoryMap: Map<number, string>;
  events: AppEvent[];

  selectedCategoryIds = new Set<string>();
  selectedEventsIds = new Set<string>();
  selectedPeriod: 'd' | 'w' | 'M' = 'd';
  eventTypes = AppEvent.TYPES;
  periodTypes = [
    { type: 'd', label: 'День' },
    { type: 'w', label: 'Тиждень' },
    { type: 'M', label: 'Місяць' },
  ];

  constructor(public activeModal: NgbActiveModal) {}

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

  confirm() {
    this.activeModal.close({
      types: this.selectedEventsIds,
      categories: this.selectedCategoryIds,
      period: this.selectedPeriod,
    });
  }
}
