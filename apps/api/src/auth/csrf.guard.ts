import { timingSafeEqual } from 'node:crypto';

import { Injectable, ForbiddenException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { XSRF_COOKIE_NAME } from './cookie.constants.js';
import { SKIP_CSRF_KEY } from './skip-csrf.decorator.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-xsrf-token';

@Injectable()
export class CsrfGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    const rawHeader = req.headers[CSRF_HEADER];
    const headerToken = typeof rawHeader === 'string' ? rawHeader : undefined;
    const cookieToken = this.extractCookie(req, XSRF_COOKIE_NAME);

    if (!headerToken || !cookieToken) {
      throw new ForbiddenException('CSRF token missing or invalid.');
    }

    const headerBuf = Buffer.from(headerToken);
    const cookieBuf = Buffer.from(cookieToken);
    if (
      headerBuf.length !== cookieBuf.length ||
      !timingSafeEqual(headerBuf, cookieBuf)
    ) {
      throw new ForbiddenException('CSRF token missing or invalid.');
    }

    return true;
  }

  private extractCookie(req: Request, name: string): string | undefined {
    const header = req.headers['cookie'];
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const [key, ...rest] = part.trim().split('=');
      if (key?.trim() === name) {
        try {
          return decodeURIComponent(rest.join('=').trim()) || undefined;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }
}
