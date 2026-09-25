import 'reflect-metadata';

import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { BudgetModule } from './budget.module.js';

/** Route prefix every workspace-scoped budget controller must live under. */
const WORKSPACE_BUDGET_PREFIX = 'workspaces/:workspaceId/budget';

/** Class-level guards every workspace-scoped budget controller must declare, in order. */
const EXPECTED_GUARD_NAMES = [
  'SessionGuard',
  'ActiveUserGuard',
  'WorkspaceMemberGuard',
] as const;

/** `BudgetModule` controllers that are deliberately not workspace-scoped. */
const NON_WORKSPACE_CONTROLLERS: readonly string[] = ['RatesController'];

/** Guards against an empty enumeration silently passing every per-controller check. */
const MIN_WORKSPACE_CONTROLLERS = 4;

type ControllerClass = abstract new (...args: never[]) => unknown;

function listWorkspaceScopedControllers(): ControllerClass[] {
  const controllers = (Reflect.getMetadata('controllers', BudgetModule) ??
    []) as ControllerClass[];
  return controllers.filter(
    (controller) => !NON_WORKSPACE_CONTROLLERS.includes(controller.name),
  );
}

function readControllerPath(controller: ControllerClass): string {
  const raw: unknown = Reflect.getMetadata(PATH_METADATA, controller);
  const path = Array.isArray(raw) ? String(raw[0]) : String(raw);
  return path.replace(/^\/+/, '');
}

function readClassGuardNames(controller: ControllerClass): string[] {
  const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as {
    name: string;
  }[];
  return guards.map((guard) => guard.name);
}

const workspaceControllers = listWorkspaceScopedControllers();

describe('BudgetModule workspace-scoped routes', () => {
  it(`enumerates at least ${MIN_WORKSPACE_CONTROLLERS} workspace-scoped controllers`, () => {
    expect(workspaceControllers.length).toBeGreaterThanOrEqual(
      MIN_WORKSPACE_CONTROLLERS,
    );
  });

  describe.each(
    workspaceControllers.map((controller) => [controller.name, controller]),
  )('%s', (_name, controller) => {
    it(`is mounted under ${WORKSPACE_BUDGET_PREFIX}`, () => {
      const path = readControllerPath(controller);

      expect(
        path === WORKSPACE_BUDGET_PREFIX ||
          path.startsWith(`${WORKSPACE_BUDGET_PREFIX}/`),
        `controller path "${path}"`,
      ).toBe(true);
    });

    it('declares session, active-user and workspace-member guards in order', () => {
      expect(readClassGuardNames(controller)).toEqual(EXPECTED_GUARD_NAMES);
    });
  });
});
