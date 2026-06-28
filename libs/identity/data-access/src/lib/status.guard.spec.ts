import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import type {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { statusGuard } from './status.guard.js';
import { IdentityService } from './identity.service.js';

describe('statusGuard', () => {
  let router: Router;
  let mockIdentityService: { getMe: ReturnType<typeof vi.fn> };

  const mockRoute = {} as ActivatedRouteSnapshot;

  function mockState(url: string): RouterStateSnapshot {
    return { url } as RouterStateSnapshot;
  }

  function runGuard(url: string): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      statusGuard(mockRoute, mockState(url)),
    ) as Observable<boolean | UrlTree>;
  }

  beforeEach(() => {
    mockIdentityService = { getMe: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: IdentityService, useValue: mockIdentityService },
      ],
    });

    router = TestBed.inject(Router);
  });

  describe('on /greeting route', () => {
    it('returns true when user status is active', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'active' }));

      const result = await firstValueFrom(runGuard('/greeting'));

      expect(result).toBe(true);
    });

    it('returns UrlTree to /access-status when user status is pending', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'pending' }));

      const result = await firstValueFrom(runGuard('/greeting'));

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/access-status');
    });

    it('returns UrlTree to /access-status when user status is rejected', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'rejected' }));

      const result = await firstValueFrom(runGuard('/greeting'));

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/access-status');
    });
  });

  describe('on /access-status route', () => {
    it('returns UrlTree to /greeting when user status is active', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'active' }));

      const result = await firstValueFrom(runGuard('/access-status'));

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/greeting');
    });

    it('returns true when user status is pending', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'pending' }));

      const result = await firstValueFrom(runGuard('/access-status'));

      expect(result).toBe(true);
    });
  });

  describe('when getMe() throws an error', () => {
    it('returns UrlTree to /login on error (e.g. 401 Unauthorized)', async () => {
      mockIdentityService.getMe.mockReturnValue(
        throwError(() => new Error('Unauthorized')),
      );

      const result = await firstValueFrom(runGuard('/greeting'));

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    });
  });
});
