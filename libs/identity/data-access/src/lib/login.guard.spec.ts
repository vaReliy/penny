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
import { loginGuard } from './login.guard.js';
import { IdentityService } from './identity.service.js';

describe('loginGuard', () => {
  let router: Router;
  let mockIdentityService: { getMe: ReturnType<typeof vi.fn> };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  function runGuard(): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      loginGuard(mockRoute, mockState),
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

  describe('when user status is active', () => {
    it('returns a UrlTree pointing to /greeting', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'active' }));

      const result = await firstValueFrom(runGuard());

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/greeting');
    });
  });

  describe('when user status is pending', () => {
    it('returns a UrlTree pointing to /access-status', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'pending' }));

      const result = await firstValueFrom(runGuard());

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/access-status');
    });
  });

  describe('when user status is rejected', () => {
    it('returns a UrlTree pointing to /access-status', async () => {
      mockIdentityService.getMe.mockReturnValue(of({ status: 'rejected' }));

      const result = await firstValueFrom(runGuard());

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/access-status');
    });
  });

  describe('when getMe() throws an error', () => {
    it('returns true (allows access to login page on 401 or any error)', async () => {
      mockIdentityService.getMe.mockReturnValue(
        throwError(() => new Error('Unauthorized')),
      );

      const result = await firstValueFrom(runGuard());

      expect(result).toBe(true);
    });
  });
});
