import 'reflect-metadata';

import { afterEach, describe, expect, it } from 'vitest';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Get, Module, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';

/** Spoofed client address the fake nginx hop reports via X-Forwarded-For. */
const SPOOFED_CLIENT_IP = '203.0.113.7';

@Controller()
class TrustProxyProbeController {
  @Get('ip')
  public getIp(@Req() req: Request): { ip: string } {
    return { ip: req.ip ?? '' };
  }
}

@Module({ controllers: [TrustProxyProbeController] })
class TrustProxyProbeModule {}

function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ ip: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as { ip: string });
        } catch (err) {
          reject(err as Error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Verifies the exact `app.set('trust proxy', 1)` behavior configured in
 * apps/api/src/main.ts using a minimal Nest module (no Mongo-backed
 * IdentityModule) and a real HTTP round-trip — proving req.ip actually
 * reflects a forwarded client address instead of the immediate socket peer,
 * which is the concrete risk ThrottlerGuard's per-IP bucketing depends on.
 */
describe('trust proxy configuration (mirrors apps/api/src/main.ts)', () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function bootProbeApp(
    trustProxySetting: number | boolean,
  ): Promise<string> {
    app = await NestFactory.create<NestExpressApplication>(
      TrustProxyProbeModule,
      { logger: false },
    );
    app.set('trust proxy', trustProxySetting);
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  it('resolves req.ip to the spoofed client address when trust proxy: 1 (matches main.ts)', async () => {
    const baseUrl = await bootProbeApp(1);

    const { ip } = await getJson(`${baseUrl}/ip`, {
      'X-Forwarded-For': SPOOFED_CLIENT_IP,
    });

    expect(ip).toBe(SPOOFED_CLIENT_IP);
  });

  it('ignores X-Forwarded-For and falls back to the socket peer when trust proxy is disabled', async () => {
    const baseUrl = await bootProbeApp(false);

    const { ip } = await getJson(`${baseUrl}/ip`, {
      'X-Forwarded-For': SPOOFED_CLIENT_IP,
    });

    expect(ip).not.toBe(SPOOFED_CLIENT_IP);
  });
});
