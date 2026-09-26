import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { WorkspaceSummaryDto } from 'shared-contracts';
import { CurrentWorkspace } from './current-workspace.store';

const WORKSPACE_A: WorkspaceSummaryDto = {
  id: 'a',
  name: 'Workspace A',
  role: 'admin',
  grantedAt: '2026-01-01T00:00:00.000Z',
};

const WORKSPACE_B: WorkspaceSummaryDto = {
  id: 'b',
  name: 'Workspace B',
  role: 'member',
  grantedAt: '2026-02-01T00:00:00.000Z',
};

describe('CurrentWorkspace', () => {
  let store: CurrentWorkspace;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(CurrentWorkspace);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts with no workspaces and no current workspace', () => {
    expect(store.workspaces()).toEqual([]);
    expect(store.currentId()).toBeNull();
    expect(store.current()).toBeNull();
  });

  it('exposes the workspace matching currentId once both are set', () => {
    store.setWorkspaces([WORKSPACE_A, WORKSPACE_B]);
    store.setCurrentId('b');

    expect(store.current()).toEqual(WORKSPACE_B);
  });

  it('writes the last-used id to localStorage on workspace change', () => {
    store.setCurrentId('a');

    expect(localStorage.getItem('penny.lastWorkspaceId')).toBe('a');
  });

  it('reads the last-used id back from localStorage', () => {
    localStorage.setItem('penny.lastWorkspaceId', 'b');

    expect(store.getLastUsedId()).toBe('b');
  });

  it('survives localStorage.setItem throwing', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable');
      });

    expect(() => store.setCurrentId('a')).not.toThrow();
    expect(store.currentId()).toBe('a');

    setItemSpy.mockRestore();
  });

  it('survives localStorage.getItem throwing', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable');
      });

    expect(store.getLastUsedId()).toBeNull();

    getItemSpy.mockRestore();
  });
});
