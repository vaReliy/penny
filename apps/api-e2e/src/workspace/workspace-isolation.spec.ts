import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AxiosResponse, Method } from 'axios';

import {
  SEEDED_MONTH,
  WA_BUDGET_MINOR_UNITS,
  WA_EXPENSE_MINOR_UNITS,
  WRITE_AMOUNT_MINOR_UNITS,
  WRITE_DATE,
  WRITE_MONTH,
  apiRequest,
  cleanupIsolationFixture,
  seedCategory,
  seedIsolationFixture,
} from '../support/workspace-fixtures.js';
import type {
  IsolationFixture,
  SeededWorkspace,
  TestUser,
} from '../support/workspace-fixtures.js';

/** A `:workspaceId` path segment that is not a valid ObjectId. */
const MALFORMED_WORKSPACE_ID = 'not-an-id';

/** Amount used by cross-workspace write attempts — distinct from every other seeded/written amount. */
const FOREIGN_WRITE_MINOR_UNITS = 333;

/** Stand-in `:workspaceId` segment substituted per request by {@link prepareEndpoint}. */
const WORKSPACE_ID_PLACEHOLDER = 'workspace-id-placeholder';

let fixture: IsolationFixture;
let nameCounter = 0;

function uniqueName(prefix: string): string {
  nameCounter += 1;
  return `${prefix} ${fixture.runId}-${nameCounter}`;
}

function budgetUrl(workspaceId: string, path: string): string {
  return `/api/workspaces/${workspaceId}/budget/${path}`;
}

interface BuiltRequest {
  readonly url: string;
  readonly body?: unknown;
}

interface EndpointCase {
  readonly label: string;
  readonly method: Method;
  /** Builds the request for path segment `pathWorkspaceId`, using ids that belong to `target`. */
  readonly build: (
    pathWorkspaceId: string,
    target: SeededWorkspace,
  ) => Promise<BuiltRequest>;
}

const ENDPOINTS: readonly EndpointCase[] = [
  {
    label: 'GET balance',
    method: 'GET',
    build: async (ws) => ({ url: budgetUrl(ws, 'balance') }),
  },
  {
    label: 'GET summary',
    method: 'GET',
    build: async (ws) => ({
      url: budgetUrl(ws, `summary?month=${SEEDED_MONTH}`),
    }),
  },
  {
    label: 'GET chart',
    method: 'GET',
    build: async (ws) => ({
      url: budgetUrl(ws, `chart?month=${SEEDED_MONTH}`),
    }),
  },
  {
    label: 'GET categories',
    method: 'GET',
    build: async (ws) => ({ url: budgetUrl(ws, 'categories') }),
  },
  {
    label: 'POST categories',
    method: 'POST',
    build: async (ws) => ({
      url: budgetUrl(ws, 'categories'),
      body: { name: uniqueName('created') },
    }),
  },
  {
    label: 'PATCH categories/:id',
    method: 'PATCH',
    build: async (ws, target) => {
      const id = await seedCategory(
        fixture.connection,
        target.id,
        uniqueName('rename target'),
      );
      return {
        url: budgetUrl(ws, `categories/${id}`),
        body: { name: uniqueName('renamed') },
      };
    },
  },
  {
    label: 'POST categories/:id/archive',
    method: 'POST',
    build: async (ws, target) => {
      const id = await seedCategory(
        fixture.connection,
        target.id,
        uniqueName('archive target'),
      );
      return { url: budgetUrl(ws, `categories/${id}/archive`) };
    },
  },
  {
    label: 'POST transactions',
    method: 'POST',
    build: async (ws, target) => ({
      url: budgetUrl(ws, 'transactions'),
      body: {
        accountId: target.scratchAccountId,
        categoryId: target.categoryId,
        type: 'expense',
        amountMinorUnits: WRITE_AMOUNT_MINOR_UNITS,
        date: WRITE_DATE,
      },
    }),
  },
  {
    label: 'GET transactions',
    method: 'GET',
    build: async (ws) => ({
      url: budgetUrl(ws, `transactions?month=${SEEDED_MONTH}`),
    }),
  },
  {
    label: 'GET transactions/:id',
    method: 'GET',
    build: async (ws, target) => ({
      url: budgetUrl(ws, `transactions/${target.transactionId}`),
    }),
  },
  {
    label: 'GET monthly-budgets',
    method: 'GET',
    build: async (ws) => ({
      url: budgetUrl(ws, `monthly-budgets?month=${SEEDED_MONTH}`),
    }),
  },
  {
    label: 'PUT monthly-budgets',
    method: 'PUT',
    build: async (ws, target) => ({
      url: budgetUrl(ws, 'monthly-budgets'),
      body: {
        categoryId: target.categoryId,
        month: WRITE_MONTH,
        amountMinorUnits: WRITE_AMOUNT_MINOR_UNITS,
      },
    }),
  },
];

