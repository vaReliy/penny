import { test, expect } from '@playwright/test';

const ME_URL = '**/auth/me';
const HELLO_URL = '**/api/hello';
const CONFIG_URL = '**/api/config';

const pendingUser = {
  id: '1',
  firstName: 'Test',
  telegramId: 42,
  status: 'pending',
};

const rejectedUser = {
  id: '2',
  firstName: 'Test',
  telegramId: 42,
  status: 'rejected',
};

const activeUser = {
  id: '3',
  firstName: 'Valerii',
  telegramId: 123456,
  status: 'active',
};

test.describe('auth flow — status routing guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(CONFIG_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ telegramBotUsername: 'TEST_BOT' }),
      }),
    );
  });

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.route(ME_URL, (route) =>
      route.fulfill({ status: 401, body: '{}' }),
    );

    await page.goto('/greeting');
    await page.waitForURL('**/login');

    await expect(
      page.getByRole('heading', { name: 'Sign in to Penny' }),
    ).toBeVisible();
  });

  test('pending user navigating to /greeting is redirected to /access-status with pending message', async ({
    page,
  }) => {
    await page.route(ME_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pendingUser),
      }),
    );

    await page.goto('/greeting');
    await page.waitForURL('**/access-status');

    await expect(
      page.getByText('Your access is awaiting approval'),
    ).toBeVisible();
    await expect(
      page.getByText('Your access request has been declined'),
    ).not.toBeVisible();
  });

  test('rejected user navigating to /greeting is redirected to /access-status with rejection message', async ({
    page,
  }) => {
    await page.route(ME_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rejectedUser),
      }),
    );

    await page.goto('/greeting');
    await page.waitForURL('**/access-status');

    await expect(
      page.getByText('Your access request has been declined'),
    ).toBeVisible();
    await expect(
      page.getByText('Your access is awaiting approval'),
    ).not.toBeVisible();
  });

  test('active user navigating to /greeting sees the personalised greeting', async ({
    page,
  }) => {
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
        body: JSON.stringify({
          greeting: 'Hello, Valerii — you are user #123456',
        }),
      }),
    );

    await page.goto('/greeting');
    await page.waitForURL('**/greeting');

    await expect(
      page.getByText('Hello, Valerii — you are user #123456'),
    ).toBeVisible();
  });

  test('active user navigating directly to /login is redirected to /greeting', async ({
    page,
  }) => {
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
        body: JSON.stringify({
          greeting: 'Hello, Valerii — you are user #123456',
        }),
      }),
    );

    await page.goto('/login');
    await page.waitForURL('**/greeting');

    await expect(
      page.getByText('Hello, Valerii — you are user #123456'),
    ).toBeVisible();
  });

  test('active user navigating directly to /access-status is bounced to /greeting', async ({
    page,
  }) => {
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
        body: JSON.stringify({
          greeting: 'Hello, Valerii — you are user #123456',
        }),
      }),
    );

    await page.goto('/access-status');
    await page.waitForURL('**/greeting');

    await expect(
      page.getByText('Hello, Valerii — you are user #123456'),
    ).toBeVisible();
  });
});
