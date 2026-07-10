import { Injectable, Inject } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ITokenIssuer, TokenClaims } from 'identity-application';
import type { IUserRepository } from 'identity-core';
import { AuthenticationError } from 'shared-errors';
import type { SessionUser } from 'shared-contracts';

import { TOKENS } from '../identity/tokens.js';
import { AUTH_COOKIE_NAME, XSRF_COOKIE_NAME } from './cookie.constants.js';

/**
 * Enforces authentication only: verifies the JWT and loads the user from DB.
 * Does NOT check user.status — callers needing ACTIVE-only access must also
 * apply ActiveUserGuard. Apply this guard to endpoints all authenticated
 * users can reach regardless of approval state (e.g. GET /auth/me).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  public constructor(
    @Inject(TOKENS.TokenIssuer) private readonly tokenIssuer: ITokenIssuer,
    @Inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: SessionUser }>();
    const res = http.getResponse<Response>();

    const token = this.extractCookieToken(req);

    if (!token) {
      // No dummy verify/DB work is added here to match the other branches'
      // latency: AUTH_COOKIE_NAME/XSRF_COOKIE_NAME are set with sameSite:
      // 'lax' (see auth.controller.ts), so cross-site fetch/XHR never
      // attaches them, closing the practical cross-site timing-oracle
      // vector. The residual (top-level navigation + isolated timing) is
      // an accepted, low-severity signal.
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      res.clearCookie(XSRF_COOKIE_NAME, { path: '/' });
      throw new AuthenticationError();
    }

    let claims: TokenClaims;
    try {
      claims = this.tokenIssuer.verify(token);
    } catch {
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      res.clearCookie(XSRF_COOKIE_NAME, { path: '/' });
      throw new AuthenticationError();
    }

    const user = await this.userRepository.findById(claims.sub);

    if (!user) {
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      res.clearCookie(XSRF_COOKIE_NAME, { path: '/' });
      throw new AuthenticationError();
    }

    req.user = {
      id: user.id,
      telegramId: user.telegramId,
      displayName: user.firstName ?? user.username ?? user.telegramId,
      status: user.status,
      roles: claims.roles,
    };

    return true;
  }

  private extractCookieToken(req: Request): string | undefined {
    const header = req.headers['cookie'];
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name?.trim() === AUTH_COOKIE_NAME) {
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
