# 0004. Polling for near-real-time ticket updates

- **Status:** Accepted (owner, 2026-10-30)
- **Date:** 2026-10-27
- **Requirements:** RT-01, RT-02

## Context
Authors must see admin responses and status changes "without refreshing the page". The assignment allows WebSockets, SSE or polling, and only asks that updates "feel responsive". The app is deployed as serverless functions (Vercel) with no shared in-memory state between instances.

## Decision
Client-side polling with SWR `refreshInterval`:
- Author ticket detail and list: 5 s.
- Admin detail: 10 s.
- Admin queue: 15 s.

Polling pauses while the tab is hidden and revalidates on focus. Responses are small JSON payloads from existing REST endpoints, so no new API surface is added. The admin reply composer keeps local state so that polling never overwrites text being edited.

## Alternatives considered
- **Server-Sent Events.** True push, but on serverless each open stream holds a function invocation. Cross-instance fan-out needs Postgres LISTEN/NOTIFY over a persistent connection, or Redis.
- **WebSockets.** Not supported by Vercel functions, and would need a separate server or a hosted service (Pusher, Ably, Supabase Realtime): extra infrastructure and secrets.
- **Conditional polling (ETag or `updatedAt`) to return 304.** A cheap optimisation that can be added later if request volume matters. It is not needed at demo scale.

## Consequences
- Updates arrive within one interval (up to about 5 s for authors). This meets "near-real-time".
- Load is predictable but scales with open tabs. The write-up names SSE with pub/sub as the production evolution.
- No extra infrastructure, and it is easy to test and explain.
