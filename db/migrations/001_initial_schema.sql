-- Blueprint analytics work simulation — initial schema
--
-- Four tables model the core of Blueprint's product:
--   organizations -> clinicians -> sessions -> notes
--
-- This file runs automatically on first `docker compose up` (it is mounted into
-- the Postgres init directory). It is intentionally plain DDL so candidates can
-- read the schema directly and feed it to their NL-to-SQL prompt in Part 3.

-- Organizations using Blueprint
CREATE TABLE organizations (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  plan            VARCHAR(50) NOT NULL,         -- 'starter', 'growth', 'enterprise'
  status          VARCHAR(50) NOT NULL,         -- 'active', 'churned', 'suspended'
  clinician_seats INTEGER NOT NULL
);

-- Clinicians (belong to an org)
CREATE TABLE clinicians (
  id              SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id),
  created_at      TIMESTAMPTZ NOT NULL,
  activated_at    TIMESTAMPTZ,                  -- NULL if they signed up but never activated
  status          VARCHAR(50) NOT NULL          -- 'active', 'inactive', 'deactivated'
);

-- Therapy sessions captured by Blueprint
CREATE TABLE sessions (
  id               SERIAL PRIMARY KEY,
  clinician_id     INTEGER REFERENCES clinicians(id),
  organization_id  INTEGER REFERENCES organizations(id),
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,                 -- NULL if session was abandoned
  duration_seconds INTEGER,                     -- NULL if abandoned
  status           VARCHAR(50) NOT NULL         -- 'completed', 'abandoned', 'processing'
);

-- AI-generated clinical notes from sessions
CREATE TABLE notes (
  id                SERIAL PRIMARY KEY,
  session_id        INTEGER REFERENCES sessions(id),
  organization_id   INTEGER REFERENCES organizations(id),
  created_at        TIMESTAMPTZ NOT NULL,
  generation_status VARCHAR(50) NOT NULL,       -- 'success', 'failed', 'pending'
  word_count        INTEGER,                    -- NULL if generation failed
  clinician_edited  BOOLEAN DEFAULT false
);

-- Helpful indexes for the kinds of rollups this exercise invites.
CREATE INDEX idx_clinicians_org      ON clinicians (organization_id);
CREATE INDEX idx_sessions_org        ON sessions (organization_id);
CREATE INDEX idx_sessions_clinician  ON sessions (clinician_id);
CREATE INDEX idx_sessions_started_at ON sessions (started_at);
CREATE INDEX idx_notes_session       ON notes (session_id);
CREATE INDEX idx_notes_org           ON notes (organization_id);
