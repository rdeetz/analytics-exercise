# Blueprint — Analytics Engineer Work Simulation

## Overview

You're stepping into the analytics engineer role at Blueprint for a day. Blueprint
sells software to behavioral-health organizations: clinicians run therapy sessions
through the product, and the product captures those sessions and generates clinical
notes from them. You've been handed a snapshot of the core operational data —
organizations, clinicians, sessions, and notes — and three pieces of work that mirror
what the analytics team actually does: model the data into reusable primitives,
answer a real question from a stakeholder, and build a small AI-native tool on top of
it. Scaffolding is in place so you can be productive immediately; the interesting
decisions are left to you.

## Getting Started

You'll need [Docker](https://docs.docker.com/get-docker/) (with Compose).

```bash
git clone <your-fork-url> blueprint-analytics-exercise
cd blueprint-analytics-exercise

cp .env.example .env       # then add your ANTHROPIC_API_KEY for Part 3
docker compose up --build
```

On first boot the database **migrates and seeds itself automatically** (the SQL in
`db/migrations/` and `db/seeds/` is run by Postgres on an empty data volume). When the
stack is up:

- **Client:** http://localhost:5173 — the query UI (works immediately; Part 3 shows a
  graceful "not implemented yet" state until you build the endpoint).
- **API:** http://localhost:3000 — `GET /health` returns `{ "status": "ok" }`.
- **Postgres:** `localhost:5432` (user/password/db default to `blueprint`).

Inspect the data directly any time:

```bash
docker compose exec db psql -U blueprint -d blueprint -c "\dt"
docker compose exec db psql -U blueprint -d blueprint -c "SELECT count(*) FROM sessions;"
```

To reset the database from scratch (re-run migrations + seed): `docker compose down -v`
then `docker compose up`.

The schema is defined in [`db/migrations/001_initial_schema.sql`](db/migrations/001_initial_schema.sql)
— four tables: `organizations`, `clinicians`, `sessions`, `notes`.

## The Challenge

### Part 1 — Model the data

Define **at least two dbt models** in the `dbt/models/` directory that would serve as
shared analytics primitives for the team. At minimum, produce one dimension or fact
model and one model that computes a meaningful business metric. Document your models
with descriptions and column definitions in a `schema.yml`. Be prepared to explain your
naming conventions and grain choices.

> The dbt project is pre-wired to the local Postgres — see [`dbt/README.md`](dbt/README.md)
> for how to install the adapter, connect, and run `dbt build`.

### Part 2 — Answer a business question

Our head of sales has asked:

> *"Among organizations that signed up in the last 6 months, which ones look most
> 'sticky' and which look most at risk of churning? I want to know where to focus our
> success team's attention this week."*

Produce a SQL query or dbt model that answers this question, and write a short (3–5
sentence) plain-English interpretation of what you found — as if you were sending it to
the sales team in Slack. Add your query and writeup to a file called **`ANALYSIS.md`**
in the repo root.

### Part 3 — AI-native query interface

Implement the stubbed `POST /query` endpoint in the API (`api/src/query/`) and wire it
to the frontend. The interface should accept a plain-English question about the data and
return an answer backed by a **real SQL query** against the database. The generated SQL
should be visible to the user.

> The endpoint and the React component are stubbed with `TODO`s pointing at exactly what
> to build. The Anthropic SDK (`@anthropic-ai/sdk`) is already a dependency, a connected
> Postgres pool is already injected into the service, and the client already calls the
> endpoint and renders answer / SQL / rows. You provide the implementation in between.

## Evaluation Criteria

We care less about finishing every checkbox and more about the judgment you show. We'll
be looking for:

| Area | What we're looking for |
|---|---|
| **dbt modeling** | A sensible staging → marts structure, metrics that reflect real business intent (not just raw aggregates), and a complete `schema.yml` with descriptions and a few tests. |
| **SQL quality** | Readable CTEs, an explicit and correct 6-month filter, and deliberate handling of nulls and edge cases. |
| **Business interpretation** | You define "sticky" and "at-risk" *before* building, then write an interpretation a non-technical stakeholder can actually act on. |
| **AI implementation** | A schema-aware prompt, real failure-mode handling (bad SQL, zero rows, unanswerable questions), and the generated SQL surfaced to the user. |
| **Data quality awareness** | You notice — and ideally address — irregularities in the data rather than aggregating over them blindly. |
| **Code organization** | A clean dbt project, readable SQL, and a well-structured API. |

## Time Expectations

Plan for roughly **4 hours total**. A reasonable split:

- **Part 1 — Model the data:** ~90 minutes
- **Part 2 — Answer the question:** ~60 minutes
- **Part 3 — AI query interface:** ~90 minutes

It's fine not to fully finish. We'd rather see thoughtful, well-explained work on less
than a rushed attempt at everything — capture what you'd do with more time in `NOTES.md`.

## Submission

1. **Fork** this repository and make your fork **public**.
2. Commit your work, including:
   - your dbt models and `schema.yml` under `dbt/models/`
   - **`ANALYSIS.md`** (Part 2 query + plain-English writeup)
   - your `POST /query` implementation and any frontend changes
   - **`NOTES.md`** — anything you'd do differently or build next with more time
3. Send us the link to your public fork.
