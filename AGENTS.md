# Agent Instructions

- Do not alter product behavior with hard-coded hacks, static semantic maps, aliases, fallbacks, or one-off exceptions.
- Keep behavior dynamic: use source-of-truth data, runtime discovery, provider APIs, database state, schemas, tools, and explicit configuration.
- If something is wrong, improve the dynamic path instead of baking the answer into code.
- Do not extract trivial one-line transformations, predicates, key builders, or field reshaping into standalone helpers. Inline them where used unless they encode a real reusable domain concept or remove meaningful duplication.
- Do not invent local wrapper types, copied API shapes, semantic aliases, or ownership structures when an existing schema, provider, contract, DB row type, or exported domain type can be reused. Prefer tightening the existing source-of-truth type over adding a parallel one.
- Prefer direct functional data flow over mutable assembly. Treat clusters of `let`, broad casts, `Awaited<ReturnType<...>>`, and "prepare/derive" scaffolding as smells to simplify unless the code genuinely needs staged ownership.
- Domain flow must be owned by one public service function. Do not hide branching domain behavior behind vague orchestration helpers named `ensure*`, `hydrate*`, `prepare*`, `resolve*`, or similar. If a flow is "read, if missing or stale then generate/sync/upsert, then read again", write that sequence directly in the owning function.
- Do not duplicate validation across route, service, workflow, and step boundaries. Put validation at the earliest boundary that owns the decision, pass typed state forward, and let downstream code handle only real source-of-truth races or failures instead of re-running the same validation.
- For database schema changes, use the repo migration workflow. Generate migrations with the package script (for API: `bun run db:generate --name <name>` from `apps/api`) and apply them with the package migrate script (for API: `bun run db:migrate` from `apps/api`). Do not hand-roll structural DDL; only add explicit data backfills/rewrites that the generator cannot infer.
