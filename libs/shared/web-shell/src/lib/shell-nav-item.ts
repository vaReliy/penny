export interface ShellNavItem {
  readonly path: string;
  readonly labelKey: string;
  /** SVG path `d` attribute data for a 24x24 stroke icon. */
  readonly icon: string;
}

export const SHELL_NAV_ITEMS: readonly ShellNavItem[] = [
  {
    path: 'account',
    labelKey: 'shell.nav.account',
    icon: 'M3 10h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm12 7h.01',
  },
  {
    path: 'history',
    labelKey: 'shell.nav.history',
    icon: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  {
    path: 'planner',
    labelKey: 'shell.nav.planner',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z',
  },
  {
    path: 'records',
    labelKey: 'shell.nav.records',
    icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6m-6 4h6',
  },
];
