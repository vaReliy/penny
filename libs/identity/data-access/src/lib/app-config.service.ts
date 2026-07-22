import { Injectable } from '@angular/core';

export interface AppConfig {
  readonly telegramBotUsername: string;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig | null = null;

  public set(config: AppConfig): void {
    this.config = config;
  }

  public get(): AppConfig {
    if (!this.config) {
      throw new Error(
        'AppConfigService accessed before configuration was loaded',
      );
    }
    return this.config;
  }
}
