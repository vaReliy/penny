import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

const ME_URL = '**/auth/me';
const CONFIG_URL = '**/api/config';
const CATEGORIES_URL = '**/api/budget/categories';
// Trailing `*` is required: Playwright glob patterns anchor at the end, so
// a pattern with no trailing wildcard fails to match once a query string
// (e.g. `?type=income`) is appended by the filter panel.
const TRANSACTIONS_URL = '**/api/budget/transactions*';
const TRANSACTION_DETAIL_URL = '**/api/budget/transactions/*';
const CHART_URL = '**/api/budget/chart*';

const activeUser = {
  id: '3',
  firstName: 'Petro',
  telegramId: 123456,
  status: 'active',
};

const categories = [
  { id: 'c1', name: 'Їжа' },
  { id: 'c2', name: 'Транспорт' },
];

const transactions = [
  {
    id: 't1',
    accountId: 'a1',
    categoryId: 'c1',
    type: 'expense',
    amount: { amount: '15000', currency: 'UAH' },
    date: '2026-07-27',
    description: 'Обід',
    createdBy: activeUser.id,
    createdAt: '2026-07-27T10:00:00.000Z',
  },
  {
    id: 't2',
    accountId: 'a1',
    categoryId: 'c2',
    type: 'expense',
    amount: { amount: '5000', currency: 'UAH' },
    date: '2026-07-26',
    createdBy: activeUser.id,
    createdAt: '2026-07-26T10:00:00.000Z',
  },
];

const chart = [
  {
    categoryId: 'c1',
    name: 'Їжа',
    value: { amount: '15000', currency: 'UAH' },
  },
  {
    categoryId: 'c2',
    name: 'Транспорт',
    value: { amount: '5000', currency: 'UAH' },
  },
];

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
  await page.route(CATEGORIES_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(categories),
    }),
  );
  await page.route(CHART_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(chart),
    }),
  );
  await page.route(TRANSACTIONS_URL, (route: Route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      return route.continue();
    }
    const url = new URL(request.url());
    const type = url.searchParams.get('type');
    const filtered =
      type === null
        ? transactions
        : transactions.filter((transaction) => transaction.type === type);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(filtered),
    });
  });
  await page.route(TRANSACTION_DETAIL_URL, (route: Route) => {
    const id = route.request().url().split('/').pop();
    const transaction = transactions.find((entry) => entry.id === id);
    if (transaction === undefined) {
      return route.fulfill({ status: 404, body: 'not found' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(transaction),
    });
  });
}

