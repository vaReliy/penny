import { Injectable, Inject } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ITokenIssuer, TokenClaims } from 'identity-application';
import type { IUserRepository } from 'identity-core';
import { UserStatus } from 'shared-contracts';
import { AuthenticationError } from 'shared-errors';
import type { SessionUser } from 'shared-contracts';

import { TOKENS } from '../identity/tokens.js';
import { AUTH_COOKIE_NAME } from './cookie.constants.js';

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
      throw new AuthenticationError('Authentication required.');
    }

    let claims: TokenClaims;
    try {
      claims = this.tokenIssuer.verify(token);
    } catch {
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      throw new AuthenticationError('Session token is invalid or has expired.');
    }

    const user = await this.userRepository.findById(claims.sub);

    if (!user || user.status !== UserStatus.ACTIVE) {
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      throw new AuthenticationError('Access denied.');
    }

    req.user = {
      id: user.id,
      telegramId: user.telegramId,
      displayName: user.firstName ?? user.username ?? user.telegramId,
      status: user.status,
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
