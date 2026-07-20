import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { SESSION_LOGOUT } from './session-logout.token';

describe('SESSION_LOGOUT', () => {
  it('resolves the provided logout function via DI', () => {
    const logout = vi.fn(() => of(undefined));

    TestBed.configureTestingModule({
      providers: [{ provide: SESSION_LOGOUT, useValue: logout }],
    });

    expect(TestBed.inject(SESSION_LOGOUT)).toBe(logout);
  });
});
