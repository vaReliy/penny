import type { Routes } from '@angular/router';
import { loginGuard, statusGuard } from 'identity-data-access';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'greeting', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('identity-feature-login').then((m) => m.LoginPageComponent),
  },
  {
    path: 'access-status',
    canActivate: [statusGuard],
    loadComponent: () =>
      import('identity-feature-access-status').then(
        (m) => m.AccessStatusPageComponent,
      ),
  },
  {
    path: 'greeting',
    canActivate: [statusGuard],
    loadComponent: () =>
      import('identity-feature-greeting').then((m) => m.GreetingPageComponent),
  },
];
