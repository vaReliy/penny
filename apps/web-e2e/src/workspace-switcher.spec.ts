import { test, expect } from '@playwright/test';

const ME_URL = '**/auth/me';
const CONFIG_URL = '**/api/config';
const WORKSPACES_URL = '**/api/workspaces';
const BALANCE_URL = '**/api/workspaces/*/budget/balance';
const RATES_URL = '**/api/rates';

const activeUser = {
  id: '3',
  firstName: 'Petro',
  telegramId: 123456,
  status: 'active',
};

const twoWorkspaces = [
  {
    id: 'w1',
    name: 'Family',
    role: 'admin',
    grantedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'w2',
    name: 'Business',
    role: 'member',
    grantedAt: '2026-01-02T00:00:00.000Z',
  },
];

const balanceResponse = {
  accountId: 'a1',
  balance: { amount: '415000', currency: 'UAH' },
};

const ratesResponse = {
  base: 'UAH',
  rates: [
    { currency: 'USD', rateToBase: '41.5000' },
    { currency: 'EUR', rateToBase: '45.0000' },
  ],
  asOf: '2026-01-01T00:00:00.000Z',
};

function mockCommon(
  page: import('@playwright/test').Page,
  workspaces: unknown[],
) {
  return Promise.all([
    page.route(CONFIG_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ telegramBotUsername: 'TEST_BOT' }),
      }),
    ),
    page.route(ME_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(activeUser),
      }),
    ),
    page.route(WORKSPACES_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(workspaces),
      }),
    ),
    page.route(BALANCE_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(balanceResponse),
      }),
    ),
    page.route(RATES_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ratesResponse),
      }),
    ),
  ]);
}

test.describe('workspace switcher', () => {
  test('switching A -> B changes the URL and the next budget request goes to /api/workspaces/B/...', async ({
    page,
  }) => {
    await mockCommon(page, twoWorkspaces);
    const requestedWorkspaceIds: string[] = [];
    page.on('request', (request) => {
      const match = /\/api\/workspaces\/([^/]+)\/budget\/balance/.exec(
        request.url(),
      );
      if (match) {
        requestedWorkspaceIds.push(match[1]);
      }
    });

    await page.goto('/w/w1/account');
    await page.waitForURL('**/w/w1/account');
    await expect(page.getByText('Family')).toBeVisible();

    await page.getByRole('button', { name: 'Робочий простір: Family' }).click();
    await page.getByRole('menuitem', { name: 'Business' }).click();

    await page.waitForURL('**/w/w2/account');
    expect(page.url()).toContain('/w/w2/account');
    expect(requestedWorkspaceIds).toContain('w2');
  });

  test('opening /w/<unknown>/account lands on /w/<first>/account with no error shown', async ({
    page,
  }) => {
    await mockCommon(page, twoWorkspaces);

    await page.goto('/w/does-not-exist/account');
    await page.waitForURL('**/w/w1/account');

    await expect(page.getByText('Family')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('GET /api/workspaces -> [] lands on the no-workspace screen with the Ukrainian copy', async ({
    page,
  }) => {
    await mockCommon(page, []);

    await page.goto('/w/w1/account');
    await page.waitForURL('**/no-workspace');

    await expect(
      page.getByText(
        'Вас ще не додано до жодного робочого простору. Зверніться до адміністратора.',
      ),
    ).toBeVisible();
  });

  test('at a 390px viewport, the switcher is visible and operable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCommon(page, twoWorkspaces);

    await page.goto('/w/w1/account');
    await page.waitForURL('**/w/w1/account');

    const trigger = page.getByRole('button', {
      name: 'Робочий простір: Family',
    });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(
      page.getByRole('menuitem', { name: 'Business' }),
    ).toBeVisible();
  });

  test('single-workspace case: switcher shows the name and has no menu', async ({
    page,
  }) => {
    await mockCommon(page, [twoWorkspaces[0]]);

    await page.goto('/w/w1/account');
    await page.waitForURL('**/w/w1/account');

    const trigger = page.getByRole('button', {
      name: 'Робочий простір: Family',
    });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('menuitem')).toHaveCount(0);
  });
});
