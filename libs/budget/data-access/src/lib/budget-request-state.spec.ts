import { HttpErrorResponse } from '@angular/common/http';
import { throwError, of, Subject } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { BudgetRequestState } from './budget-request-state.js';
import type { BudgetSessionExpiryService } from './budget-session-expiry.service.js';

function makeSessionExpiry(): BudgetSessionExpiryService {
  return { redirectToLogin: vi.fn() } as unknown as BudgetSessionExpiryService;
}

describe('BudgetRequestState', () => {
  it('sets loading true while the request is in flight, then false on success', () => {
    const state = new BudgetRequestState(makeSessionExpiry());
    let onSuccessCalled = false;

    state.run(of('value'), () => (onSuccessCalled = true));

    expect(state.loading()).toBe(false);
    expect(onSuccessCalled).toBe(true);
  });

  it('clears any previous error when a new request starts', () => {
    const sessionExpiry = makeSessionExpiry();
    const state = new BudgetRequestState(sessionExpiry);

    state.run(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'bad',
              statusCode: 400,
            },
          }),
      ),
      () => undefined,
    );
    expect(state.error()?.kind).toBe('VALIDATION');

    state.run(of('value'), () => undefined);
    expect(state.error()).toBeNull();
  });

  it('redirects to login when the mapped error kind is AUTHENTICATION (401)', () => {
    const sessionExpiry = makeSessionExpiry();
    const state = new BudgetRequestState(sessionExpiry);

    state.run(
      throwError(() => new HttpErrorResponse({ status: 401, error: null })),
      () => undefined,
    );

    expect(sessionExpiry.redirectToLogin).toHaveBeenCalledOnce();
    expect(state.error()?.kind).toBe('AUTHENTICATION');
    expect(state.loading()).toBe(false);
  });

  it('does not redirect to login for non-authentication errors', () => {
    const sessionExpiry = makeSessionExpiry();
    const state = new BudgetRequestState(sessionExpiry);

    state.run(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: {
              code: 'NOT_FOUND_ERROR',
              message: 'missing',
              statusCode: 404,
            },
          }),
      ),
      () => undefined,
    );

    expect(sessionExpiry.redirectToLogin).not.toHaveBeenCalled();
    expect(state.error()?.kind).toBe('NOT_FOUND');
  });

  it('never invokes onSuccess when the source errors', () => {
    const state = new BudgetRequestState(makeSessionExpiry());
    const onSuccess = vi.fn();

    state.run(
      throwError(() => new HttpErrorResponse({ status: 500, error: null })),
      onSuccess,
    );

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('maps a bare 500 to the UNKNOWN error kind and clears loading, without throwing', () => {
    const sessionExpiry = makeSessionExpiry();
    const state = new BudgetRequestState(sessionExpiry);

    state.run(
      throwError(() => new HttpErrorResponse({ status: 500, error: null })),
      () => undefined,
    );

    expect(state.error()?.kind).toBe('UNKNOWN');
    expect(state.loading()).toBe(false);
    expect(sessionExpiry.redirectToLogin).not.toHaveBeenCalled();
  });

  it('ignores a late completion of a superseded run (does not invoke its onSuccess)', () => {
    const state = new BudgetRequestState(makeSessionExpiry());
    const run1 = new Subject<string>();
    const run2 = new Subject<string>();
    const onSuccess1 = vi.fn();
    const onSuccess2 = vi.fn();

    state.run(run1, onSuccess1);
    state.run(run2, onSuccess2);

    run2.next('B');
    run2.complete();
    run1.next('A');
    run1.complete();

    expect(onSuccess1).not.toHaveBeenCalled();
    expect(onSuccess2).toHaveBeenCalledExactlyOnceWith('B');
  });

  it('ignores a late error from a superseded run (does not set the error state)', () => {
    const state = new BudgetRequestState(makeSessionExpiry());
    const run1 = new Subject<string>();
    const run2 = new Subject<string>();

    state.run(run1, () => undefined);
    state.run(run2, () => undefined);

    run2.next('B');
    run2.complete();
    run1.error(new HttpErrorResponse({ status: 500, error: null }));

    expect(state.error()).toBeNull();
    expect(state.loading()).toBe(false);
  });
});
