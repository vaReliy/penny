# budget-data-access

**Tags:** `scope:budget` · `type:data` · `platform:web`

Angular API client services and signal-based stores for the budget domain (categories, monthly budgets, transactions, dashboard analytics, FX rates). The single web-side entry point to the budget HTTP API — screens never call `HttpClient` directly for budget calls. May import `scope:budget` util/contracts and `scope:shared` contracts/util. No server-only imports; no `localStorage` for tokens.
