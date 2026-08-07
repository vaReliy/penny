# budget-ui

**Tags:** `scope:budget` · `type:ui` · `platform:web`

Dumb presentational components for the budget domain: `BalanceCardComponent` (displays account balance), `RatesCardComponent` (FX rate table), `HistoryChartComponent` (transaction history chart); utilities: `convert-balance.util`, `rate-entry-display`. Pure `OnPush` change detection, signal-driven inputs/outputs, no HTTP or store access. May import `scope:budget` contracts/util and `scope:shared` contracts/util. No server-only imports.
