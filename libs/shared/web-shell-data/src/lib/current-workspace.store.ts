import { Injectable, computed, signal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import type { WorkspaceSummaryDto } from 'shared-contracts';

const LAST_WORKSPACE_ID_KEY = 'penny.lastWorkspaceId';

function readLastWorkspaceId(): string | null {
  try {
    return localStorage.getItem(LAST_WORKSPACE_ID_KEY);
  } catch {
    return null;
  }
}

function writeLastWorkspaceId(id: string): void {
  try {
    localStorage.setItem(LAST_WORKSPACE_ID_KEY, id);
  } catch {
    // Storage is a convenience only; the app works with it unavailable.
  }
}

/** Holds the workspaces the caller belongs to and which one is current. */
@Injectable({ providedIn: 'root' })
export class CurrentWorkspace {
  private readonly workspacesSignal: WritableSignal<
    readonly WorkspaceSummaryDto[]
  > = signal([]);
  private readonly currentIdSignal: WritableSignal<string | null> =
    signal(null);

  readonly workspaces: Signal<readonly WorkspaceSummaryDto[]> =
    this.workspacesSignal.asReadonly();
  readonly currentId: Signal<string | null> = this.currentIdSignal.asReadonly();
  readonly current: Signal<WorkspaceSummaryDto | null> = computed(() => {
    const id = this.currentIdSignal();
    return (
      this.workspacesSignal().find((workspace) => workspace.id === id) ?? null
    );
  });

  public setWorkspaces(workspaces: readonly WorkspaceSummaryDto[]): void {
    this.workspacesSignal.set(workspaces);
  }

  public setCurrentId(id: string): void {
    this.currentIdSignal.set(id);
    writeLastWorkspaceId(id);
  }

  public getLastUsedId(): string | null {
    return readLastWorkspaceId();
  }
}
