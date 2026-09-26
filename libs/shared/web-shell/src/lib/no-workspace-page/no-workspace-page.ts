import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SESSION_LOGOUT } from 'shared-web-shell-data';

@Component({
  selector: 'lib-no-workspace-page',
  imports: [TranslocoPipe],
  template: `<main
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-text-primary"
  >
    <p class="text-lg">{{ 'shell.noWorkspace.message' | transloco }}</p>
    <button
      type="button"
      class="min-h-touch rounded-btn px-4 py-2 text-sm font-medium text-primary-from underline"
      (click)="onLogout()"
    >
      {{ 'shell.noWorkspace.logout' | transloco }}
    </button>
  </main>`,
})
export class NoWorkspacePageComponent {
  private readonly router = inject(Router);
  private readonly logoutSession = inject(SESSION_LOGOUT);

  protected onLogout(): void {
    this.logoutSession().subscribe({
      complete: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}
