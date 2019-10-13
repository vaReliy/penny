import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { AppEvent } from '../models/app-event.model';

@Injectable()
export class AppEventService extends BaseApi {

  constructor(
    protected http: HttpClient
  ) {
    super(http);
  }

  getEvents(): Observable<AppEvent[]> {
    return this.GET('events')
      .pipe(
        delay(500),
        map(events => {
          const result = [];
          events.forEach((e: AppEvent) => {
            result.push(new AppEvent(
              e.type,
              e.amount,
              e.category,
              e.date,
              e.description,
              e.id,
            ));
          });
          return result;
        }),
      );
  }

  addEvent(event: AppEvent): Observable<AppEvent> {
    return this.POST('events', event)
      .pipe(
        delay(500),
        map(v => new AppEvent(
          (v as AppEvent).type,
          (v as AppEvent).amount,
          (v as AppEvent).category,
          (v as AppEvent).date,
          (v as AppEvent).description,
          (v as AppEvent).id)),
      );
  }
}
