-- Fact. Grain: one row per therapy session.
-- The atomic, reusable session record: session facts with the (1:1) note joined
-- in. Notes exist only for completed sessions, so note columns are NULL otherwise.
with sessions as (
    select * from {{ ref('stg_sessions') }}
),

notes as (
    select * from {{ ref('stg_notes') }}
)

select
    -- keys
    s.session_id,
    s.organization_id,
    s.clinician_id,
    n.note_id,

    -- session facts
    s.session_status,
    s.is_completed,
    s.started_at,
    s.started_at::date as started_date,
    s.ended_at,
    s.duration_seconds,
    s.duration_minutes,
    s.has_valid_duration,
    s.has_completion_anomaly,

    -- note facts (NULL when the session has no note)
    (n.note_id is not null)  as has_note,
    n.generation_status      as note_generation_status,
    n.is_successful          as note_is_successful,
    n.word_count             as note_word_count,
    n.clinician_edited       as note_clinician_edited,
    n.has_word_count_anomaly as note_has_word_count_anomaly
from sessions s
left join notes n on n.session_id = s.session_id
