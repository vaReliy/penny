import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CdkMenuModule } from '@angular/cdk/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrentWorkspace } from 'shared-web-shell-data';

/** Extracts the top-level screen segment from a `/w/<id>/<screen>/...` URL. */
function screenSegmentOf(url: string): string {
  const segments = url.split('?')[0].split('/').filter(Boolean);
  return segments[2] ?? '';
}

@Component({
  selector: 'lib-workspace-switcher',
  imports: [CdkMenuModule, TranslocoPipe],
  templateUrl: './workspace-switcher.html',
  styleUrl: './workspace-switcher.css',
})
export class WorkspaceSwitcherComponent {
  private readonly router = inject(Router);
  private readonly currentWorkspace = inject(CurrentWorkspace);

  protected readonly current = this.currentWorkspace.current;
  protected readonly workspaces = this.currentWorkspace.workspaces;
  protected readonly hasMultiple = computed(() => this.workspaces().length > 1);
  protected readonly triggerLabelParams = computed(() => ({
    name: this.current()?.name ?? '',
  }));

  protected selectWorkspace(id: string): void {
    if (id === this.currentWorkspace.currentId()) {
      return;
    }
    const screen = screenSegmentOf(this.router.url);
    this.currentWorkspace.setCurrentId(id);
    void this.router.navigate(['/w', id, screen]);
  }
}
