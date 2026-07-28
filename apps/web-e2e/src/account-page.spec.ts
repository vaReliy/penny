import { test, expect } from '@playwright/test';

const ME_URL = '**/auth/me';
const CONFIG_URL = '**/api/config';
const BALANCE_URL = '**/api/budget/balance';
const RATES_URL = '**/api/rates';

const activeUser = {
  id: '3',
  firstName: 'Petro',
  telegramId: 123456,
  status: 'active',
};

const balanceResponse = {
  accountId: 'a1',
  balance: { amount: '415000', currency: 'UAH' },
};

function ratesResponse(asOf: string, usdRate = '41.5000') {
  return {
    base: 'UAH',
    rates: [
      { currency: 'USD', rateToBase: usdRate },
      { currency: 'EUR', rateToBase: '45.0000' },
    ],
    asOf,
  };
}

test.describe('account page («Рахунок») — balance + FX rates', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(CONFIG_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ telegramBotUsername: 'TEST_BOT' }),
      }),
    );
    await page.route(ME_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(activeUser),
      }),
    );
    await page.route(BALANCE_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(balanceResponse),
      }),
    );
  });

  test('authed user lands on the account screen and sees balance + rates', async ({
    page,
  }) => {
    await page.route(RATES_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ratesResponse('2026-07-27T10:00:00.000Z')),
      }),
    );

    await page.goto('/account');
    await page.waitForURL('**/account');

    const balanceCard = page.getByRole('region', { name: 'Рахунок' });
    await expect(balanceCard).toBeVisible();
    await expect(balanceCard.getByText('UAH', { exact: true })).toBeVisible();
    await expect(balanceCard.getByText('USD', { exact: true })).toBeVisible();
    await expect(balanceCard.getByText('EUR', { exact: true })).toBeVisible();

    const ratesCard = page.getByRole('region', { name: 'Курс' });
    await expect(ratesCard).toBeVisible();
    await expect(
      ratesCard.getByRole('cell', { name: '41.5000' }),
    ).toBeVisible();
    await expect(ratesCard.getByText(/Оновлено:/)).toBeVisible();

    // No raw Transloco key paths (e.g. "budget.account.ratesCard.title")
    // should ever render — that's how a missing translation manifests.
    await expect(page.getByText(/budget\.account\./)).toHaveCount(0);
  });

  test('refresh updates the fetched-at timestamp and rate values', async ({
    page,
  }) => {
    let callCount = 0;
    await page.route(RATES_URL, (route) => {
      callCount += 1;
      const body =
        callCount === 1
          ? ratesResponse('2026-07-27T10:00:00.000Z', '41.5000')
          : ratesResponse('2026-07-27T11:00:00.000Z', '42.0000');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto('/account');
    await page.waitForURL('**/account');

    const ratesCard = page.getByRole('region', { name: 'Курс' });
    await expect(
      ratesCard.getByRole('cell', { name: '41.5000' }),
    ).toBeVisible();

    await ratesCard.getByRole('button', { name: 'Оновити курс' }).click();

    await expect(
      ratesCard.getByRole('cell', { name: '42.0000' }),
    ).toBeVisible();
    expect(callCount).toBe(2);
  });

  test('refresh failure shows inline error and keeps stale rates visible', async ({
    page,
  }) => {
    let callCount = 0;
    await page.route(RATES_URL, (route) => {
      callCount += 1;
      if (callCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ratesResponse('2026-07-27T10:00:00.000Z')),
        });
      }
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'rates provider unavailable' }),
      });
    });

    await page.goto('/account');
    await page.waitForURL('**/account');

    const ratesCard = page.getByRole('region', { name: 'Курс' });
    await expect(
      ratesCard.getByRole('cell', { name: '41.5000' }),
    ).toBeVisible();

    await ratesCard.getByRole('button', { name: 'Оновити курс' }).click();

    await expect(
      page.getByRole('alert').filter({
        hasText: 'Не вдалося оновити курс. Показано останні відомі дані.',
      }),
    ).toBeVisible();
    // Stale rates from the first successful load stay on screen.
    await expect(
      ratesCard.getByRole('cell', { name: '41.5000' }),
    ).toBeVisible();
    await expect(ratesCard.getByText(/Оновлено:/)).toBeVisible();
    await expect(page.getByText(/budget\.account\./)).toHaveCount(0);
    expect(callCount).toBe(2);
  });

  test('empty account shows a friendly zero-balance hint', async ({ page }) => {
    await page.route(BALANCE_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accountId: 'a1',
          balance: { amount: '0', currency: 'UAH' },
        }),
      }),
    );
    await page.route(RATES_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ratesResponse('2026-07-27T10:00:00.000Z')),
      }),
    );

    await page.goto('/account');
    await page.waitForURL('**/account');

    const balanceCard = page.getByRole('region', { name: 'Рахунок' });
    await expect(
      balanceCard.getByText('У вас ще немає операцій. Баланс дорівнює нулю.'),
    ).toBeVisible();
  });

  test.describe('mobile viewport (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('reachable via bottom nav, renders with no horizontal scroll', async ({
      page,
    }) => {
      await page.route(RATES_URL, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ratesResponse('2026-07-27T10:00:00.000Z')),
        }),
      );

      await page.goto('/greeting');
      await page.waitForURL('**/greeting');

      const nav = page.getByRole('navigation', { name: 'Основна навігація' });
      await nav.getByRole('link', { name: 'Рахунок' }).click();
      await page.waitForURL('**/account');

      const balanceCard = page.getByRole('region', { name: 'Рахунок' });
      await expect(balanceCard).toBeVisible();
      await expect(balanceCard.getByText('USD', { exact: true })).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalScroll).toBe(false);
    });
  });

  test.describe('mobile viewport (360px width) — acceptance criterion', () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

    test('no horizontal scroll and cards stack vertically at 360px', async ({
      page,
    }) => {
      await page.route(RATES_URL, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ratesResponse('2026-07-27T10:00:00.000Z')),
        }),
      );

      await page.goto('/account');
      await page.waitForURL('**/account');

      const balanceCard = page.getByRole('region', { name: 'Рахунок' });
      const ratesCard = page.getByRole('region', { name: 'Курс' });
      await expect(balanceCard).toBeVisible();
      await expect(ratesCard).toBeVisible();

      const noHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(noHorizontalScroll).toBe(true);

      // Already asserted visible above, so both cards have a layout box —
      // read rects via evaluate() rather than boundingBox() to avoid a
      // nullable-box check entirely.
      const balanceRect = await balanceCard.evaluate((el) =>
        el.getBoundingClientRect().toJSON(),
      );
      const ratesRect = await ratesCard.evaluate((el) =>
        el.getBoundingClientRect().toJSON(),
      );
      // Stacked (not side-by-side): rates card starts below the balance card.
      expect(ratesRect.y).toBeGreaterThanOrEqual(
        balanceRect.y + balanceRect.height - 1,
      );
    });
  });
});
