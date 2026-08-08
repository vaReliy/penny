/**
 * Render-level CSP verification for the built `web` production image.
 *
 * This asserts the OUTCOME (the page is actually styled, with no CSP violations),
 * not the mechanism (that some nonce/attribute is present in the HTML).
 *
 * That distinction is the whole reason this file exists. A previous grep-based check
 * verified that a nonce had been injected into an inline `onload` handler and passed
 * green for days — while every user got an unstyled page, because a CSP nonce cannot
 * authorize an inline event handler at all. A guard written from the fix inherits the
 * fix's assumptions; only asserting the rendered result is premise-independent.
 */
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:18080/';

/** Body margin proves Tailwind's preflight applied; the browser default is 8px. */
const EXPECTED_BODY_MARGIN = '0px';

const browser = await chromium.launch();
const failures = [];

try {
  const page = await browser.newPage();
  const cspViolations = [];

  page.on('console', (message) => {
    const text = message.text();
    if (/content security policy/i.test(text)) {
      cspViolations.push(text);
    }
  });

  const response = await page.goto(url, { waitUntil: 'load' });
  if (!response?.ok()) {
    failures.push(
      `Page did not load cleanly: HTTP ${response?.status() ?? 'no response'}`,
    );
  }

  const state = await page.evaluate(() => {
    const sheets = [...document.styleSheets].map((sheet) => {
      try {
        return {
          href: sheet.href,
          media: sheet.media.mediaText,
          rules: sheet.cssRules.length,
        };
      } catch {
        // Cross-origin sheets throw on cssRules access; none are expected under this CSP.
        return { href: sheet.href, media: sheet.media.mediaText, rules: -1 };
      }
    });
    return {
      sheets,
      inlineHandlers: document.querySelectorAll(
        '[onload], [onclick], [onerror]',
      ).length,
      bodyMargin: getComputedStyle(document.body).margin,
    };
  });

  if (cspViolations.length > 0) {
    failures.push(
      `CSP violations in console:\n    - ${cspViolations.join('\n    - ')}`,
    );
  }

  const printScoped = state.sheets.filter((sheet) => sheet.media === 'print');
  if (printScoped.length > 0) {
    failures.push(
      `Stylesheet(s) still scoped to media="print" — loaded but applying to nothing on screen: ` +
        JSON.stringify(printScoped),
    );
  }

  const applied = state.sheets.filter(
    (sheet) => sheet.media !== 'print' && sheet.rules > 0,
  );
  if (applied.length === 0) {
    failures.push(
      `No stylesheet with rules is in effect. Sheets seen: ${JSON.stringify(state.sheets)}`,
    );
  }

  if (state.inlineHandlers > 0) {
    failures.push(
      `${state.inlineHandlers} inline event handler(s) present. A CSP nonce cannot authorize these; ` +
        `they must not be emitted (check optimization.styles.inlineCritical).`,
    );
  }

  if (state.bodyMargin !== EXPECTED_BODY_MARGIN) {
    failures.push(
      `Computed body margin is "${state.bodyMargin}", expected "${EXPECTED_BODY_MARGIN}" — ` +
        `the stylesheet is not actually applied.`,
    );
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`✗ CSP render check FAILED for ${url}`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `✓ CSP render check passed for ${url} — page is styled, zero CSP violations`,
);
