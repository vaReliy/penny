import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { Connection } from 'mongoose';
import { pingMongo } from 'identity-infrastructure';

import { TOKENS } from '../identity/tokens.js';

/** Response shape for the health endpoint. */
interface HealthResponse {
  readonly status: 'ok' | 'degraded';
  readonly mongo: boolean;
}

@Controller('health')
export class HealthController {
  public constructor(
    @Inject(TOKENS.MongoConnection)
    private readonly mongoConnection: Connection,
  ) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    let mongoOk = false;

    try {
      mongoOk = await pingMongo(this.mongoConnection);
    } catch {
      mongoOk = false;
    }

    const body: HealthResponse = {
      status: mongoOk ? 'ok' : 'degraded',
      mongo: mongoOk,
    };

    const statusCode = mongoOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(body);
  }
}
