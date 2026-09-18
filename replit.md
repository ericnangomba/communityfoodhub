# Community Wealth Hub

A mobile-first local food distribution platform connecting Western Cape communities with neighborhood hubs, warehouses, delivery agents, and transparent pricing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/community-wealth-hub/` — React/Vite client with role-aware storefront, fulfillment, delivery, command dashboard, pricing, and ward-zone views.
- `artifacts/api-server/src/routes/community.ts` — demo API routes, seed data, order lifecycle, WhatsApp parsing, pricing offsets, and analytics payloads.
- `lib/api-spec/openapi.yaml` — source of truth for the catalog, orders, operations, pricing, and dashboard API.
- `lib/db/src/schema/index.ts` — relational schema for users, hubs, warehouses, inventory, orders, and analytics logs.

## Architecture decisions

- API contracts are defined in OpenAPI first and generate the React Query client and Zod validation schemas.
- The pilot experience uses deterministic Elsies River seed data in the API process so every role has a usable first-load demo.
- Pricing is calculated from a retail baseline with a published global community offset, so catalog prices and admin controls share one source of truth.
- Western Cape ward zones are modeled separately from hubs so new zones can be onboarded without changing the core order flow.

## Product

- Clients browse repackaged essentials, add them to a cart, choose a delivery address, checkout, and simulate WhatsApp text orders.
- Hub operators can review incoming web and WhatsApp orders and move them through warehouse packing, dispatch, and delivery.
- Delivery agents see pickup and drop-off details and confirm delivery milestones from a mobile-friendly portal.
- Super admins can monitor hubs, stock health, demand forecasts, retained local currency, and published pricing offsets.

## User preferences

_No persistent preferences recorded._

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml` so frontend hooks and Zod schemas stay aligned.
- The web artifact depends on the shared API service under `/api`; use the managed workflows rather than starting Vite manually.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
