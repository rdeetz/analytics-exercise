# Part 1 — dbt Models Design

**Goal:** Model Blueprint's core operational data (organizations → clinicians →
sessions → notes) into reusable analytics primitives: a clean staging layer, a
dimension, an atomic fact, and an org-level business-metric model. Document and
test everything in `schema.yml`.

## Data profile (from the live seed)

- 40 orgs, 218 clinicians, 1,965 sessions, 1,751 notes.
- **Notes are 1:1 with completed sessions** — every completed session has exactly
  one note; abandoned/processing sessions have none. No multi-note sessions.
- Referential integrity is clean: no orphan FKs, no org mismatches across the chain.
- Durations are all 1,200–3,600s (no zero/negative).
- 27 of 40 orgs signed up in the last 6 months.

### Data-quality irregularities (surface, don't hide)

| Issue | Count | Decision |
|---|---|---|
| `completed` sessions with NULL `ended_at`/`duration_seconds` | 98 | Flag `has_completion_anomaly`; exclude from duration averages |
| `success` notes with NULL `word_count` | 10 | Flag `has_word_count_anomaly` |
| Clinicians with NULL `activated_at` while `status = 'active'` | 30 | Flag `has_activation_conflict` |

Strategy: **flag + test, never drop.** Keep every row; add boolean flags in
staging; compute rate/average metrics over valid rows only; add singular dbt
tests at `severity: warn` so the anomalies are visible without failing builds.

## Layering

`raw Postgres` → dbt **sources** → **staging/** (views) → **marts/** (tables).
Marts read only from staging; staging reads only from sources. Sources are
declared explicitly (`_sources.yml`) rather than selecting from raw tables
directly, so lineage is complete and source-level tests have a home.

## Models

### Staging (views, schema `staging`) — rename/cast + DQ flags, no row drops
- `stg_organizations` — ids renamed, `created_at` → `signed_up_at`, plan/status/seats.
- `stg_clinicians` — `is_activated`, `has_activation_conflict` (active but never activated).
- `stg_sessions` — `is_completed`, `has_valid_duration`, `has_completion_anomaly`,
  `duration_minutes` (only when valid, else NULL).
- `stg_notes` — `is_successful`, `has_word_count_anomaly`.

### Marts (tables, schema `marts`)
- **`dim_organizations`** — *grain: one row per organization.* Attributes plus
  `signup_cohort_month`, `tenure_days`, `is_recent_signup` (signed up ≤ 6 months ago).
- **`fct_sessions`** — *grain: one row per session.* The atomic reusable fact:
  session columns + the 1:1 note joined in (note_id, generation_status, word_count,
  clinician_edited, note_success). DQ flags carried forward.
- **`org_engagement_metrics`** — *grain: one row per organization.* The
  business-metric model. Engagement/stickiness primitives, not raw counts:
  `activation_rate`, `seat_utilization`, `completion_rate`, `sessions_last_30d`
  vs `sessions_prev_30d` → `session_trend_pct` (momentum), `days_since_last_session`
  (recency), `active_clinicians_last_30d`, `sessions_per_active_clinician_last_30d`,
  `avg_session_duration_minutes` (valid rows only), `note_success_rate`,
  `clinician_edit_rate`.

## Naming & grain conventions

- `stg_<source_entity>` — source-shaped, one view per raw table.
- `dim_` / `fct_` by Kimball role; metric mart named for subject + purpose.
- Every model's `description` states its grain explicitly.
- `*_at` = timestamp, `*_date` = date, `is_*`/`has_*` = boolean, `*_rate`/`*_pct` = ratio.

## Tests (in `schema.yml` + `tests/`)

- Generic (error): `unique` + `not_null` on every PK; `accepted_values` on plan and
  the three status columns; `relationships` from `fct_sessions.organization_id`
  → `dim_organizations.organization_id`.
- Singular (`severity: warn`): completed-sessions-have-duration,
  success-notes-have-word-count, active-clinicians-are-activated.

## Validation

Stack is already up. Run `dbt run` + `dbt test` against the live DB; confirm the
three warn-tests fire with the expected row counts (98 / 10 / 30) and everything
else passes.