async function callEndpoint(
  user: TestUser,
  endpoint: EndpointCase,
  pathWorkspaceId: string,
  target: SeededWorkspace,
): Promise<AxiosResponse> {
  const { url, body } = await endpoint.build(pathWorkspaceId, target);
  return apiRequest(user, endpoint.method, url, body);
}

/**
 * Builds `endpoint`'s request once (same inner ids, same body) and returns a
 * sender that varies only the caller and the `:workspaceId` segment, so two
 * responses being compared differ in nothing else.
 */
async function prepareEndpoint(
  endpoint: EndpointCase,
  target: SeededWorkspace,
): Promise<
  (user: TestUser, pathWorkspaceId: string) => Promise<AxiosResponse>
> {
  const template = await endpoint.build(WORKSPACE_ID_PLACEHOLDER, target);
  return (user, pathWorkspaceId) =>
    apiRequest(
      user,
      endpoint.method,
      template.url.replace(WORKSPACE_ID_PLACEHOLDER, pathWorkspaceId),
      template.body,
    );
}

function describeResponse(res: AxiosResponse): string {
  return `${res.status} ${JSON.stringify(res.data)}`;
}

/** Asserts a member request on its own workspace succeeded — the check that keeps every 404 assertion honest. */
function expectPositiveControl(res: AxiosResponse, label: string): void {
  expect(
    res.status >= 200 && res.status < 300,
    `positive control (${label}) expected 2xx, got ${describeResponse(res)}`,
  ).toBe(true);
}

function expectClientError(res: AxiosResponse): void {
  expect(
    res.status >= 400 && res.status < 500,
    `expected 4xx, got ${describeResponse(res)}`,
  ).toBe(true);
}

function idsOf(res: AxiosResponse): string[] {
  return (res.data as { id: string }[]).map((item) => item.id);
}

/** Serialized snapshot of every document in `collection` belonging to either seeded workspace. */
async function snapshotBothWorkspaces(collection: string): Promise<string[]> {
  const docs = await fixture.connection
    .collection(collection)
    .find({ workspaceId: { $in: [fixture.wa.id, fixture.wb.id] } })
    .toArray();
  return docs.map((doc) => JSON.stringify(doc)).sort();
}

async function snapshotDocument(
  collection: string,
  id: string,
): Promise<string> {
  const docs = await fixture.connection
    .collection(collection)
    .find({ workspaceId: fixture.wb.id })
    .toArray();
  return JSON.stringify(docs.find((doc) => doc._id.toHexString() === id));
}

beforeAll(async () => {
  fixture = await seedIsolationFixture();
});

afterAll(async () => {
  await cleanupIsolationFixture(fixture);
});

describe('isolation suite setup', () => {
  it('authenticates every seeded user via the session cookie', async () => {
    for (const user of [fixture.userA, fixture.userB, fixture.superadmin]) {
      const res = await apiRequest(user, 'GET', '/api/auth/me');

      expect(res.status, describeResponse(res)).toBe(200);
      expect(res.data).toMatchObject({ id: user.id, status: 'active' });
    }
  });

  it('carries the SUPERADMIN role for the superadmin user', async () => {
    const res = await apiRequest(fixture.superadmin, 'GET', '/api/auth/me');

    expect(res.status, describeResponse(res)).toBe(200);
    expect(res.data).toMatchObject({ roles: ['superadmin'] });
  });

  it('passes the CSRF guard on a mutating request', async () => {
    const res = await apiRequest(fixture.userA, 'POST', '/api/auth/logout');

    expect(res.status, describeResponse(res)).toBe(204);
  });
});

describe.each(ENDPOINTS)('non-member access: $label', (endpoint) => {
  it('positive control: a member reaches their own workspace', async () => {
    const res = await callEndpoint(
      fixture.userA,
      endpoint,
      fixture.wa.id,
      fixture.wa,
    );

    expectPositiveControl(res, `${endpoint.label} as WA member`);
  });

  it('returns 404 to a user who is not a member of the workspace', async () => {
    const res = await callEndpoint(
      fixture.userB,
      endpoint,
      fixture.wa.id,
      fixture.wa,
    );

    expect(res.status, describeResponse(res)).toBe(404);
  });
});

