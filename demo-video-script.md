# Five-minute demo outline

| Time | Shot | Action and narration |
|---|---|---|
| 0:00–0:25 | Event shelf | Open the seeded events. Frame Dogfood Build Day, its tracks, teams, and projects as one local platform. |
| 0:25–1:00 | Participant view | Sign in as `participant1@dogfood.local`; create a team, show its invite token, save a draft, then submit. Explain the server-side deadline and submitted lock. |
| 1:00–1:40 | Gallery | Search/filter a project, change browser seed to show deterministic-but-viewer-specific order, vote once, and leave a comment. Demonstrate duplicate vote rejection. |
| 1:40–2:35 | Judge view | Sign in as `judge1@dogfood.local`; show assigned-only queue and rubric scoring. Explain weights and the score validation. |
| 2:35–3:20 | Organizer controls | Sign in as organizer. Show progress, auto-assignment balancing, raw/normalized export, and result publication controls. |
| 3:20–4:00 | Normalization proof | Open `/normalization-proof`; compare fixture raw score distributions and z-score standings, including the one-score/zero-variance rule. |
| 4:00–4:35 | Public/API | Show the iframe route `/embed/dogfood-build-day`, a generated certificate, and a signed record with the offline verifier command. |
| 4:35–5:00 | Trust and setup | Briefly show `THREAT-MODEL.md`, then reset with `docker compose down -v && docker compose up --build`. Mention seeded data and demo-only credentials. |

Avoid recording signing keys or other production credentials. If demonstrating judge record verification, use a disposable local key and explain that HMAC verification requires a shared secret.