import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { AppEvent } from '../models/app-event.model';

@Injectable()
export class AppEventService extends BaseApi {
  constructor(protected http: HttpClient) {
    super(http);
  }

  getEvents(): Observable<AppEvent[]> {
    return this.GET('events').pipe(
      map(events => {
        const result = [];
        events.forEach((e: AppEvent) => {
          result.push(
            new AppEvent(
              e.type,
              e.amount,
              e.category,
              e.date,
              e.description,
              e.id
            )
          );
        });
        return result;
      })
    );
  }

  getEventById(id: number): Observable<AppEvent> {
    return this.GET(`events/${id}`).pipe(
      map(
        (e: AppEvent) =>
          new AppEvent(
            e.type,
            e.amount,
            e.category,
            e.date,
            e.description,
            e.id
          )
      )
    );
  }

  addEvent(event: AppEvent): Observable<AppEvent> {
    return this.POST('events', event).pipe(
      map(
        v =>
          new AppEvent(
            (v as AppEvent).type,
            (v as AppEvent).amount,
            (v as AppEvent).category,
            (v as AppEvent).date,
            (v as AppEvent).description,
            (v as AppEvent).id
          )
      )
    );
  }
}
