import { Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CdkMenuModule } from '@angular/cdk/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CurrentWorkspace,
  SESSION_LOGOUT,
  WorkspaceClient,
} from 'shared-web-shell-data';
import { SHELL_NAV_ITEMS } from '../shell-nav-item';

@Component({
  selector: 'lib-app-shell',
  imports: [
    NgClass,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    CdkMenuModule,
    TranslocoPipe,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly logoutSession = inject(SESSION_LOGOUT);
  private readonly currentWorkspace = inject(CurrentWorkspace);
  private readonly workspaceClient = inject(WorkspaceClient);

  public constructor() {
    // Routes outside `w/:workspaceId` (e.g. `greeting`) never run
    // `workspaceGuard`, so the nav links have no workspace id to resolve to
    // unless the shell populates it itself on first mount.
    if (this.currentWorkspace.currentId() === null) {
      this.workspaceClient.list().subscribe((workspaces) => {
        this.currentWorkspace.setWorkspaces(workspaces);
        if (workspaces.length === 0) {
          return;
        }
        const lastUsedId = this.currentWorkspace.getLastUsedId();
        const target =
          workspaces.find((workspace) => workspace.id === lastUsedId) ??
          workspaces[0];
        this.currentWorkspace.setCurrentId(target.id);
      });
    }
  }

  protected readonly navLinks = computed(() => {
    const workspaceId = this.currentWorkspace.currentId();
    return SHELL_NAV_ITEMS.map((item) => ({
      ...item,
      route: workspaceId !== null ? ['/w', workspaceId, item.path] : [],
    }));
  });

  protected onLogout(): void {
    this.logoutSession().subscribe({
      complete: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}
