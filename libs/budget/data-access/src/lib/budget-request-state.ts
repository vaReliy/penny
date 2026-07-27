import { signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { HttpErrorResponse } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { EMPTY } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { BudgetApiErrorKind, toBudgetApiError } from './budget-api-error';
import type { BudgetApiError } from './budget-api-error';
import type { BudgetSessionExpiryService } from './budget-session-expiry.service';

/**
 * Shared `loading`/`error` signal pair plus the request-running logic every
 * budget store needs: map failures to `BudgetApiError`, redirect to login on
 * session expiry, and always clear `loading` on completion. Each store keeps
 * its own `data` signal(s) — shape varies too much (list vs. single item vs.
 * multiple related resources) to generalize here.
 */
export class BudgetRequestState {
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<BudgetApiError | null>(null);

  public constructor(
    private readonly sessionExpiry: BudgetSessionExpiryService,
  ) {}

  public get loading(): Signal<boolean> {
    return this.loadingSignal;
  }

  public get error(): Signal<BudgetApiError | null> {
    return this.errorSignal;
  }

  /** Runs `source`, invoking `onSuccess` with its emitted value. Errors are captured in `error`, never thrown. */
  public run<T>(source: Observable<T>, onSuccess: (value: T) => void): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    source
      .pipe(
        catchError((httpError: HttpErrorResponse) => {
          const apiError = toBudgetApiError(httpError);
          this.errorSignal.set(apiError);
          if (apiError.kind === BudgetApiErrorKind.AUTHENTICATION) {
            this.sessionExpiry.redirectToLogin();
          }
          return EMPTY;
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe(onSuccess);
  }
}