describe.each(ENDPOINTS)(
  'unknown and malformed workspace ids: $label',
  (endpoint) => {
    it('positive control: a member reaches their own workspace', async () => {
      const res = await callEndpoint(
        fixture.userA,
        endpoint,
        fixture.wa.id,
        fixture.wa,
      );

      expectPositiveControl(res, `${endpoint.label} as WA member`);
    });

    it('answers a nonexistent workspace id exactly like a non-member request', async () => {
      const send = await prepareEndpoint(endpoint, fixture.wa);
      const nonMember = await send(fixture.userB, fixture.wa.id);
      const unknown = await send(fixture.userA, fixture.ghostWorkspaceId);

      expect(nonMember.status, describeResponse(nonMember)).toBe(404);
      expect(unknown.status, describeResponse(unknown)).toBe(nonMember.status);
      expect(unknown.data).toEqual(nonMember.data);
    });

    it('answers a malformed workspace id exactly like a non-member request', async () => {
      const send = await prepareEndpoint(endpoint, fixture.wa);
      const nonMember = await send(fixture.userB, fixture.wa.id);
      const malformed = await send(fixture.userA, MALFORMED_WORKSPACE_ID);

      expect(nonMember.status, describeResponse(nonMember)).toBe(404);
      expect(malformed.status, describeResponse(malformed)).toBe(
        nonMember.status,
      );
      expect(malformed.data).toEqual(nonMember.data);
    });
  },
);

describe.each(ENDPOINTS)('superadmin non-member: $label', (endpoint) => {
  it('positive control: a member reaches their own workspace', async () => {
    const res = await callEndpoint(
      fixture.userB,
      endpoint,
      fixture.wb.id,
      fixture.wb,
    );

    expectPositiveControl(res, `${endpoint.label} as WB member`);
  });

  it('gives a SUPERADMIN who is not a member the same 404 as any non-member', async () => {
    const send = await prepareEndpoint(endpoint, fixture.wb);
    const nonMember = await send(fixture.userA, fixture.wb.id);
    const superadmin = await send(fixture.superadmin, fixture.wb.id);

    expect(superadmin.status, describeResponse(superadmin)).toBe(404);
    expect(superadmin.status).toBe(nonMember.status);
    expect(superadmin.data).toEqual(nonMember.data);
  });
});

describe('ids from another workspace in the request body', () => {
  function transactionBody(
    accountId: string,
    categoryId: string,
  ): Record<string, unknown> {
    return {
      accountId,
      categoryId,
      type: 'expense',
      amountMinorUnits: FOREIGN_WRITE_MINOR_UNITS,
      date: WRITE_DATE,
    };
  }

  it('positive control: a member records a transaction with own-workspace ids', async () => {
    const res = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, 'transactions'),
      transactionBody(fixture.wa.scratchAccountId, fixture.wa.categoryId),
    );

    expectPositiveControl(res, 'POST transactions with WA ids');
  });

  it("rejects a transaction that names another workspace's category and writes nothing", async () => {
    const control = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, 'transactions'),
      transactionBody(fixture.wa.scratchAccountId, fixture.wa.categoryId),
    );
    expectPositiveControl(control, 'POST transactions with WA ids');
    const before = await snapshotBothWorkspaces('transactions');

    const res = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, 'transactions'),
      transactionBody(fixture.wa.scratchAccountId, fixture.wb.categoryId),
    );

    expectClientError(res);
    expect(await snapshotBothWorkspaces('transactions')).toEqual(before);
  });

  it("rejects a transaction that names another workspace's account and writes nothing", async () => {
    const control = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, 'transactions'),
      transactionBody(fixture.wa.scratchAccountId, fixture.wa.categoryId),
    );
    expectPositiveControl(control, 'POST transactions with WA ids');
    const before = await snapshotBothWorkspaces('transactions');

    const res = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, 'transactions'),
      transactionBody(fixture.wb.accountId, fixture.wa.categoryId),
    );

    expectClientError(res);
    expect(await snapshotBothWorkspaces('transactions')).toEqual(before);
  });

  it("rejects a monthly budget for another workspace's category and writes nothing", async () => {
    const control = await apiRequest(
      fixture.userA,
      'PUT',
      budgetUrl(fixture.wa.id, 'monthly-budgets'),
      {
        categoryId: fixture.wa.categoryId,
        month: WRITE_MONTH,
        amountMinorUnits: WRITE_AMOUNT_MINOR_UNITS,
      },
    );
    expectPositiveControl(control, 'PUT monthly-budgets with WA category');
    const before = await snapshotBothWorkspaces('monthlyBudgets');

    const res = await apiRequest(
      fixture.userA,
      'PUT',
      budgetUrl(fixture.wa.id, 'monthly-budgets'),
      {
        categoryId: fixture.wb.categoryId,
        month: WRITE_MONTH,
        amountMinorUnits: FOREIGN_WRITE_MINOR_UNITS,
      },
    );

    expectClientError(res);
    expect(await snapshotBothWorkspaces('monthlyBudgets')).toEqual(before);
  });
});

