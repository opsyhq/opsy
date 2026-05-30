# Claude Instructions

The idea of AGENTS.md, distilled — see it for the full rationale. Two failure
modes drive everything below: **baked-in answers** and **drift** (parallel
sources of truth that look equivalent today and diverge tomorrow).

- **Dynamic behavior.** No hard-coded hacks, static maps, aliases, fallbacks,
  or one-off exceptions to steer product behavior. It comes from
  source-of-truth: runtime discovery, provider APIs, DB state, schemas, tools,
  config. If something is wrong, fix the dynamic path — never bake the answer
  in.

- **One source of truth.** Don't invent wrapper types, copied API shapes, or
  parallel ownership when an existing schema/contract/DB row/domain type fits
  — tighten the existing type instead. Don't re-run the same validation across
  route/service/workflow/step; validate once at the boundary that owns the
  decision and pass typed state forward.

- **Minimal structure.** Don't extract trivial transforms, predicates, or key
  builders into helpers unless they encode a real reusable concept or remove
  meaningful duplication — otherwise inline them. Prefer direct functional
  flow; treat `let` clusters, broad casts, `Awaited<ReturnType<…>>`, and
  prepare/derive scaffolding as smells.

- **Flow ownership.** One public function owns a domain flow. Don't hide
  branching behind vague orchestration (`ensure*`, `hydrate*`, `prepare*`,
  `resolve*`). If it's "read, if missing or stale generate/sync, read again,"
  write that sequence directly in the owning function.

- **Migrations.** Generate with `bun run db:generate --name <name>` from
  `apps/api`; apply with `bun run db:migrate` from `apps/api`. No hand-rolled
  structural DDL — only data backfills the generator can't infer.
