import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TranslocoHttpLoader } from './transloco-http-loader';

describe('TranslocoHttpLoader', () => {
  let loader: TranslocoHttpLoader;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    loader = TestBed.inject(TranslocoHttpLoader);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests the root scope JSON when lang has no scope prefix', () => {
    loader.getTranslation('uk').subscribe();

    const req = httpMock.expectOne('/i18n/uk.json');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  // Transloco's loader engine already passes the scope-qualified path as
  // `lang` (e.g. 'identity/uk') and includes the parsed scope name in `data`
  // purely as a convenience — the loader must NOT re-prefix `lang` with
  // `data.scope`, or the request path is doubled (identity/identity/uk.json).
  it('requests the already-scope-qualified path as-is, without re-prefixing from data.scope', () => {
    loader.getTranslation('identity/uk', { scope: 'identity' }).subscribe();

    const req = httpMock.expectOne('/i18n/identity/uk.json');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('resolves the translation payload returned by the HTTP response', async () => {
    const payload = { login: { heading: 'Вхід до Penny' } };
    const result$ = loader.getTranslation('identity/uk', { scope: 'identity' });

    let received: unknown;
    result$.subscribe((value) => (received = value));

    httpMock.expectOne('/i18n/identity/uk.json').flush(payload);
    expect(received).toEqual(payload);
  });
});