describe('ids from another workspace in the request path', () => {
  it('positive control: a member renames a category in their own workspace', async () => {
    const id = await seedCategory(
      fixture.connection,
      fixture.wa.id,
      uniqueName('rename target'),
    );

    const res = await apiRequest(
      fixture.userA,
      'PATCH',
      budgetUrl(fixture.wa.id, `categories/${id}`),
      { name: uniqueName('renamed') },
    );

    expectPositiveControl(res, 'PATCH own category');
  });

  it("returns 404 when renaming another workspace's category and leaves it unchanged", async () => {
    const ownId = await seedCategory(
      fixture.connection,
      fixture.wa.id,
      uniqueName('rename target'),
    );
    const control = await apiRequest(
      fixture.userA,
      'PATCH',
      budgetUrl(fixture.wa.id, `categories/${ownId}`),
      { name: uniqueName('renamed') },
    );
    expectPositiveControl(control, 'PATCH own category');
    const before = await snapshotDocument('categories', fixture.wb.categoryId);

    const res = await apiRequest(
      fixture.userA,
      'PATCH',
      budgetUrl(fixture.wa.id, `categories/${fixture.wb.categoryId}`),
      { name: uniqueName('hijacked') },
    );

    expect(res.status, describeResponse(res)).toBe(404);
    expect(await snapshotDocument('categories', fixture.wb.categoryId)).toBe(
      before,
    );
  });

  it("returns 404 when archiving another workspace's category and leaves it unchanged", async () => {
    const ownId = await seedCategory(
      fixture.connection,
      fixture.wa.id,
      uniqueName('archive target'),
    );
    const control = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, `categories/${ownId}/archive`),
    );
    expectPositiveControl(control, 'archive own category');
    const before = await snapshotDocument('categories', fixture.wb.categoryId);

    const res = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, `categories/${fixture.wb.categoryId}/archive`),
    );

    expect(res.status, describeResponse(res)).toBe(404);
    expect(await snapshotDocument('categories', fixture.wb.categoryId)).toBe(
      before,
    );
  });

  it("returns 404 when reading another workspace's transaction", async () => {
    const control = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, `transactions/${fixture.wa.transactionId}`),
    );
    expectPositiveControl(control, 'GET own transaction');

    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, `transactions/${fixture.wb.transactionId}`),
    );

    expect(res.status, describeResponse(res)).toBe(404);
  });
});

describe('a workspace id outside the path is ignored', () => {
  it('positive control: a member lists categories of their own workspace', async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, 'categories'),
    );

    expectPositiveControl(res, 'GET own categories');
  });

  it('creates a category in the path workspace even when the body names another', async () => {
    const created = await apiRequest(
      fixture.userA,
      'POST',
      budgetUrl(fixture.wa.id, 'categories'),
      { name: uniqueName('body workspace'), workspaceId: fixture.wb.id },
    );
    expectPositiveControl(created, 'POST own category with foreign body id');
    const createdId = (created.data as { id: string }).id;

    const waList = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, 'categories'),
    );
    const wbList = await apiRequest(
      fixture.userB,
      'GET',
      budgetUrl(fixture.wb.id, 'categories'),
    );

    expectPositiveControl(waList, 'GET WA categories');
    expectPositiveControl(wbList, 'GET WB categories');
    expect(idsOf(waList)).toContain(createdId);
    expect(idsOf(wbList)).not.toContain(createdId);
  });

  it('lists only path-workspace transactions when the query names another workspace', async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(
        fixture.wa.id,
        `transactions?month=${SEEDED_MONTH}&workspaceId=${fixture.wb.id}`,
      ),
    );

    expectPositiveControl(res, 'GET own transactions with foreign query id');
    expect(idsOf(res)).toContain(fixture.wa.transactionId);
    expect(idsOf(res)).not.toContain(fixture.wb.transactionId);
  });

  it('lists only path-workspace categories when the query names another workspace', async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, `categories?workspaceId=${fixture.wb.id}`),
    );

    expectPositiveControl(res, 'GET own categories with foreign query id');
    expect(idsOf(res)).toContain(fixture.wa.categoryId);
    expect(idsOf(res)).not.toContain(fixture.wb.categoryId);
  });
});

