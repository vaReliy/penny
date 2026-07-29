import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const ME_URL = '**/auth/me';
const HELLO_URL = '**/api/hello';
const CONFIG_URL = '**/api/config';
const LOGOUT_URL = '**/auth/logout';
const CATEGORIES_URL = '**/api/budget/categories';
const TRANSACTIONS_URL = '**/api/budget/transactions*';
const BALANCE_URL = '**/api/budget/balance';
const RATES_URL = '**/api/rates';
const CHART_URL = '**/api/budget/chart*';
const SUMMARY_URL = '**/api/budget/summary*';
const MONTHLY_BUDGETS_URL = '**/api/budget/monthly-budgets*';

const pendingUser = {
  id: '3',
  firstName: 'Petro',
  telegramId: 123456,
  status: 'pending',
};

const activeUser = { ...pendingUser, status: 'active' };

const ratesResponse = {
  base: 'UAH',
  rates: [{ currency: 'USD', rateToBase: '41.5000' }],
  asOf: '2026-07-27T10:00:00.000Z',
};

/** Fixed day-of-month (15th) sidesteps calendar-length edge cases (e.g. no Feb 30). */
function previousMonthIsoDate(): string {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-15`;
}

/**
 * Wires the single hermetic mock backend the whole cross-screen journey
 * drives — statefully covers auth-status transitions (unauth → pending →
 * active, simulating the real Telegram-login → admin-CLI-approve flow this
 * app uses, since a real Telegram widget and a real CLI process are both
 * unreachable from this hermetic, no-live-service-dependency e2e project —
 * see `.github/workflows/ci.yml`'s `e2e` job comment), categories,
 * transactions/balance, monthly budgets, and the derived planner summary —
 * so every screen the journey visits reflects the same underlying state.
 */
function mockJourneyBackend(page: Page) {
  let meStatus: 'unauth' | 'pending' | 'active' = 'unauth';
  let logoutCalled = false;

  const categories: { id: string; name: string }[] = [];
  let nextCategoryId = 1;

  const transactions: {
    id: string;
    categoryId: string;
    type: 'income' | 'expense';
    amountMinorUnits: number;
    date: string;
  }[] = [];
  let nextTransactionId = 1;
  let balanceMinorUnits = 0;

  const budgetsByMonth = new Map<string, Map<string, number>>();

  page.route(ME_URL, (route: Route) => {
    if (logoutCalled || meStatus === 'unauth') {
      return route.fulfill({ status: 401, body: '{}' });
    }
    const body = meStatus === 'pending' ? pendingUser : activeUser;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  page.route(CONFIG_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ telegramBotUsername: 'TEST_BOT' }),
    }),
  );

  page.route(HELLO_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ greeting: `Hello, ${activeUser.firstName}` }),
    }),
  );

  page.route(LOGOUT_URL, (route: Route) => {
    logoutCalled = true;
    return route.fulfill({ status: 200 });
  });

  page.route(CATEGORIES_URL, (route: Route) => {
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

  page.route(BALANCE_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accountId: 'a1',
        balance: { amount: String(balanceMinorUnits), currency: 'UAH' },
      }),
    }),
  );

  page.route(RATES_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ratesResponse),
    }),
  );

  page.route(TRANSACTIONS_URL, (route: Route) => {
    const request = route.request();
    if (request.method() === 'POST') {
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
        categoryId: body.categoryId,
        type: body.type,
        amountMinorUnits: body.amountMinorUnits,
        date: body.date,
      };
      nextTransactionId += 1;
      transactions.push(created);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: created.id,
          accountId: 'a1',
          categoryId: created.categoryId,
          type: created.type,
          amount: { amount: String(created.amountMinorUnits), currency: 'UAH' },
          date: created.date,
          createdBy: activeUser.id,
          createdAt: '2026-07-28T10:00:00.000Z',
        }),
      });
    }

    const url = new URL(request.url());
    const type = url.searchParams.get('type');
    const categoryId = url.searchParams.get('categoryId');
    const filtered = transactions.filter(
      (transaction) =>
        (type === null || transaction.type === type) &&
        (categoryId === null || transaction.categoryId === categoryId),
    );
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        filtered.map((transaction) => ({
          id: transaction.id,
          accountId: 'a1',
          categoryId: transaction.categoryId,
          type: transaction.type,
          amount: {
            amount: String(transaction.amountMinorUnits),
            currency: 'UAH',
          },
          date: transaction.date,
          createdBy: activeUser.id,
          createdAt: '2026-07-28T10:00:00.000Z',
        })),
      ),
    });
  });

  page.route(CHART_URL, (route: Route) => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;
      totals.set(
        transaction.categoryId,
        (totals.get(transaction.categoryId) ?? 0) +
          transaction.amountMinorUnits,
      );
    }
    const entries = [...totals.entries()].map(([categoryId, value]) => ({
      categoryId,
      name:
        categories.find((category) => category.id === categoryId)?.name ?? '',
      value: { amount: String(value), currency: 'UAH' },
    }));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(entries),
    });
  });

  page.route(MONTHLY_BUDGETS_URL, (route: Route) => {
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

  page.route(SUMMARY_URL, (route: Route) => {
    const url = new URL(route.request().url());
    const month = url.searchParams.get('month') ?? '';
    const monthBudgets = budgetsByMonth.get(month) ?? new Map();
    const monthSpend = new Map<string, number>();
    for (const transaction of transactions) {
      if (
        transaction.type !== 'expense' ||
        !transaction.date.startsWith(month)
      ) {
        continue;
      }
      monthSpend.set(
        transaction.categoryId,
        (monthSpend.get(transaction.categoryId) ?? 0) +
          transaction.amountMinorUnits,
      );
    }
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
    approve() {
      meStatus = 'active';
    },
    setPending() {
      meStatus = 'pending';
    },
  };
}

async function runFullJourney(page: Page): Promise<void> {
  const backend = mockJourneyBackend(page);

  // 1. Telegram-mock login: unauthenticated session lands on the login
  // screen (this app has no drivable Telegram widget in a hermetic e2e —
  // the guard-redirect mock is the established convention, see auth-flow.spec.ts).
  await page.goto('/greeting');
  await page.waitForURL('**/login');
  await expect(
    page.getByRole('heading', { name: 'Вхід до Penny' }),
  ).toBeVisible();

  // 2. Pending state — the backend session now reflects a freshly created,
  // not-yet-approved user.
  backend.setPending();
  await page.goto('/greeting');
  await page.waitForURL('**/access-status');
  await expect(page.getByText('Ваш доступ очікує підтвердження')).toBeVisible();

  // 3. CLI approve — admin flips the user to active; the next navigation
  // reflects the now-approved session and lands in the shell.
  backend.approve();
  await page.goto('/greeting');
  await page.waitForURL('**/greeting');
  const nav = page.getByRole('navigation', { name: 'Основна навігація' });
  await expect(nav.first()).toBeVisible();

  // 4. Create 2 categories.
  await page.goto('/records');
  await page.waitForURL('**/records');
  await page
    .getByLabel('Введіть назву', { exact: true })
    .first()
    .fill('Продукти');
  await page.getByRole('button', { name: 'Додати категорію' }).click();
  await expect(page.getByText('Категорію додано!')).toBeVisible();

  await page
    .getByLabel('Введіть назву', { exact: true })
    .first()
    .fill('Транспорт');
  await page.getByRole('button', { name: 'Додати категорію' }).click();
  await expect(page.getByText('Категорію додано!')).toBeVisible();

  // 5. Set monthly budgets for both categories.
  await page.goto('/planner');
  await page.waitForURL('**/planner');

  const productsRow = page
    .getByRole('listitem')
    .filter({ hasText: 'Продукти' });
  await productsRow.getByRole('button', { name: /Бюджет:/ }).click();
  await productsRow.getByLabel('Сума бюджету').fill('1000');
  await productsRow.getByRole('button', { name: 'Зберегти' }).click();
  await expect(
    productsRow.getByRole('button', { name: /1.?000,00/ }),
  ).toBeVisible();

  const transportRow = page
    .getByRole('listitem')
    .filter({ hasText: 'Транспорт' });
  await transportRow.getByRole('button', { name: /Бюджет:/ }).click();
  await transportRow.getByLabel('Сума бюджету').fill('500');
  await transportRow.getByRole('button', { name: 'Зберегти' }).click();
  await expect(
    transportRow.getByRole('button', { name: /500,00/ }),
  ).toBeVisible();

  // 6. Record income + 3 expenses across the 2 categories — one expense
  // dated in the previous month.
  await page.goto('/records');
  await page.waitForURL('**/records');

  async function recordTransaction(
    categoryName: string,
    type: 'income' | 'expense',
    amount: string,
    date?: string,
  ): Promise<void> {
    const categorySelect = page.getByLabel('Оберіть категорію');
    // The previous submission's post-success `form.reset()` runs inside an
    // OnPush-scoped Angular effect and can still be in flight when this test
    // (much faster than a human) starts filling the next transaction — wait
    // for the reset to have already landed (select back at its placeholder)
    // before touching the form again, so our own selection can't be clobbered.
    await expect(categorySelect).toHaveValue('');
    await categorySelect.selectOption({ label: categoryName });
    await expect(categorySelect.locator('option:checked')).toHaveText(
      categoryName,
    );

    const typeRadio = page.getByLabel(
      type === 'income' ? 'Прибуток' : 'Витрата',
    );
    await typeRadio.check();
    await expect(typeRadio).toBeChecked();

    const amountInput = page.getByLabel('Введіть суму');
    await amountInput.fill(amount);
    await expect(amountInput).toHaveValue(amount);

    if (date !== undefined) {
      const dateInput = page.getByLabel('Дата');
      await dateInput.fill(date);
      await expect(dateInput).toHaveValue(date);
    }

    await page.getByRole('button', { name: 'Додати', exact: true }).click();
    await expect(page.getByText('Подію успішно додано!')).toBeVisible();
  }

  await recordTransaction('Продукти', 'income', '2000');
  await recordTransaction('Продукти', 'expense', '300');
  await recordTransaction('Транспорт', 'expense', '480');
  await recordTransaction('Продукти', 'expense', '200', previousMonthIsoDate());

  // 7. «Рахунок» shows the correct derived balance:
  // 2000.00 - 300.00 - 480.00 - 200.00 = 1020.00 UAH.
  await page.goto('/account');
  await page.waitForURL('**/account');
  const balanceCard = page.getByRole('region', { name: 'Рахунок' });
  await expect(balanceCard.getByText(/1.?020,00/)).toBeVisible();

  // 8. «Історія» — filter by category narrows results, chart renders.
  await page.goto('/history');
  await page.waitForURL('**/history');

  const chartRegion = page.getByRole('region', {
    name: 'Витрати за категоріями',
  });
  await expect(chartRegion.locator('svg')).toBeVisible();

  const desktopFilter = page.getByRole('form', { name: 'Фільтр' });
  const filterToggleButton = page.getByRole('button', {
    name: 'Фільтр',
    exact: true,
  });
  // Retrying assertion instead of a one-shot isVisible() snapshot — a bare
  // isVisible() right after navigation can race Tailwind's breakpoint-driven
  // reflow before Angular's zone stabilizes (see rules/local/testing-e2e.md's
  // role-query-race gotcha; same fix as history-page.spec.ts's viewport tests).
  await expect(desktopFilter.or(filterToggleButton)).toBeVisible();
  if (await filterToggleButton.isVisible()) {
    await filterToggleButton.click();
  }
  const filterForm = page.getByRole('form', { name: 'Фільтр' });
  await filterForm
    .getByRole('combobox', { name: 'Категорія', exact: true })
    .selectOption({ label: 'Транспорт' });

  // Desktop table and mobile list both exist in the DOM (CSS toggled by
  // breakpoint) — scope to whichever is actually visible at this viewport.
  const desktopTable = page.locator('table');
  const listContainer = (await desktopTable.isVisible())
    ? desktopTable
    : page.locator('ul');
  await expect(listContainer.getByText(/480,00/)).toBeVisible();
  await expect(listContainer.getByText(/300,00/)).toHaveCount(0);
  await expect(listContainer.getByText(/200,00/)).toHaveCount(0);

  // 9. «Планувальник» — current month shows correct spent/remaining/colors;
  // the previous-month expense (200.00, Продукти) is excluded.
  await page.goto('/planner');
  await page.waitForURL('**/planner');

  const productsRowAfter = page
    .getByRole('listitem')
    .filter({ hasText: 'Продукти' });
  await expect(productsRowAfter.getByText(/Витрачено: .*300,00/)).toBeVisible();
  await expect(productsRowAfter.getByText(/Витрачено: .*500,00/)).toHaveCount(
    0,
  );
  await expect(productsRowAfter.getByText(/Залишок: .*700,00/)).toBeVisible();
  await expect(
    productsRowAfter.locator('[role="progressbar"] > div').first(),
  ).toHaveClass(/bg-progress-success/);

  const transportRowAfter = page
    .getByRole('listitem')
    .filter({ hasText: 'Транспорт' });
  await expect(
    transportRowAfter.getByText(/Витрачено: .*480,00/),
  ).toBeVisible();
  await expect(transportRowAfter.getByText(/Залишок: .*20,00/)).toBeVisible();
  await expect(
    transportRowAfter.locator('[role="progressbar"] > div').first(),
  ).toHaveClass(/bg-progress-danger/);

  // 10. Logout.
  await page.getByRole('button', { name: 'Меню профілю' }).click();
  await page.getByRole('menuitem', { name: 'Вийти' }).click();
  await page.waitForURL('**/login');
}

test.describe('full cross-screen journey — desktop', () => {
  // eslint-disable-next-line playwright/expect-expect -- assertions live inside the shared runFullJourney() helper
  test('login → approve → categories → budgets → transactions → account/history/planner consistency → logout', async ({
    page,
  }) => {
    await runFullJourney(page);
  });
});

test.describe('full cross-screen journey — mobile (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  // eslint-disable-next-line playwright/expect-expect -- assertions live inside the shared runFullJourney() helper
  test('login → approve → categories → budgets → transactions → account/history/planner consistency → logout', async ({
    page,
  }) => {
    await runFullJourney(page);
  });
});

test.describe('360px mobile sweep — every screen + shell', () => {
  test.use({ viewport: { width: 360, height: 640 }, hasTouch: true });

  const screens: {
    path: string;
    assertLoaded: (page: Page) => Promise<void>;
  }[] = [
    {
      path: '/greeting',
      assertLoaded: (page) =>
        expect(page.getByText('Hello, Petro')).toBeVisible(),
    },
    {
      path: '/account',
      assertLoaded: (page) =>
        expect(page.getByRole('region', { name: 'Рахунок' })).toBeVisible(),
    },
    {
      path: '/history',
      assertLoaded: (page) =>
        expect(
          page.getByRole('region', { name: 'Список операцій' }),
        ).toBeVisible(),
    },
    {
      path: '/planner',
      assertLoaded: (page) =>
        expect(
          page.getByRole('heading', { name: 'Планувальник' }),
        ).toBeVisible(),
    },
    {
      path: '/records',
      assertLoaded: (page) =>
        expect(
          page.getByRole('region', { name: 'Додати подію' }),
        ).toBeVisible(),
    },
  ];

  for (const screen of screens) {
    test(`${screen.path} has no horizontal scroll and the bottom nav is reachable`, async ({
      page,
    }) => {
      mockJourneyBackend(page).approve();

      await page.goto(screen.path);
      await page.waitForURL(`**${screen.path}`);
      await screen.assertLoaded(page);

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalScroll).toBe(false);

      const nav = page.getByRole('navigation', { name: 'Основна навігація' });
      await expect(nav.first()).toBeVisible();
      const accountLink = nav.getByRole('link', { name: 'Рахунок' });
      await expect(accountLink).toBeVisible();
      const box = await accountLink.evaluate((el) =>
        el.getBoundingClientRect().toJSON(),
      );
      // task-03 design-token minimum touch target: --spacing-touch (2.75rem = 44px).
      expect(box.height).toBeGreaterThanOrEqual(44);
    });
  }
});