test.describe('history screen («Історія»)', () => {
  test('renders the list and chart, filters narrow the list, and detail navigation preserves filters on back', async ({
    page,
  }) => {
    await mockBudgetBackend(page);

    await page.goto('/history');
    await page.waitForURL('**/history');

    await expect(page.locator('table').getByText('-150,00')).toBeVisible();
    await expect(page.locator('table').getByText('Транспорт')).toBeVisible();

    const chartRegion = page.getByRole('region', {
      name: 'Витрати за категоріями',
    });
    await expect(chartRegion.locator('svg')).toBeVisible();
    await expect(chartRegion.getByRole('list')).toBeVisible();

    // Apply the "income" type filter — the mocked backend returns none, so
    // the list should show the "filter matched nothing" empty state.
    const desktopFilter = page.getByRole('form', { name: 'Фільтр' });
    await desktopFilter
      .getByRole('combobox', { name: 'Тип', exact: true })
      .selectOption({ label: 'Прибуток' });
    await expect(
      page.getByText('Фільтр не знайшов жодної операції.'),
    ).toBeVisible();

    // Reset to "expense" to get the list back, then open a detail page.
    await desktopFilter
      .getByRole('combobox', { name: 'Тип', exact: true })
      .selectOption({ label: 'Витрата' });
    await page.getByRole('link', { name: '27.07.2026' }).click();
    await page.waitForURL('**/history/t1**');

    await expect(page.getByText('Деталі операції')).toBeVisible();
    await expect(page.getByText('Обід')).toBeVisible();

    await page.getByRole('link', { name: /Назад/ }).click();
    await page.waitForURL('**/history**');
    expect(page.url()).toContain('type=expense');
  });

  test.describe('tablet viewport (900px width — previously overlapping range)', () => {
    test.use({ viewport: { width: 900, height: 800 } });

    test('stays fully in mobile layout (bottom nav + filter sheet button) with no overflow', async ({
      page,
    }) => {
      await mockBudgetBackend(page);

      await page.goto('/history');
      await page.waitForURL('**/history');

      await expect(page.locator('table').getByText('-150,00')).toBeVisible();

      const noHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(noHorizontalScroll).toBe(true);

      // The nav's desktop/mobile switch (`lg`, 1024px) and the filter
      // rail's own switch must agree at this width — previously the rail
      // switched at `md` (768px) while the nav stayed mobile until 1024px,
      // producing a mismatched layout in the 768–1023px range. Both must
      // now render mobile-consistently: bottom nav visible, desktop rail
      // hidden, filter reachable only via the sheet-opening button.
      await expect(page.getByRole('form', { name: 'Фільтр' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Фільтр' })).toBeVisible();
      await expect(page.locator('nav').last()).toBeVisible();
    });
  });

  test.describe('desktop viewport just above the breakpoint (1024px width)', () => {
    test.use({ viewport: { width: 1024, height: 800 } });

    test('switches to the desktop filter rail with no overflow, matching the nav switch', async ({
      page,
    }) => {
      await mockBudgetBackend(page);

      await page.goto('/history');
      await page.waitForURL('**/history');

      await expect(page.locator('table').getByText('-150,00')).toBeVisible();

      const noHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(noHorizontalScroll).toBe(true);

      await expect(page.getByRole('form', { name: 'Фільтр' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Фільтр', exact: true }),
      ).toBeHidden();
      await expect(page.locator('nav').last()).toBeHidden();
    });
  });

  test.describe('wide desktop viewport (1440px width — upper bound of the tested range)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('has no page overflow and keeps the chart ring/legend inside the card bounds', async ({
      page,
    }) => {
      await mockBudgetBackend(page);

      await page.goto('/history');
      await page.waitForURL('**/history');

      await expect(page.locator('table').getByText('-150,00')).toBeVisible();

      const noHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(noHorizontalScroll).toBe(true);

      const chartRegion = page.getByRole('region', {
        name: 'Витрати за категоріями',
      });
      await expect(chartRegion.locator('svg')).toBeVisible();
      await expect(chartRegion.getByRole('list')).toBeVisible();

      // Already asserted visible above, so all three elements have a layout
      // box — read rects via evaluate() rather than boundingBox() to avoid a
      // nullable-box check entirely.
      const cardRect = await chartRegion.evaluate((el) =>
        el.getBoundingClientRect().toJSON(),
      );
      const svgRect = await chartRegion
        .locator('svg')
        .evaluate((el) => el.getBoundingClientRect().toJSON());
      const legendRect = await chartRegion
        .getByRole('list')
        .evaluate((el) => el.getBoundingClientRect().toJSON());

      expect(svgRect.x).toBeGreaterThanOrEqual(cardRect.x - 1);
      expect(svgRect.x + svgRect.width).toBeLessThanOrEqual(
        cardRect.x + cardRect.width + 1,
      );
      expect(legendRect.x).toBeGreaterThanOrEqual(cardRect.x - 1);
      expect(legendRect.x + legendRect.width).toBeLessThanOrEqual(
        cardRect.x + cardRect.width + 1,
      );
      expect(legendRect.y + legendRect.height).toBeLessThanOrEqual(
        cardRect.y + cardRect.height + 1,
      );
    });
  });

  test.describe('mobile viewport (360px width)', () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

    test('renders cards instead of a table, and the filter opens as a bottom sheet', async ({
      page,
    }) => {
      await mockBudgetBackend(page);

      await page.goto('/history');
      await page.waitForURL('**/history');

      await expect(page.locator('table')).toBeHidden();
      await expect(page.locator('ul').getByText('-150,00')).toBeVisible();

      const noHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(noHorizontalScroll).toBe(true);

      await page.getByRole('button', { name: 'Фільтр' }).click();
      const sheet = page.getByRole('form', { name: 'Фільтр' });
      await expect(sheet).toBeVisible();
      await sheet
        .getByRole('combobox', { name: 'Тип', exact: true })
        .selectOption({
          label: 'Прибуток',
        });
      await expect(
        page.getByText('Фільтр не знайшов жодної операції.'),
      ).toBeVisible();
    });
  });
});