describe("reads never include another workspace's data", () => {
  it('positive control: a member reads the balance of their own workspace', async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, 'balance'),
    );

    expectPositiveControl(res, 'GET own balance');
  });

  it("lists none of the other workspace's categories, transactions or monthly budgets", async () => {
    const categories = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, 'categories'),
    );
    const transactions = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, `transactions?month=${SEEDED_MONTH}`),
    );
    const budgets = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, `monthly-budgets?month=${SEEDED_MONTH}`),
    );

    expectPositiveControl(categories, 'GET own categories');
    expectPositiveControl(transactions, 'GET own transactions');
    expectPositiveControl(budgets, 'GET own monthly budgets');

    expect(idsOf(categories)).toContain(fixture.wa.categoryId);
    expect(idsOf(categories)).not.toContain(fixture.wb.categoryId);
    expect(idsOf(transactions)).toContain(fixture.wa.transactionId);
    expect(idsOf(transactions)).not.toContain(fixture.wb.transactionId);
    expect(idsOf(budgets)).toContain(fixture.wa.monthlyBudgetId);
    expect(idsOf(budgets)).not.toContain(fixture.wb.monthlyBudgetId);
  });

  it("computes the balance from the path workspace's transactions only", async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, 'balance'),
    );

    expectPositiveControl(res, 'GET own balance');
    expect(res.data).toEqual({
      accountId: fixture.wa.accountId,
      balance: { amount: String(-WA_EXPENSE_MINOR_UNITS), currency: 'UAH' },
    });
  });

  it("summarizes the path workspace's budget and spending only", async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, `summary?month=${SEEDED_MONTH}`),
    );

    expectPositiveControl(res, 'GET own summary');
    const { categories } = res.data as {
      categories: { categoryId: string }[];
    };
    expect(categories.map((entry) => entry.categoryId)).not.toContain(
      fixture.wb.categoryId,
    );
    expect(
      categories.find((entry) => entry.categoryId === fixture.wa.categoryId),
    ).toEqual({
      categoryId: fixture.wa.categoryId,
      budgeted: { amount: String(WA_BUDGET_MINOR_UNITS), currency: 'UAH' },
      spent: { amount: String(WA_EXPENSE_MINOR_UNITS), currency: 'UAH' },
      remaining: {
        amount: String(WA_BUDGET_MINOR_UNITS - WA_EXPENSE_MINOR_UNITS),
        currency: 'UAH',
      },
    });
  });

  it("charts the path workspace's spending only", async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      budgetUrl(fixture.wa.id, `chart?month=${SEEDED_MONTH}`),
    );

    expectPositiveControl(res, 'GET own chart');
    const entries = res.data as {
      categoryId: string;
      value: { amount: string; currency: string };
    }[];
    expect(entries.map((entry) => entry.categoryId)).not.toContain(
      fixture.wb.categoryId,
    );
    expect(
      entries.find((entry) => entry.categoryId === fixture.wa.categoryId)
        ?.value,
    ).toEqual({ amount: String(WA_EXPENSE_MINOR_UNITS), currency: 'UAH' });
  });
});

describe('GET /api/workspaces', () => {
  it("returns exactly the caller's own workspaces", async () => {
    const res = await apiRequest(fixture.userA, 'GET', '/api/workspaces');

    expect(res.status, describeResponse(res)).toBe(200);
    expect(res.data).toEqual([
      {
        id: fixture.wa.id,
        name: fixture.wa.name,
        role: 'admin',
        grantedAt: fixture.wa.grantedAt.toISOString(),
      },
    ]);
  });

  it('returns an empty list to a SUPERADMIN who belongs to no workspace', async () => {
    const res = await apiRequest(fixture.superadmin, 'GET', '/api/workspaces');

    expect(res.status, describeResponse(res)).toBe(200);
    expect(res.data).toEqual([]);
  });
});

describe('legacy budget routes', () => {
  it('no longer serves /api/budget/categories', async () => {
    const res = await apiRequest(
      fixture.userA,
      'GET',
      '/api/budget/categories',
    );

    expect(res.status, describeResponse(res)).toBe(404);
  });
});
