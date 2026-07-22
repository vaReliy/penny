import { TestBed } from '@angular/core/testing';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppConfigService);
  });

  it('throws when accessed before configuration is loaded', () => {
    expect(() => service.get()).toThrow(
      'AppConfigService accessed before configuration was loaded',
    );
  });

  it('returns the config that was set', () => {
    service.set({ telegramBotUsername: 'TEST_BOT' });

    expect(service.get()).toEqual({ telegramBotUsername: 'TEST_BOT' });
  });
});
