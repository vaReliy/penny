# shared-validation

**Tags:** `scope:shared` · `type:validation` · `platform:shared`

LIVR schemas for backend (application-layer) use only — consumed by `apps/api` and backend libs (e.g., `identity/application`). Frontend libs (`type:feature`, `type:ui`, `type:data`) may not import this lib per the Nx boundary contract. May import only `scope:shared` + `type:util`. Call `registerLivrRules()` from `shared-kernel` at process startup before using any schema.
