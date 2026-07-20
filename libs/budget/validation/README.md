# budget-validation

**Tags:** `scope:budget` · `type:validation` · `platform:shared`

LIVR schemas for the budget vertical's mutating/filtering requests — backend (application-layer) use only, consumed by `apps/api` and `budget/application`. Frontend libs (`type:feature`, `type:ui`, `type:data`) may not import this lib per the Nx boundary contract. May import only `scope:budget` + `type:util` — schemas are self-contained runtime objects and never import DTO types from `budget-contracts`. Call `registerLivrRules()` from `shared-kernel` at process startup before using any schema.

Every schema rejects operator-object payloads (e.g. `{ $gt: '' }`) in fields that should be scalars — a built-in LIVR property (every rule used here checks `isPrimitiveValue` and returns `FORMAT_ERROR` for objects/arrays), which closes the Mongo-operator-injection surface at the validation boundary before business logic ever sees the request.
