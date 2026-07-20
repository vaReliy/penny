import {
  ApplicationConfig,
  CSP_NONCE,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { appRoutes } from './app.routes';
import { IdentityService, TELEGRAM_BOT_USERNAME } from 'identity-data-access';
import { SESSION_LOGOUT } from 'shared-web-shell-data';
import { environment } from '../environments/environment';
import { TranslocoHttpLoader } from './transloco-http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['uk'],
        defaultLang: 'uk',
        fallbackLang: 'uk',
        prodMode: environment.production,
        missingHandler: {
          logMissingKey: !environment.production,
          useFallbackTranslation: false,
          allowEmpty: false,
        },
      },
      loader: TranslocoHttpLoader,
    }),
    {
      provide: TELEGRAM_BOT_USERNAME,
      useValue: environment.telegramBotUsername,
    },
    {
      provide: SESSION_LOGOUT,
      useFactory: () => {
        const identityService = inject(IdentityService);
        return () => identityService.logout();
      },
    },
    {
      provide: CSP_NONCE,
      useFactory: (): string | null =>
        document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')
          ?.content || null,
    },
  ],
};
