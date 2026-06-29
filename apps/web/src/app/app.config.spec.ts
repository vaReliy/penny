import { CSP_NONCE } from '@angular/core';
import { describe, expect, it, afterEach, vi } from 'vitest';

import { appConfig } from './app.config';

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
});
