# Opsy Web Dashboard

React SPA — the primary UI for Opsy. Talks to the control-plane API via
Hono's typed client (end-to-end inference) and authenticates with Better
Auth's React client.

## Stack

| Concern | Library |
|---|---|
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query |
| Forms | react-hook-form |
| Canvas | @xyflow/react (ReactFlow) |
| Cross-cutting UI state | Zustand (canvas store), React Context colocated with its Provider |
| Auth | Better Auth (cookie session, `credentials: "include"`) |
| API client | Hono RPC (`hc<AppType>()`) |
| Styling | Tailwind v4 + shadcn/ui primitives |
| Tests | Vitest, `node` env (no jsdom) |

## How it runs

```
Browser
  → Vite dev server (localhost:3000)
    → API base = http://localhost:4000 (CORS with credentials: include)
    → Better Auth cookie session
    → TanStack Router → React Query → Hono client → API
```

Production builds a static bundle via Vite. A reverse proxy/CDN serves
assets and forwards `/api` requests to the control plane.

## Architecture principles

- **Server state lives in the query layer, not components.** Route loaders
  prefetch with `queryClient.ensureQueryData`; components read with
  `useSuspenseQuery` and the route's `pendingComponent` covers loading.
  Per-domain query/mutation factories live in `lib/*ReactQuery.ts`. No
  `useEffect(() => fetch())`, no `if (loading)` ladders in data routes.

- **Effects at the edge.** Network calls, navigation, toasts, and storage
  live in event handlers, `useMutation` callbacks, or route loaders —
  never in render bodies.

- **Typed API boundary.** The Hono client (`lib/api.ts`) threads types
  from `@opsy/api` end-to-end. Bad payload shapes fail at the TypeScript
  layer, not at runtime.

- **Routes as compositions.** Each route module is `loader` + `component`
  + (sometimes) `pendingComponent`. Anything beyond that — sub-views,
  dialogs, view-model derivations — extracts to `-`-prefix siblings in
  the route folder.

- **SSE for live state.** `hooks/use-project-event-stream.ts` mounts at
  the `$projectSlug` layout and batches operation events into React Query
  cache invalidations.

## Project structure

```
apps/web/src/
  main.tsx                  # App shell: QueryClientProvider → RouterProvider
  styles.css                # Tailwind v4 + shadcn CSS vars
  routeTree.gen.ts          # auto-generated (do not edit)

  routes/                   # TanStack file-based routes
    __root.tsx              # Root + RouterContext = { session, queryClient }
    login.tsx               # public
    device.tsx              # device auth flow
    onboarding.tsx          # onboarding
    _authenticated.tsx      # auth-guard layout (sidebar, top bar, right rail)
    _authenticated/
      index.tsx             # dashboard
      consent.tsx           # OAuth consent
      members/              # org members route
        index.tsx
        -MembersTable.tsx
        -InviteMemberDialog.tsx
        -membersView.ts
      settings/
        organization.tsx, profile.tsx, api-keys.tsx, integrations.tsx
        -DangerZone.tsx, -DeleteAccountSection.tsx, -apiKeyReactQuery.ts
      projects/
        index.tsx           # list
        -CreateProjectDialog.tsx, -DeleteProjectDialog.tsx, -projectColor.ts
        $projectSlug.tsx    # layout for one project (mounts SSE)
        $projectSlug/
          architecture/     # canvas route — `-prefix` siblings
          integrations/, settings/

  lib/                      # cross-feature utilities only
    api.ts                  # Hono typed client
    query.ts                # QueryClient + invalidate helpers
    auth.ts, auth/          # Better Auth client + auth helpers (hasRole, signOut)
    *ReactQuery.ts          # per-domain queryOptions/mutationOptions factories
    path.ts                 # path-traversal helpers
    utils.ts                # cn() className merge
    providerMeta.ts         # MIRROR of apps/api provider metadata

  components/
    ui/                     # shadcn primitives (add via `bunx shadcn@latest add`)
    layout/                 # AppRail, TopBar, RightRailSlot — global shell
    operations/             # operation list, detail sheet, SSE stream hook
    project-canvas/         # ReactFlow nodes, edges, layout, canvas context
    resource-detail/        # resource view; logic + tests siblings
    resource-fields/        # form fields, layout, visibility
    resource-sheet/         # staged-change diff body
    StagedChangesBar.tsx, DeployingBar.tsx, ResourceCreateDialog.tsx, …
    # (some of the above are still in flight to route folders)

  hooks/                    # multi-consumer hooks ONLY
    use-project-event-stream.ts   # project SSE (mounted at $projectSlug)

  errors/                   # error mapping + toast adapter
  integrations/             # integration provider implementations
```

Single-consumer code lives next to its consumer with a `-` prefix; see
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Commands

```bash
bun run dev          # Vite dev server on :3000
bun run build        # production bundle to dist/
bun run preview      # serve the production build locally
bun run typecheck    # tsc --noEmit
bun run test         # vitest, one shot
bun run test:watch   # vitest, watch mode
bun run smoke        # Playwright smoke test (needs a browser)
```

## Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | — | API base URL (e.g. `http://localhost:4000` in dev) |

## Adding UI components

shadcn/ui components are copied as source on demand:

```bash
bunx shadcn@latest add button card dialog
```

Files land in `src/components/ui/` — no hidden deps.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the layout decision tree, the
`.logic.ts` pattern, the `-prefix` convention, and the one rule that
covers all the others.
