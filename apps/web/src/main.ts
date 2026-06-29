import { CSP_NONCE } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const nonce =
  document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content ??
  '';

bootstrapApplication(App, {
  providers: [...appConfig.providers, { provide: CSP_NONCE, useValue: nonce }],
}).catch((err) => console.error(err));
