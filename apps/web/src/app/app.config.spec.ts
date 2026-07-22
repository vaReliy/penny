import { ApplicationInitStatus, CSP_NONCE, isDevMode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLOCO_CONFIG, TRANSLOCO_LOADER } from '@jsverse/transloco';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { AppConfigService, TELEGRAM_BOT_USERNAME } from 'identity-data-access';

import { appConfig } from './app.config';
import { TranslocoHttpLoader } from './transloco-http-loader';

function getCspNonceFactory(): (() => string | null) | undefined {
  const cspNonceProvider = appConfig.providers.find(
    (p) =>
      typeof p === 'object' &&
      p !== null &&
      'provide' in p &&
      p.provide === CSP_NONCE,
  ) as Record<string, unknown> | undefined;
  return cspNonceProvider?.['useFactory'] as (() => string | null) | undefined;
}

describe('appConfig', () => {
  describe('transloco configuration', () => {
    it('resolves uk as both defaultLang and fallbackLang', () => {
      TestBed.configureTestingModule({ providers: appConfig.providers });
      const config = TestBed.inject(TRANSLOCO_CONFIG);
      expect(config.defaultLang).toBe('uk');
      expect(config.availableLangs).toEqual(['uk']);
    });

    it('logs missing keys in dev (non-production) and echoes the key in prod', () => {
      TestBed.configureTestingModule({ providers: appConfig.providers });
      const config = TestBed.inject(TRANSLOCO_CONFIG);
      expect(config.missingHandler.logMissingKey).toBe(isDevMode());
      expect(config.missingHandler.useFallbackTranslation).toBe(false);
    });

    it('wires TranslocoHttpLoader as the loader', () => {
      TestBed.configureTestingModule({ providers: appConfig.providers });
      const loader = TestBed.inject(TRANSLOCO_LOADER);
      expect(loader).toBeInstanceOf(TranslocoHttpLoader);
    });
  });

  it('contains a CSP_NONCE provider', () => {
    const cspNonceProvider = appConfig.providers.find(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        p.provide === CSP_NONCE,
    );
    expect(cspNonceProvider).toBeDefined();
  });

  it('provides CSP_NONCE via useFactory (not useValue)', () => {
    const cspNonceProvider = appConfig.providers.find(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        p.provide === CSP_NONCE,
    ) as Record<string, unknown> | undefined;
    expect(cspNonceProvider).toHaveProperty('useFactory');
    expect(cspNonceProvider).not.toHaveProperty('useValue');
  });

  describe('CSP_NONCE useFactory', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns null when the meta element is absent', () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);
      const factory = getCspNonceFactory();
      expect(factory?.()).toBeNull();
    });

    it('returns null when the meta element has an empty content (nginx sub_filter not run)', () => {
      const mockMeta = { content: '' } as HTMLMetaElement;
      vi.spyOn(document, 'querySelector').mockReturnValue(mockMeta);
      const factory = getCspNonceFactory();
      expect(factory?.()).toBeNull();
    });

    it('returns the nonce string when the meta element has a non-empty content', () => {
      const mockMeta = { content: 'abc123' } as HTMLMetaElement;
      vi.spyOn(document, 'querySelector').mockReturnValue(mockMeta);
      const factory = getCspNonceFactory();
      expect(factory?.()).toBe('abc123');
    });
  });

  describe('config bootstrap initializer', () => {
    let httpController: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [...appConfig.providers, provideHttpClientTesting()],
      });
      httpController = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpController.verify();
      vi.restoreAllMocks();
    });

    it('fetches /api/config and populates TELEGRAM_BOT_USERNAME on success', async () => {
      const initStatus = TestBed.inject(ApplicationInitStatus);
      const donePromise = initStatus.donePromise;

      const req = httpController.expectOne('/api/config');
      expect(req.request.method).toBe('GET');
      req.flush({ telegramBotUsername: 'TEST_BOT' });

      await donePromise;

      expect(TestBed.inject(TELEGRAM_BOT_USERNAME)).toBe('TEST_BOT');
    });

    it('throws and logs a console.error when the request fails', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const initStatus = TestBed.inject(ApplicationInitStatus);
      const donePromise = initStatus.donePromise;
      donePromise.catch(() => undefined);

      const req = httpController.expectOne('/api/config');
      req.flush('server error', { status: 500, statusText: 'Server Error' });

      await expect(donePromise).rejects.toBeTruthy();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load application configuration from /api/config',
        expect.anything(),
      );
      expect(() => TestBed.inject(AppConfigService).get()).toThrow();
    });

    it('throws and logs a console.error when the response is missing telegramBotUsername', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const initStatus = TestBed.inject(ApplicationInitStatus);
      const donePromise = initStatus.donePromise;
      donePromise.catch(() => undefined);

      const req = httpController.expectOne('/api/config');
      req.flush({});

      await expect(donePromise).rejects.toBeTruthy();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load application configuration from /api/config',
        expect.anything(),
      );
    });
  });
});
