import { inject } from '@angular/core';
import type { CanActivateFn, UrlTree } from '@angular/router';
import { Router } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import type { Observable } from 'rxjs';
import { IdentityService } from './identity.service';

export const loginGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const identityService = inject(IdentityService);

  return identityService.getMe().pipe(
    map((user): UrlTree => {
      if (user.status === 'active') {
        return router.createUrlTree(['/greeting']);
      }
      return router.createUrlTree(['/access-status']);
    }),
    // 401 means unauthenticated — allow access to the login page.
    // Any other error (network, 5xx) also falls through to avoid blocking login.
    catchError((): Observable<true> => of(true)),
  );
};
