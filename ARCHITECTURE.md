# Architecture

## Tier 1: Core

Next.js 14 App Router serves both the browser experience and JSON REST handlers. PostgreSQL 16 is the authoritative store; Prisma models enforce event relationships and high-value uniqueness constraints. API handlers verify a signed, seven-day JWT in an httpOnly, same-site cookie and perform role and object-ownership checks before reading private data or mutating state. Registration can only create participant accounts. A judge role can be obtained only through an event manager's expiring, email-bound invitation.

The participant browser can create a team, join by invite token, save a draft, and submit. The API uses server time for the deadline and disallows edits after submit. Event owners/admins configure dates and voting; organizer-owned events cannot be managed by another organizer.

## Tier 2: Judging

Assignments are rows unique per project/judge pair. Manual batch assignment creates the chosen judge/submission cross-product. Automatic assignment sorts judges by current in-batch load and uses judge ID as a deterministic tie-breaker, distributing review load evenly without assigning a judge twice to one submission. Rubric writes require weights that sum to 100. Scores are bounded by each criterion's maximum and calculated as the weighted percentage contribution. Judges can only query and score assigned projects; participants query only their own team's submission.

Normalization is implemented as a per-judge sample z-score. Results remain hidden until both judging and community voting close and an organizer publishes them. Scores remain private to authorized judges/organizers; public gallery responses never contain them. CSV exports are scoped to the owning organizer or an admin.

## Tier 3: Public participation

Gallery ordering is deterministic from an opaque browser-local seed, stable for that browser and different for browsers with different seeds. Search and track filters are applied in the database; gallery reads have a bounded per-process IP request window. Votes use database uniqueness on event/account and event/IP hash to reject concurrent duplicates. Comments and votes write audit entries; audit reads are admin-only. Comment rate limits are serialized in PostgreSQL by account and IP. Gallery limits reset on process restart and are not shared across replicas.

## Tier 4: Integrations and artifacts

All UI capabilities call same-origin REST handlers documented in `openapi.yaml`. Webhooks are optional and disabled until a manager configures a destination; delivery uses an HMAC header, timeout, and stored attempt result. Certificates are generated locally with `pdf-lib`. Judge records store a JSON payload, SHA-256 digest, and HMAC-SHA256 signature; `scripts/verify-judge-record.mjs` validates them offline when supplied the shared key. The embed route renders the same read-only gallery without the site shell. JSON bulk import/export handles teams and submissions; score data is included in exports.

## Why this stack

Next.js lets the user-facing pages and REST API share a deployment and cookie boundary. PostgreSQL transactions and unique indexes make identity, event scoping, duplicate votes, and assignment invariants explicit. Prisma keeps relational constraints reviewable. Docker Compose provides the local database and deterministic seed lifecycle without hosted services. Redis is deliberately omitted because there is no queued or distributed background job in this implementation.

## Runtime and trust boundaries

The normal runtime is browser → Next.js → PostgreSQL. No external API is needed for core operation. A configured webhook is the sole feature that intentionally makes outbound requests; operators must trust destinations they configure. The included compose secrets are demo-only. See `THREAT-MODEL.md` for abuse cases and residual risks.

## Route guard audit (T1/T2)

The core request boundary is centralized in `src/lib/auth.ts`. Route handlers should be thin and rely on `requireUser()`, `requireRole()`, and `requireEventManager()` instead of ad hoc checks.

| Route | Allowed roles | Guard present | Notes |
| --- | --- | --- | --- |
| `/api/auth/login` | public | Yes | login only; session issued after credential check |
| `/api/auth/register` | public | Yes | participant-only account creation |
| `/api/auth/me` | authenticated | Yes | loads current session user |
| `/api/events` | ORGANIZER, ADMIN | Yes | event creation requires manager role |
| `/api/events/[slug]` | ORGANIZER, ADMIN | Yes | owner/admin event manager gate |
| `/api/events/[slug]/teams` | PARTICIPANT | Yes | team membership and event scoping enforced |
| `/api/events/[slug]/submissions` | PARTICIPANT, JUDGE, ORGANIZER, ADMIN | Yes | participant team check; organizer sees event-level submissions |
| `/api/events/[slug]/assignments` | JUDGE, ORGANIZER, ADMIN | Yes | judge-scoped reads; manager-only mutation |
| `/api/events/[slug]/calibration` | JUDGE, ORGANIZER, ADMIN | Yes | manager check only when present |
| `/api/events/[slug]/conflicts` | JUDGE, ORGANIZER, ADMIN | Yes | manager gate for admin writes; judge can read own conflict scope |
| `/api/events/[slug]/criteria` | ORGANIZER, ADMIN | Yes | event manager ownership required |
| `/api/events/[slug]/judge-invites` | ORGANIZER, ADMIN | Yes | event owner/admin gate |
| `/api/events/[slug]/results` | public with hidden-results policy | Yes | public access blocked before publication; manager overrides |
| `/api/events/[slug]/records` | ORGANIZER, ADMIN | Yes | event manager guard |
| `/api/events/[slug]/progress` | ORGANIZER, ADMIN | Yes | event manager guard |
| `/api/events/[slug]/export` | ORGANIZER, ADMIN | Yes | event manager guard |
| `/api/events/[slug]/audit` | ADMIN | Yes | admin-only access |
| `/api/events/[slug]/score-history` | ADMIN | Yes | admin-only access |
| `/api/events/[slug]/webhooks` | ORGANIZER, ADMIN | Yes | event manager guard |
| `/api/judges` | ORGANIZER, ADMIN | Yes | manager-only judge registry access |
| `/api/scores` | JUDGE | Yes | judge identity validated before score write |
| `/api/judge-invites/[token]` | PARTICIPANT, JUDGE | Yes | token-based account role acceptance |

This audit was intentionally scoped to the T1/T2 routes under active refactor. T3/T4 behavior was left untouched, in line with the requirement to avoid unrelated feature work.