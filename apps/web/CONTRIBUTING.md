# Contributing — apps/web

## The one rule

> **If only one thing uses it, it lives next to that one thing.**

Everything below is a consequence of that rule.

## Decision tree — where does X go?

```
How many disjoint consumers does X have?
│
├─ 1 consumer
│   ├─ Consumer is a route file → routes/<route>/-X.tsx     (dash prefix)
│   ├─ Consumer is a component  → next to that component, OR inline
│   └─ Logic that needs tests   → Foo.logic.ts + Foo.logic.test.ts
│
└─ 2+ consumers
    ├─ All in same feature folder    → root of that folder
    ├─ In disjoint feature folders
    │   ├─ Component → components/   (earns its place)
    │   ├─ Hook      → hooks/        (earns its place)
    │   └─ Util/algo → lib/          (earns its place)
    └─ Cross-app                     → packages/<name>
```

There is no other rule.

## Folders

| Folder | Lives there if… |
|---|---|
| `lib/` | React-Query factory OR generic util used by ≥2 disjoint features |
| `hooks/` | Hook used by ≥2 disjoint feature folders |
| `components/ui/` | shadcn primitive |
| `components/<feature>/` | Component group with ≥2 disjoint consumers |
| `components/<Foo>.tsx` | Single shared widget (rare — usually means a feature folder is missing) |
| `routes/.../foo/index.tsx` | Public route entry — thin, just `loader` + JSX |
| `routes/.../foo/-Bar.tsx` | Private to that route — never imported from outside the folder |

If only one route imports a `components/Foo.tsx`, **move it** into that
route's folder as `-Foo.tsx`.

## File-naming conventions

| Pattern | When |
|---|---|
| `Foo.tsx` | A component file. PascalCase. |
| `Foo.logic.ts` + `Foo.logic.test.ts` | Pure logic extracted from `Foo.tsx`. |
| `-Foo.tsx`, `-foo.ts` | Private sibling to a route or feature folder. Dash prefix = "do not import from outside this folder." |
| `useFoo.ts` (camelCase) | Hook colocated inside a route's `-prefix` set. |
| `use-foo.ts` (kebab) | Hook in `hooks/` or a `components/<feature>/` folder. |
| `*ReactQuery.ts` | Per-domain `queryOptions`/`mutationOptions`/`invalidate*` factory in `lib/`. |

## When to fold vs extract

**Default: inline.** Three similar lines is better than a premature
abstraction. Extract only when one of these triggers fires:

| Trigger | Action |
|---|---|
| Logic needs a unit test | `Foo.logic.ts` sibling |
| Private subcomponent over ~50 lines | `-Sub.tsx` sibling |
| Used by 2+ files in same folder | Promote to a non-prefix sibling |
| Used by 2+ files in disjoint folders | Promote to `components/` / `hooks/` / `lib/` |

Don't extract a 5-line helper for one caller. Don't pre-build a generic
wrapper because "we might need it." Wait for the second caller.

## Routes are thin

A route file does two things: **load data**, **compose JSX**. That's it.

- Leaf routes: 7–30 lines.
- Layout routes: up to ~120 lines.
- Anything over 150 → a `-`-prefix extraction is missing.

If you find yourself writing helpers, view-model types, sub-components,
or mutations inline in a route — extract them to `-`-prefix siblings.
See `routes/_authenticated/members/`,
`routes/_authenticated/projects/`,
`routes/_authenticated/projects/$projectSlug/architecture/` for the
pattern in action.

## Components decompose the same way

Once a component exceeds ~300 lines, it's a folder, not a file:

```
components/<Foo>/
├── Foo.tsx              ← public, ≤300 lines, just composition
├── Foo.logic.ts         ← pure derivations + helpers (testable)
├── Foo.logic.test.ts
├── -Header.tsx          ← private subcomponent
└── -Row.tsx             ← private subcomponent
```

The `.tsx` imports from its own `.logic.ts`. Tests target `.logic.ts`.
Subcomponents with the `-` prefix never get imported from outside the
folder.

## Side effects

- Network, navigation, toasts, storage → event handlers / `useMutation`
  callbacks / route loaders.
- Never in render bodies.
- A render-time `useEffect(() => mutate())` is almost always wrong;
  prefer a `staleTime` policy, a route loader, or an explicit user action.

## State boundaries

- **Server state** — TanStack Query. `lib/<domain>ReactQuery.ts` owns the
  query key tree, query/mutation factories, and the `invalidate*` helper
  for that domain.
- **Cross-cutting UI state** (canvas viewport, right rail content) —
  Zustand store or React Context. Context lives in a standalone file at
  the depth of the lowest common ancestor (e.g.
  `components/project-canvas/canvasContext.ts`), provided by its owning
  component.
- **Local toggles, dirty flags** — plain `useState`.

## Cache keys

All cache keys for one domain come from the same factory in
`lib/<domain>ReactQuery.ts`. Don't write ad-hoc `["something", id]` keys
in components — they won't get invalidated by the SSE flusher or by
sibling mutations. Add the key to the factory and consume from there.

## Tests

Run in Vitest under the `node` environment (no jsdom). Scope is the
**pure core**:

- `.logic.ts` files — pure transforms / derivations
- `*ReactQuery.ts` — query-key shape and invalidation
- Domain transforms in `components/<feature>/` — pure-function tests

