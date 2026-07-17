import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { TranslocoLoader, Translation } from '@jsverse/transloco';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  public getTranslation(lang: string): Observable<Translation> {
    return this.http.get<Translation>(`/i18n/${lang}.json`);
  }
}
