import {
  ApplicationConfig,
  CSP_NONCE,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { provideTransloco } from '@jsverse/transloco';
import { appRoutes } from './app.routes';
import {
  AppConfig,
  AppConfigService,
  IdentityService,
  TELEGRAM_BOT_USERNAME,
} from 'identity-data-access';
import { SESSION_LOGOUT } from 'shared-web-shell-data';
import { TranslocoHttpLoader } from './transloco-http-loader';

const CONFIG_URL = '/api/config';

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
        prodMode: !isDevMode(),
        missingHandler: {
          logMissingKey: isDevMode(),
          useFallbackTranslation: false,
          allowEmpty: false,
        },
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(async () => {
      const http = inject(HttpClient);
      const configService = inject(AppConfigService);

      let config: AppConfig;
      try {
        config = await firstValueFrom(http.get<AppConfig>(CONFIG_URL));
      } catch (error) {
        console.error(
          `Failed to load application configuration from ${CONFIG_URL}`,
          error,
        );
        throw error;
      }

      if (!config?.telegramBotUsername) {
        const error = new Error(
          `Application configuration from ${CONFIG_URL} is missing "telegramBotUsername"`,
        );
        console.error(
          `Failed to load application configuration from ${CONFIG_URL}`,
          error,
        );
        throw error;
      }

      configService.set(config);
    }),
    {
      provide: TELEGRAM_BOT_USERNAME,
      useFactory: (): string =>
        inject(AppConfigService).get().telegramBotUsername,
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
