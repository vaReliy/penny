import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Request, Response } from 'express';
import { contentSecurityPolicy } from 'helmet';

import { CSP_DIRECTIVES, cspMiddleware } from './csp-policy.js';

/** Minimal http.ServerResponse augmented with express-style locals for testing. */
type AugmentedResponse = http.ServerResponse & {
  locals: Record<string, unknown>;
};

function httpGet(url: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, resolve);
    req.on('error', reject);
  });
}

/**
 * Integration smoke-test: apply `contentSecurityPolicy` from Helmet with
 * the production `CSP_DIRECTIVES` constant to a raw Node.js http server and
 * assert the response header matches what main.ts delivers to real clients.
 *
 * Running against `CSP_DIRECTIVES` directly means any edit to that constant
 * (which is the single source of truth consumed by main.ts) will cause this
 * suite to fail immediately.
 */
describe('CSP policy directives (integration)', () => {
  let server: http.Server;
  let cspHeader!: string;

  beforeAll(async () => {
    const middleware = contentSecurityPolicy({ directives: CSP_DIRECTIVES });

    server = http.createServer((req, res) => {
      middleware(req, res, () => {
        res.statusCode = 200;
        res.end('ok');
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const { port } = server.address() as AddressInfo;
    const res = await httpGet(`http://127.0.0.1:${port}/`);
    // Drain the response body so the connection can be closed cleanly.
    res.resume();
    const raw = res.headers['content-security-policy'];
    if (typeof raw !== 'string')
      throw new Error('CSP header absent or multi-value');
    cspHeader = raw;
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err != null ? reject(err) : resolve()));
      }),
  );

  it("restricts default-src to 'self'", () => {
    expect(cspHeader).toContain("default-src 'self'");
  });

  it('allows Telegram Login Widget script source', () => {
    expect(cspHeader).toContain("script-src 'self' https://telegram.org");
  });

  it('allows Telegram OAuth frame source', () => {
    expect(cspHeader).toContain('frame-src https://oauth.telegram.org');
  });

  it('allows Telegram image sources (t.me and wildcard subdomain)', () => {
    expect(cspHeader).toContain('https://t.me');
    expect(cspHeader).toContain('https://*.telegram.org');
  });

  it("blocks object-src with 'none'", () => {
    expect(cspHeader).toContain("object-src 'none'");
  });

  it("restricts base-uri to 'self'", () => {
    expect(cspHeader).toContain("base-uri 'self'");
  });

  it("restricts connect-src to 'self'", () => {
    expect(cspHeader).toContain("connect-src 'self'");
  });

  it("restricts form-action to 'self'", () => {
    expect(cspHeader).toContain("form-action 'self'");
  });

  it("restricts style-src to 'self' only — no 'unsafe-inline'", () => {
    expect(cspHeader).toContain("style-src 'self'");
    expect(cspHeader).not.toContain("'unsafe-inline'");
  });
});

/**
 * Unit/integration tests for the `cspMiddleware` express middleware.
 *
 * Verifies per-request nonce generation, locals propagation, and that the
 * nonce is embedded in the Content-Security-Policy instead of 'unsafe-inline'.
 *
 * Strategy: spin up a raw Node.js http server, augment each `ServerResponse`
 * with an `express`-style `locals` object, then pass `req`/`res` to
 * `cspMiddleware`. The `next` callback exposes `res.locals['nonce']` via the
 * test-only `X-Test-Local-Nonce` header so assertions can inspect the nonce
 * value without relying on any response header set by the middleware itself.
 */
describe('cspMiddleware', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const augRes = res as unknown as AugmentedResponse;
      augRes.locals = {};

      cspMiddleware(
        req as unknown as Request,
        augRes as unknown as Response,
        () => {
          // Expose res.locals['nonce'] so tests can assert locals ↔ header parity.
          const localNonce = augRes.locals['nonce'];
          if (typeof localNonce === 'string') {
            res.setHeader('X-Test-Local-Nonce', localNonce);
          }
          res.statusCode = 200;
          res.end('ok');
        },
      );
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}/`;
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err != null ? reject(err) : resolve()));
      }),
  );

  it('sets res.locals nonce to a base64-encoded 16-byte value', async () => {
    const res = await httpGet(baseUrl);
    res.resume();
    const nonce = res.headers['x-test-local-nonce'];
    expect(typeof nonce).toBe('string');
    // 16 raw bytes → exactly 24 base64 characters (including padding)
    expect((nonce as string).length).toBe(24);
    expect(/^[A-Za-z0-9+/]+=*$/.test(nonce as string)).toBe(true);
  });

  it('generates a unique nonce on each request', async () => {
    const [res1, res2] = await Promise.all([
      httpGet(baseUrl),
      httpGet(baseUrl),
    ]);
    res1.resume();
    res2.resume();
    const nonce1 = res1.headers['x-test-local-nonce'];
    const nonce2 = res2.headers['x-test-local-nonce'];
    expect(typeof nonce1).toBe('string');
    expect(typeof nonce2).toBe('string');
    expect(nonce1).not.toBe(nonce2);
  });

  it('embeds the per-request nonce in Content-Security-Policy style-src', async () => {
    const res = await httpGet(baseUrl);
    res.resume();
    const csp = res.headers['content-security-policy'];
    const nonce = res.headers['x-test-local-nonce'];
    expect(typeof csp).toBe('string');
    expect(typeof nonce).toBe('string');
    expect(csp as string).toContain(`'nonce-${nonce as string}'`);
    expect(csp as string).toContain('style-src');
    expect(csp as string).toContain("style-src 'self'");
  });

  it("does not include 'unsafe-inline' in Content-Security-Policy", async () => {
    const res = await httpGet(baseUrl);
    res.resume();
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).not.toContain("'unsafe-inline'");
  });
});
