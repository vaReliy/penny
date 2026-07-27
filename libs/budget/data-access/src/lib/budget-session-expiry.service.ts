import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Route the identity login flow serves; kept local since `scope:budget` may not import `scope:identity`. */
const LOGIN_ROUTE = '/login';

/**
 * Redirects to `/login` on session expiry, matching the redirect target
 * `identity-data-access`'s guards (`loginGuard`/`statusGuard`) already use
 * on an unauthenticated `getMe()` call. Budget stores call this from their
 * error-handling path instead of duplicating the redirect inline, since
 * `scope:budget` cannot depend on `scope:identity` (ESLint depConstraints).
 */
@Injectable({ providedIn: 'root' })
export class BudgetSessionExpiryService {
  private readonly router = inject(Router);

  public redirectToLogin(): void {
    void this.router.navigateByUrl(LOGIN_ROUTE);
  }
}
