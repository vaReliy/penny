import {
  ApplicationConfig,
  CSP_NONCE,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { appRoutes } from './app.routes';
import { TELEGRAM_BOT_USERNAME } from 'identity-data-access';
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
      provide: CSP_NONCE,
      useFactory: (): string | null =>
        document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')
          ?.content || null,
    },
  ],
};
