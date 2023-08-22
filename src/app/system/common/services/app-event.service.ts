import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { AppEvent } from '../models/app-event.model';
import { flatDtoToInstance } from './dto-transformer';

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
          result.push(flatDtoToInstance<AppEvent>(e, AppEvent));
        });
        return result;
      })
    );
  }

  getEventById(id: number): Observable<AppEvent> {
    return this.GET(`events/${id}`).pipe(
      map((e: AppEvent) => flatDtoToInstance<AppEvent>(e, AppEvent))
    );
  }

  addEvent(event: AppEvent): Observable<AppEvent> {
    return this.POST('events', event).pipe(
      map(e => flatDtoToInstance<AppEvent>(e, AppEvent))
    );
  }
}
