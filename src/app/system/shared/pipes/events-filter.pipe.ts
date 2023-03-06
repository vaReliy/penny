import { Pipe, PipeTransform } from '@angular/core';
import { AppEvent } from '../models/app-event.model';

@Pipe({
  name: 'appEventsFilter',
})
export class EventsFilterPipe implements PipeTransform {
  transform(items: string[], value: string, filterBy: string, categoryMap: Map<number, string>): string[] {
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
