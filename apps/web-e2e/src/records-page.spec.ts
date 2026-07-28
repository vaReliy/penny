import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

const ME_URL = '**/auth/me';
const CONFIG_URL = '**/api/config';
const CATEGORIES_URL = '**/api/budget/categories';
const TRANSACTIONS_URL = '**/api/budget/transactions';
const BALANCE_URL = '**/api/budget/balance';
const RATES_URL = '**/api/rates';

const activeUser = {
  id: '3',
  firstName: 'Petro',
  telegramId: 123456,
  status: 'active',
};

const ratesResponse = {
  base: 'UAH',
  rates: [{ currency: 'USD', rateToBase: '41.5000' }],
  asOf: '2026-07-27T10:00:00.000Z',
};

/**
 * Wires the mock backend shared by every test in this file: auth/config
 * pass-through, a stateful in-memory category list (POST appends, GET
 * reflects it), and a stateful balance that GET reads back after every
 * recorded transaction — this is what lets a create-category → record
 * income/expense flow produce a verifiable, exact derived balance without a
 * real API.
 */
async function mockBudgetBackend(page: import('@playwright/test').Page) {
  await page.route(CONFIG_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ telegramBotUsername: 'TEST_BOT' }),
    }),
  );
  await page.route(ME_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(activeUser),
    }),
  );

  const categories: { id: string; name: string }[] = [];
  let nextCategoryId = 1;
  await page.route(CATEGORIES_URL, (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(categories),
      });
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { name: string };
      const created = { id: `c${nextCategoryId}`, name: body.name };
      nextCategoryId += 1;
      categories.push(created);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    }
    return route.continue();
  });

  let balanceMinorUnits = 0;
  let nextTransactionId = 1;
  await page.route(BALANCE_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accountId: 'a1',
        balance: { amount: String(balanceMinorUnits), currency: 'UAH' },
      }),
    }),
  );
  await page.route(TRANSACTIONS_URL, (route: Route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      return route.continue();
    }
    const body = request.postDataJSON() as {
      categoryId: string;
      type: 'income' | 'expense';
      amountMinorUnits: number;
      date: string;
    };
    balanceMinorUnits +=
      body.type === 'income' ? body.amountMinorUnits : -body.amountMinorUnits;
    const created = {
      id: `t${nextTransactionId}`,
      accountId: 'a1',
      categoryId: body.categoryId,
      type: body.type,
      amount: { amount: String(body.amountMinorUnits), currency: 'UAH' },
      date: body.date,
      createdBy: activeUser.id,
      createdAt: '2026-07-28T10:00:00.000Z',
    };
    nextTransactionId += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  await page.route(RATES_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ratesResponse),
    }),
  );
}

test.describe('records screen («Записи») — money round trip', () => {
  test('create a category, record income + expense, and the account balance reflects both exactly', async ({
    page,
  }) => {
    await mockBudgetBackend(page);

    await page.goto('/records');
    await page.waitForURL('**/records');

    // No active category yet — the transaction form shows the empty-state
    // hint instead of a select with no usable options.
    await expect(page.getByText('Немає активних категорій')).toBeVisible();

    await page
      .getByLabel('Введіть назву', { exact: true })
      .first()
      .fill('Зарплата');
    await page.getByRole('button', { name: 'Додати категорію' }).click();
    await expect(page.getByText('Категорію додано!')).toBeVisible();

    // Record income: 1000.00 UAH.
    await page
      .getByLabel('Оберіть категорію')
      .selectOption({ label: 'Зарплата' });
    await page.getByLabel('Прибуток').check();
    await page.getByLabel('Введіть суму').fill('1000');
    await page.getByRole('button', { name: 'Додати', exact: true }).click();
    await expect(page.getByText('Подію успішно додано!')).toBeVisible();

    // Record expense: 300.00 UAH.
    await page
      .getByLabel('Оберіть категорію')
      .selectOption({ label: 'Зарплата' });
    await page.getByLabel('Витрата').check();
    await page.getByLabel('Введіть суму').fill('300');
    await page.getByRole('button', { name: 'Додати', exact: true }).click();
    await expect(page.getByText('Подію успішно додано!')).toBeVisible();

    // Net balance: 1000.00 - 300.00 = 700.00 UAH — assert the exact figure,
    // not just "changed", on the account screen this transaction affects.
    await page.goto('/account');
    await page.waitForURL('**/account');

    const balanceCard = page.getByRole('region', { name: 'Рахунок' });
    await expect(balanceCard.getByText(/700,00/)).toBeVisible();
  });

  test.describe('mobile viewport (360px width)', () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

    test('records screen renders with no horizontal scroll and both sections stack vertically', async ({
      page,
    }) => {
      await mockBudgetBackend(page);

      await page.goto('/records');
      await page.waitForURL('**/records');

      const transactionForm = page.getByRole('region', {
        name: 'Додати подію',
      });
      const categoryManager = page.getByRole('region', { name: 'Категорії' });
      await expect(transactionForm).toBeVisible();
      await expect(categoryManager).toBeVisible();

      const noHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(noHorizontalScroll).toBe(true);

      const formRect = await transactionForm.evaluate((el) =>
        el.getBoundingClientRect().toJSON(),
      );
      const managerRect = await categoryManager.evaluate((el) =>
        el.getBoundingClientRect().toJSON(),
      );
      expect(managerRect.y).toBeGreaterThanOrEqual(
        formRect.y + formRect.height - 1,
      );
    });
  });
});
