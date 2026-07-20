import { Component, inject } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CdkMenuModule } from '@angular/cdk/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { SESSION_LOGOUT } from 'shared-web-shell-data';
import { SHELL_NAV_ITEMS } from '../shell-nav-item';

@Component({
  selector: 'lib-app-shell',
  imports: [
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

  protected readonly navItems = SHELL_NAV_ITEMS;

  protected onLogout(): void {
    this.logoutSession().subscribe({
      complete: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}
