import { Pipe, PipeTransform } from '@angular/core';
import { AppEvent } from '../models/app-event.model';

@Pipe({
  name: 'appEventsFilter',
  standalone: false,
})
export class EventsFilterPipe implements PipeTransform {
  transform(
    items: AppEvent[],
    value: string,
    filterBy: string,
    categoryMap: Map<number, string>
  ): AppEvent[] {
    if (items.length === 0 || !value) {
      return items;
    }

    return items.filter(el => {
      const i = Object.assign({}, el);
      let target = `${i[filterBy]}`;

      if (filterBy === 'type') {
        target = AppEvent.getLabel(target);
      }

      if (filterBy === 'category') {
        target = categoryMap.get(i[filterBy]);
      }

      return target.toLowerCase().indexOf(value.toLowerCase()) !== -1;
    });
  }
}
