import type { Routes } from '@angular/router';
import { loginGuard, statusGuard } from 'identity-data-access';
import { workspaceGuard, workspaceRedirectGuard } from 'shared-web-shell-data';

export const appRoutes: Routes = [
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
    path: '',
    canActivate: [statusGuard],
    loadComponent: () =>
      import('shared-web-shell').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [workspaceRedirectGuard],
        children: [],
      },
      {
        path: 'greeting',
        loadComponent: () =>
          import('identity-feature-greeting').then(
            (m) => m.GreetingPageComponent,
          ),
      },
      {
        path: 'no-workspace',
        loadComponent: () =>
          import('shared-web-shell').then((m) => m.NoWorkspacePageComponent),
      },
      {
        path: 'w/:workspaceId',
        canActivate: [workspaceGuard],
        children: [
          {
            path: 'account',
            loadComponent: () =>
              import('budget-feature-account').then(
                (m) => m.AccountPageComponent,
              ),
          },
          {
            path: 'history',
            loadComponent: () =>
              import('budget-feature-history').then(
                (m) => m.HistoryPageComponent,
              ),
          },
          {
            path: 'history/:id',
            loadComponent: () =>
              import('budget-feature-history').then(
                (m) => m.HistoryDetailPageComponent,
              ),
          },
          {
            path: 'planner',
            loadComponent: () =>
              import('budget-feature-planner').then(
                (m) => m.PlannerPageComponent,
              ),
          },
          {
            path: 'records',
            loadComponent: () =>
              import('budget-feature-records').then(
                (m) => m.RecordsPageComponent,
              ),
          },
        ],
      },
    ],
  },
];
