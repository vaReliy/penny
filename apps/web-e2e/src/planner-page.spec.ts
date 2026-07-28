import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

const ME_URL = '**/auth/me';
const CONFIG_URL = '**/api/config';
const CATEGORIES_URL = '**/api/budget/categories';
const SUMMARY_URL = '**/api/budget/summary*';
const MONTHLY_BUDGETS_URL = '**/api/budget/monthly-budgets*';

const activeUser = {
  id: '3',
  firstName: 'Petro',
  telegramId: 123456,
  status: 'active',
};

/**
 * Wires a mock backend with a stateful, per-month budgeted/spent ledger, so
 * `GET /api/budget/summary?month=...` reflects whatever budgets were PUT —
 * the planner screen's own view of the union of budgeted-or-spent
 * categories, not just a hard-coded fixture. Spend is seeded directly (API
 * seed, per the task's allowed alternative to driving the records screen —
 * that flow already has its own dedicated e2e coverage).
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

  const categories = [{ id: 'c1', name: 'Їжа' }];
  await page.route(CATEGORIES_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(categories),
    }),
  );

  const budgetsByMonth = new Map<string, Map<string, number>>();
  const spentByMonth = new Map<string, Map<string, number>>();

  await page.route(MONTHLY_BUDGETS_URL, (route: Route) => {
    const request = route.request();
    if (request.method() !== 'PUT') {
      return route.continue();
    }
    const body = request.postDataJSON() as {
      categoryId: string;
      month: string;
      amountMinorUnits: number;
    };
    const monthBudgets = budgetsByMonth.get(body.month) ?? new Map();
    monthBudgets.set(body.categoryId, body.amountMinorUnits);
    budgetsByMonth.set(body.month, monthBudgets);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `mb-${body.categoryId}-${body.month}`,
        categoryId: body.categoryId,
        month: body.month,
        amount: { amount: String(body.amountMinorUnits), currency: 'UAH' },
      }),
    });
  });

  await page.route(SUMMARY_URL, (route: Route) => {
    const url = new URL(route.request().url());
    const month = url.searchParams.get('month') ?? '';
    const monthBudgets = budgetsByMonth.get(month) ?? new Map();
    const monthSpend = spentByMonth.get(month) ?? new Map();
    const categoryIds = new Set([...monthBudgets.keys(), ...monthSpend.keys()]);
    const summaryCategories = [...categoryIds].map((categoryId) => {
      const budgeted = monthBudgets.get(categoryId) ?? 0;
      const spent = monthSpend.get(categoryId) ?? 0;
      return {
        categoryId,
        budgeted: { amount: String(budgeted), currency: 'UAH' },
        spent: { amount: String(spent), currency: 'UAH' },
        remaining: { amount: String(budgeted - spent), currency: 'UAH' },
      };
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ month, categories: summaryCategories }),
    });
  });

  return {
    seedExpense(month: string, categoryId: string, amountMinorUnits: number) {
      const monthSpend = spentByMonth.get(month) ?? new Map();
      monthSpend.set(
        categoryId,
        (monthSpend.get(categoryId) ?? 0) + amountMinorUnits,
      );
      spentByMonth.set(month, monthSpend);
    },
  };
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

test.describe('planner screen («Планувальник») — budget + spend round trip', () => {
  test('set a budget, seed an expense, and the planner shows the correct spent/remaining/color', async ({
    page,
  }) => {
    const backend = await mockBudgetBackend(page);
    backend.seedExpense(currentYearMonth(), 'c1', 95000);

    await page.goto('/planner');
    await page.waitForURL('**/planner');

    // Spend-but-no-budget renders distinctly before any budget is set.
    await expect(page.getByText(/Витрачено: .*950,00/).first()).toBeVisible();

    await page.getByRole('button', { name: /Бюджет:/ }).click();
    await page.getByLabel('Сума бюджету').fill('1000');
    await page.getByRole('button', { name: 'Зберегти' }).click();

    await expect(page.getByRole('button', { name: /1.?000,00/ })).toBeVisible();
    await expect(page.getByText(/Витрачено: .*950,00/).first()).toBeVisible();
    await expect(page.getByText(/Залишок: .*50,00/).first()).toBeVisible();

    const bar = page.locator('[role="progressbar"] > div');
    await expect(bar).toHaveClass(/bg-progress-danger/);
  });

  test('switching to a month with no budgets or spend shows the empty state', async ({
    page,
  }) => {
    await mockBudgetBackend(page);

    await page.goto('/planner');
    await page.waitForURL('**/planner');

    await expect(
      page.getByText('Бюджети на цей місяць ще не встановлено'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Наступний місяць' }).click();

    await expect(
      page.getByText('Бюджети на цей місяць ще не встановлено'),
    ).toBeVisible();
  });

  test.describe('mobile viewport (360px width)', () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

    test('planner screen renders with no horizontal scroll', async ({
      page,
    }) => {
      await mockBudgetBackend(page);

      await page.goto('/planner');
      await page.waitForURL('**/planner');

      await expect(
        page.getByRole('heading', { name: 'Планувальник' }),
      ).toBeVisible();

      const noHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(noHorizontalScroll).toBe(true);
    });
  });
});
