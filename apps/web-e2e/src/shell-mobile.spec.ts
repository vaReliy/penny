import { test, expect } from '@playwright/test';

const ME_URL = '**/auth/me';
const HELLO_URL = '**/api/hello';
const LOGOUT_URL = '**/auth/logout';
const CONFIG_URL = '**/api/config';

const activeUser = {
  id: '3',
  firstName: 'Valerii',
  telegramId: 123456,
  status: 'active',
};

test.describe('app shell — mobile viewport (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

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
    await page.route(HELLO_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ greeting: 'Hello, Valerii' }),
      }),
    );
  });

  test('shell has no horizontal scroll and the bottom nav is reachable', async ({
    page,
  }) => {
    await page.goto('/greeting');
    await page.waitForURL('**/greeting');

    const nav = page.getByRole('navigation', { name: 'Основна навігація' });
    await expect(nav.first()).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const accountLink = nav.getByRole('link', { name: 'Рахунок' });
    await expect(accountLink).toBeVisible();
    const box = await accountLink.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  });

  test.describe('at the 360px acceptance-criteria width', () => {
    test.use({ viewport: { width: 360, height: 640 }, hasTouch: true });

    test('shell has no horizontal scroll and the bottom nav is usable', async ({
      page,
    }) => {
      await page.goto('/greeting');
      await page.waitForURL('**/greeting');

      const nav = page.getByRole('navigation', { name: 'Основна навігація' });
      await expect(nav.first()).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalScroll).toBe(false);

      const accountLink = nav.getByRole('link', { name: 'Рахунок' });
      await expect(accountLink).toBeVisible();
      const box = await accountLink.boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
    });
  });

  test('bottom nav links navigate and mark the active section', async ({
    page,
  }) => {
    await page.goto('/greeting');
    await page.waitForURL('**/greeting');

    const nav = page.getByRole('navigation', { name: 'Основна навігація' });
    await nav.getByRole('link', { name: 'Історія' }).click();
    await page.waitForURL('**/history');

    await expect(
      nav.getByRole('link', { name: 'Історія', current: 'page' }),
    ).toBeVisible();
  });

  test('logout is reachable from the profile menu and no horizontal scroll remains', async ({
    page,
  }) => {
    let logoutCalled = false;
    await page.route(LOGOUT_URL, (route) => {
      logoutCalled = true;
      return route.fulfill({ status: 200 });
    });
    // Simulate the backend session being invalidated once logout fires,
    // so the /login route's loginGuard (which re-checks /auth/me) admits access
    // instead of bouncing an apparently-still-active user back to /greeting.
    await page.route(ME_URL, (route) =>
      route.fulfill(
        logoutCalled
          ? { status: 401, body: '{}' }
          : {
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(activeUser),
            },
      ),
    );

    await page.goto('/greeting');
    await page.waitForURL('**/greeting');

    await page.getByRole('button', { name: 'Меню профілю' }).click();
    await page.getByRole('menuitem', { name: 'Вийти' }).click();
    await page.waitForURL('**/login');

    expect(logoutCalled).toBe(true);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});
