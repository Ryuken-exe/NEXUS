# Dogfood 2026

Dogfood 2026 is a local-first hackathon platform for event setup, team formation, project submissions, weighted judging, normalization, community voting, results, exports, certificates, and auditability. It runs as a Next.js 14 application backed by PostgreSQL 16 and Prisma, with custom JWT authentication and no required hosted services.

## Prerequisites

- Docker Desktop with the Linux container engine enabled
- Docker Compose v2 (`docker compose`)

Node.js, npm, PostgreSQL, Redis, and a manually created `.env` file are not required for the Docker path.

## Clone and run

```sh
git clone <repo-url>
cd <repo-folder>
cp .env.example .env
docker compose up
```

The `cp` step is optional because Compose has safe demo defaults, but it documents the available configuration variables. On Windows PowerShell, use `Copy-Item .env.example .env` instead. Compose builds the application, waits for PostgreSQL, applies the Prisma schema, seeds fixture data automatically, and then starts the web service. No manual migration or seed command is required.

Open [http://localhost:3000](http://localhost:3000). Port `3000` is configurable with `WEB_PORT`, for example `WEB_PORT=3010 docker compose up`; use the matching URL if port 3000 is already occupied.

## Seeded accounts

All seeded accounts use the demo password `dogfood-demo-2026`.

| Role | Email |
|---|---|
| Participant | `participant1@dogfood.local` |
| Judge | `judge1@dogfood.local` |
| Organizer | `organizer@dogfood.local` |
| Admin | `admin@dogfood.local` |

Additional seeded judges are `judge2@dogfood.local` and `judge3@dogfood.local`; additional participants are `participant2@dogfood.local` through `participant5@dogfood.local`.

## Tests

The application image includes the test dependencies. With the Compose stack running, run unit tests inside a disposable container:

```sh
docker compose run --rm web npm test
docker compose run --rm web npm run typecheck
```

The Playwright lifecycle test is designed to run alongside the seeded stack. It uses the project's test configuration and requires a local Node/npm installation because Playwright launches the test web server:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

Alternatively, run the same checks from a Node-enabled test container or CI runner pointed at `http://localhost:3000`. The unit suite covers scoring, normalization, assignment balancing, deadline boundaries, CSV escaping, signatures, and rate limiting. See `acceptance-report.txt` for the latest verified status.

## Tear down

Stop containers while preserving the named PostgreSQL volume:

```sh
docker compose down
```

For a completely fresh database and seed:

```sh
docker compose down -v
docker compose up --build
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATA-MODEL.md](DATA-MODEL.md)
- [JUDGING.md](JUDGING.md)
- [THREAT-MODEL.md](THREAT-MODEL.md)
- [openapi.yaml](openapi.yaml)
- [demo-video-script.md](demo-video-script.md)
- [acceptance-report.txt](acceptance-report.txt)

## Configuration and security

`.env.example` lists local development and Docker override variables. The checked-in Compose values are demo-only defaults, not production secrets. For deployment, set high-entropy `JWT_SECRET` and `JUDGE_SIGNING_SECRET`, use a private PostgreSQL password, and serve through HTTPS. Configured webhooks are the only optional feature that makes outbound runtime requests; the core platform has no hosted-service dependency.

## License

Released under the MIT License. See [LICENSE](LICENSE).
