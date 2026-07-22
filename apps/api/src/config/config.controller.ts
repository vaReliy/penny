import { Controller, Get, Inject } from '@nestjs/common';

import { API_CONFIG } from './api-config.js';
import type { ApiConfig } from './api-config.js';

/** Public runtime config response shape — never spread the full {@link ApiConfig}. */
interface PublicConfigResponse {
  readonly telegramBotUsername: string;
}

@Controller('config')
export class ConfigController {
  public constructor(
    @Inject(API_CONFIG) private readonly apiConfig: ApiConfig,
  ) {}

  @Get()
  public getConfig(): PublicConfigResponse {
    return { telegramBotUsername: this.apiConfig.telegramBotUsername };
  }
}
