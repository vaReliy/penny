import { Component, OnInit, inject, DOCUMENT, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { IdentityService, TELEGRAM_BOT_USERNAME } from 'identity-data-access';
import type { RawTelegramLoginPayload } from 'identity-data-access';

const TELEGRAM_WIDGET_VERSION = '22';

@Component({
  selector: 'lib-login-page',
  standalone: true,
  imports: [TranslocoPipe],
  providers: [provideTranslocoScope('identity')],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly identityService = inject(IdentityService);
  private readonly telegramBotUsername = inject(TELEGRAM_BOT_USERNAME);

  protected readonly loginStatus = signal<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');

  constructor() {
    this.route.queryParams
      .pipe(
        takeUntilDestroyed(),
        switchMap((params) => {
          const payload = this.extractTelegramPayload(params);
          if (payload === null) {
            return of(null);
          }
          this.loginStatus.set('pending');
          return this.identityService.submitTelegramLogin(payload);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result === null) return;
          this.loginStatus.set('success');
          void this.router.navigate(['/']);
        },
        error: () => {
          this.loginStatus.set('error');
        },
      });
  }

  public ngOnInit(): void {
    this.injectTelegramWidget();
  }

  private injectTelegramWidget(): void {
    const container = this.document.getElementById('telegram-widget-container');
    if (container === null) {
      return;
    }

    const script = this.document.createElement('script');
    script.src = `https://telegram.org/js/telegram-widget.js?${TELEGRAM_WIDGET_VERSION}`;
    script.setAttribute('data-telegram-login', this.telegramBotUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', this.buildAuthUrl());
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    container.appendChild(script);
  }

  private buildAuthUrl(): string {
    return `${this.document.location.origin}/login`;
  }

  private extractTelegramPayload(
    params: Record<string, string>,
  ): RawTelegramLoginPayload | null {
    const id = Number(params['id']);
    const authDate = Number(params['auth_date']);

    if (!params['hash'] || !Number.isFinite(id) || !Number.isFinite(authDate)) {
      return null;
    }

    return {
      id,
      auth_date: authDate,
      hash: params['hash'],
      ...(params['first_name'] && { first_name: params['first_name'] }),
      ...(params['last_name'] && { last_name: params['last_name'] }),
      ...(params['username'] && { username: params['username'] }),
      ...(params['photo_url'] && { photo_url: params['photo_url'] }),
    };
  }
}
