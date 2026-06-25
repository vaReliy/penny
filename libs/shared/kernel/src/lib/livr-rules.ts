import LIVR from 'livr';

/**
 * Central registry for platform-wide custom LIVR rules.
 *
 * Register any custom validation rule here (and call `registerLivrRules`
 * once at process startup, before constructing the first `LIVR.Validator`)
 * so every `BaseService` schema across the codebase can reference the same
 * rule names. Do not register ad-hoc rules inside individual services —
 * that fragments the rule set and risks name collisions.
 */

/** Idempotency guard so repeated calls (e.g. in tests) do not re-register rules. */
let rulesRegistered = false;

/**
 * Registers the platform's custom LIVR rules as LIVR defaults. Safe to call
 * multiple times — subsequent calls are a no-op.
 */
export function registerLivrRules(): void {
  if (rulesRegistered) {
    return;
  }

  // No custom rules yet — this is the single place to add them as the
  // platform grows (e.g. `money_amount`, `currency_code`, `telegram_id`).
  LIVR.Validator.registerDefaultRules({});

  rulesRegistered = true;
}