If a test needs the DOM, it's probably testing the wrong thing.

## Adding shadcn primitives

```bash
bunx shadcn@latest add button card dialog
```

Files land in `src/components/ui/`. Never re-export from a barrel — every
importer points at the actual file.

## Style / lint

- Biome handles formatting and lint (`bun run --cwd .. lint` from repo root).
- No barrels (`index.ts` re-exports), **except** the V2 feature folders
  listed under "V2 folder layout" below. Those folders own a dispatch
  registry whose members must be discoverable through one import path —
  see the V2 section for the exact list.
- No emojis in code/files unless explicitly requested.
- Comments only when the *why* is non-obvious — well-named identifiers
  document the *what*.

## Reviewing your own PR

Before opening a PR, scan for these red flags:

- A new file in `components/` / `hooks/` / `lib/` with exactly one importer
  → should be colocated with that importer.
- A route file over 150 lines → missing `-`-prefix extractions.
- A component `.tsx` over 300 lines → needs a `.logic.ts` sibling and/or
  `-`-prefix subcomponents.
- An `index.ts` barrel outside the V2 feature folders (see V2 section
  below) → delete it; import the source file.
- A `useEffect` that fires a mutation on mount → almost certainly a
  loader prefetch or a `staleTime` policy instead.
- A new query key written inline (not from a `*ReactQuery.ts` factory)
  → add it to the factory.
- A duplicated helper (grep before you write).

---

# V2 frontend conventions

The sections below are the V2 redesign rules. They sit on top of the
"one rule" above — same spirit, more specific guidance for the patterns
that the redesign locks in.

## Banned verbs in writer position

Don't name functions or store actions with these verbs when they describe
a write or transition:

- `set*` — implies a generic mutator. Use `mark*` for status transitions
  (`markRunning`, `markFailed`), `<verb>*` for user actions (`approve`,
  `reject`, `cancel`, `connect`), or `<verb>*X` for field updates
  (`updateSlug`, `updateInputs`).
- `save*` — usually masks a real verb (`update`, `create`, `apply`,
  `commit`). Pick the real one.
- `request*` — fuzzy. The verb is the intent (`approve`, `retry`,
  `cancel`), not the network shape.
- `ensure*`, `hydrate*`, `prepare*`, `resolve*` — orchestration sugar
  that hides "read, if missing or stale then generate/sync, read again."
  Write that sequence directly in the owning function.

The Zustand `set*` action names that remain today (`setCreateOpen`,
`setImportOpen`, `setDetailTarget`, etc.) are tracked for replacement
by URL search params in the auth-tier-split phase — don't add new ones.

## One public function per domain flow

No `*Bearer` adapter types whose only job is to copy backend row fields.
No `WidgetControl`-style adapters that re-export an existing contract.

Exception: `OperationStatusBearer` exists today as a real structural
private type that owns a multi-field shape contract. Keep it. Don't add
new ones in the same shape.

## Typed registries over `if/else` dispatch

Field widgets, operation status rendering, and provider chrome look up
a typed registry keyed on the discriminator. The consumer never branches
on the discriminator itself.

- Adding a new field kind → add an entry under
  `components/resource-fields/kinds/`.
- Adding a new operation status panel → add an entry under
  `components/operations/` (`approval/`, `running/`, `failed/`,
  `terminal/`).
- Adding a new provider → add a `ProviderPlugin` under
  `components/integrations/providers/`.

## URL is source of truth for sheet/modal targets

Detail target, related-create flow, and onboarding step come from
TanStack Router search params validated with Zod (`validateSearch`), not
Zustand. Transient cross-route flows (the `relatedCreate` state machine)
may live in a dedicated store, but per-route sheet/modal open state
belongs in the URL.

## Request lifecycle = `useMutation`

No hand-rolled `try/catch/finally + setBusy`. Forms call
`mutation.mutate()`. Pending state comes from `mutation.isPending`;
errors from `mutation.onError` (toast) or `mutation.error` (inline). The
form owns rendering; the mutation owns lifecycle.

## Mutation factories take typed inputs, not callbacks

Invalidation is driven by `projectSlug` (or equivalent identifier) on
the options object — no `onInvalidate?: () => void` escape hatch. The
factory calls `queryClient.invalidateQueries(projectQueryKey(opts.projectSlug))`
inside `onSuccess`.

```ts
export function approveOperationMutationOptions(opts: {
  projectSlug: string
}) {
  return mutationOptions({
    mutationFn: ...,
    onSuccess: () => {
      queryClient.invalidateQueries(projectQueryKey(opts.projectSlug))
    },
  })
}
```

## V2 folder layout

```
apps/web/src/
  components/
    brand/               # logo, favicon, mark
    canvas/              # primitives (Node, Edge, Overlay shells)
    changesets/          # all changeset UI
    operations/
      approval/          # approval-specific UI
    resource-fields/
      kinds/             # one file per field kind
    resource-picker/     # promoted from inline ReferenceTextInput
  hooks/                 # cross-component hooks (canvas, sse, debounce, …)
```

These seven folders each carry an `index.ts` barrel — the only barrels
allowed in the repo. They exist because the folders hold a dispatch
registry (field kinds, status panels, provider plugins, canvas
primitives) that consumers must reach through one stable import path.
Outside these folders, the "no barrels" rule still holds.
