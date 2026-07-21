// Set telegramBotUsername to your actual Telegram bot username (without @).
// Find it in BotFather: the name ending in "bot", e.g. "mypennybot".
// For local development: copy this file to environment.ts and environment.development.ts, then replace PLACEHOLDER_BOT.
// For Docker/CI builds: the value comes from the TELEGRAM_BOT_USERNAME GitHub Actions secret. See docs/CI_SECRETS.md.
export const environment = {
  telegramBotUsername: 'PLACEHOLDER_BOT',
};
