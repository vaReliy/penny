import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { contentSecurityPolicy } from 'helmet';

import { CSP_DIRECTIVES } from './csp-policy.js';

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
    const cspMiddleware = contentSecurityPolicy({ directives: CSP_DIRECTIVES });

    server = http.createServer((req, res) => {
      cspMiddleware(req, res, () => {
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

  it("restricts style-src to 'self' and does not contain 'unsafe-inline'", () => {
    expect(cspHeader).toContain("style-src 'self'");
    expect(cspHeader).not.toContain("'unsafe-inline'");
  });
});
