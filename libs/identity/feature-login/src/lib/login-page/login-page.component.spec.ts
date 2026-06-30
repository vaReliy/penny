import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdentityService, TELEGRAM_BOT_USERNAME } from 'identity-data-access';
import { LoginPageComponent } from './login-page.component.js';

const VALID_TELEGRAM_PARAMS: Record<string, string> = {
  id: '123456',
  first_name: 'Alice',
  auth_date: '1700000000',
  hash: 'abc123deadbeef',
};

describe('LoginPageComponent', () => {
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;
  let submitTelegramLoginMock: ReturnType<typeof vi.fn>;
  let navigateMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});
    submitTelegramLoginMock = vi.fn().mockReturnValue(of({ status: 'ok' }));
    navigateMock = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
        {
          provide: Router,
          useValue: { navigate: navigateMock },
        },
        {
          provide: IdentityService,
          useValue: { submitTelegramLogin: submitTelegramLoginMock },
        },
        { provide: TELEGRAM_BOT_USERNAME, useValue: 'TEST_BOT' },
      ],
    }).compileComponents();
  });

  it('renders without error', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('injects a <script> tag with telegram-widget.js src after init', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const script = nativeEl.querySelector<HTMLScriptElement>(
      'script[src*="telegram-widget.js"]',
    );
    expect(script).not.toBeNull();
  });

  it('calls submitTelegramLogin when Telegram callback params are present', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    // BehaviorSubject.next() + of() are fully synchronous — no fakeAsync needed
    queryParamsSubject.next(VALID_TELEGRAM_PARAMS);

    expect(submitTelegramLoginMock).toHaveBeenCalledOnce();
    expect(submitTelegramLoginMock).toHaveBeenCalledWith({
      id: 123456,
      first_name: 'Alice',
      auth_date: 1700000000,
      hash: 'abc123deadbeef',
    });
  });

  it('does not call submitTelegramLogin when hash param is absent', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    queryParamsSubject.next({ id: '123456', first_name: 'Alice' });

    expect(submitTelegramLoginMock).not.toHaveBeenCalled();
  });

  it('does not call submitTelegramLogin when required fields are missing', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    // hash present but id and auth_date are missing — payload validation fails
    queryParamsSubject.next({ hash: 'abc123', first_name: 'Alice' });

    expect(submitTelegramLoginMock).not.toHaveBeenCalled();
  });
});
