import { inject } from '@angular/core';
import type {
  CanActivateFn,
  RouterStateSnapshot,
  ActivatedRouteSnapshot,
  UrlTree,
} from '@angular/router';
import { Router } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import type { Observable } from 'rxjs';
import { IdentityService } from './identity.service';

export const statusGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const identityService = inject(IdentityService);

  return identityService.getMe().pipe(
    map((user): boolean | UrlTree => {
      const isAccessStatusRoute = state.url.startsWith('/access-status');

      if (isAccessStatusRoute) {
        if (user.status === 'active') {
          return router.createUrlTree(['/greeting']);
        }
        return true;
      }

      if (user.status === 'active') {
        return true;
      }
      return router.createUrlTree(['/access-status']);
    }),
    catchError((): Observable<UrlTree> => of(router.createUrlTree(['/login']))),
  );
};
