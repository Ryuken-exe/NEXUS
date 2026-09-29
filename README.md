# Dogfood 2026

Dogfood 2026 is a local-first platform for running hackathons and other judged events. Organizers configure events, invite judges, and publish rubrics; participants form teams and submit projects; judges score assigned submissions; and organizers publish results, export records, and issue certificates.

The application is built with Next.js 14, TypeScript, PostgreSQL 16, and Prisma. Docker Compose runs the app and database together, including migrations and demo-data seeding. No hosted services are required for core operation.

## Features

- Event setup, team formation, submissions, and deadline enforcement
- Judge invitations, assignment balancing, rubric scoring, and score normalization
- Conflict-of-interest declarations, calibration, and score history
- Public project gallery, community voting, and comments
- Organizer-controlled results, CSV and bulk data exchange, and PDF certificates
- Audit records, signed judge records, and optional signed webhooks
- Role-based access for participants, judges, organizers, and administrators

## Run with Docker

### Requirements

- Docker Desktop with the Linux container engine enabled
- Docker Compose v2 (`docker compose`)

Node.js, npm, and a local PostgreSQL installation are not needed for this setup.

### Start the app

```sh
git clone <repo-url>
cd <repo-folder>
docker compose up --build
```

Compose starts PostgreSQL, applies Prisma migrations, seeds demo data, and then starts the web app. Open [http://localhost:3000](http://localhost:3000). To use a different host port, set `WEB_PORT`, for example `WEB_PORT=3010 docker compose up --build`.

Compose includes demo-only defaults. To review or override them, copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell; `cp .env.example .env` in other shells).

### Demo accounts

All seeded accounts use the password `dogfood-demo-2026`.

| Role | Email |
| --- | --- |
| Participant | `participant1@dogfood.local` |
| Judge | `judge1@dogfood.local` |
| Organizer | `organizer@dogfood.local` |
| Admin | `admin@dogfood.local` |

The seed also creates `judge2@dogfood.local`, `judge3@dogfood.local`, and participants `participant2@dogfood.local` through `participant5@dogfood.local`.

## Local development

Install Node.js and npm, then start PostgreSQL locally or with Compose. With PostgreSQL available at the URL in `.env.example`:

```sh
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run db:setup
npm run dev
```

On macOS or Linux, replace the first command with `cp .env.example .env`. The app is available at [http://localhost:3000](http://localhost:3000). `db:setup` applies migrations and seeds the database.

## Tests

Run unit tests and TypeScript checks in the app container while the Compose stack is available:

```sh
docker compose run --rm web npm test
docker compose run --rm web npm run typecheck
```

The Playwright end-to-end suite uses a local Node/npm installation and the seeded app:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

The unit tests cover scoring, normalization, assignment balancing, deadline boundaries, CSV escaping, signatures, and rate limiting. See [acceptance-report.txt](acceptance-report.txt) for the recorded acceptance status.

## Stop and reset

Stop the containers and retain the database volume:

```sh
docker compose down
```

To remove the database volume and start with a fresh seed:

```sh
docker compose down -v
docker compose up --build
```

## Project documentation

- [Architecture](ARCHITECTURE.md)
- [Data model](DATA-MODEL.md)
- [Judging and scoring](JUDGING.md)
- [Threat model](THREAT-MODEL.md)
- [REST API specification](openapi.yaml)
- [Demo video script](demo-video-script.md)

## Configuration and security

See `.env.example` for the available settings. Compose's default credentials and signing keys are for local demos only. Deployments should use strong, independent `JWT_SECRET` and `JUDGE_SIGNING_SECRET` values, a private PostgreSQL password, and HTTPS. Configured webhooks are the only feature that intentionally makes outbound runtime requests.

## License

MIT. See [LICENSE](LICENSE).
