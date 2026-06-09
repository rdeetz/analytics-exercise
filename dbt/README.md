# dbt — Blueprint analytics

This is the dbt project you'll build your models in for **Part 1**. It's already
wired to the Postgres database that `docker compose up` starts.

## One-time setup

dbt runs from your machine (it is not containerized here). Install the Postgres
adapter into a virtualenv:

```bash
python -m venv .venv && source .venv/bin/activate
pip install dbt-postgres        # pulls in dbt-core too
```

Make sure the stack is running (`docker compose up` in the repo root) so the
database is reachable on `localhost:5432`.

## Connecting

`profiles.yml` lives in this directory, so pass `--profiles-dir .` (or export
`DBT_PROFILES_DIR=$(pwd)`). From the `dbt/` directory:

```bash
dbt debug --profiles-dir .      # should report "All checks passed!"
```

The default connection targets `localhost:5432` with the credentials from
`.env.example`. If your environment overrides them, the profile reads
`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, and `DBT_HOST` for the host.

## Building models

Put your models under `models/`. A two-layer structure is set up for you:

| Folder            | Default materialization | Intended use                                        |
|-------------------|-------------------------|-----------------------------------------------------|
| `models/staging/` | `view`                  | 1:1 cleaned views over the raw tables (rename, cast, light dedupe) |
| `models/marts/`   | `table`                 | Dimensions, facts, and business-metric models built on staging     |

```bash
dbt run  --profiles-dir .       # build everything
dbt test --profiles-dir .       # run the tests you declare in schema.yml
```

Raw source tables available in Postgres: `organizations`, `clinicians`,
`sessions`, `notes` (see `db/migrations/001_initial_schema.sql` for columns).

Document your models and columns in a `schema.yml` alongside them — descriptions,
column definitions, and at least a few tests are part of what we're looking for.
You're free to define dbt `sources` for the raw tables or select from them
directly; just be consistent and explain your choice.
