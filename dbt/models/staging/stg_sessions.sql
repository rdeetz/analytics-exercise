-- One cleaned row per therapy session, with duration-quality flags surfaced.
with source as (
    select * from {{ source('blueprint', 'sessions') }}
)

select
    id              as session_id,
    clinician_id,
    organization_id,
    status          as session_status,
    started_at,
    ended_at,
    duration_seconds,

    (status = 'completed') as is_completed,

    -- A duration is usable only when present and positive.
    (duration_seconds is not null and duration_seconds > 0) as has_valid_duration,

    -- DATA QUALITY: completed sessions should have an end time and duration.
    -- ~98 rows violate this; flagged (not dropped) and excluded from duration
    -- averages downstream.
    (status = 'completed' and (ended_at is null or duration_seconds is null))
        as has_completion_anomaly,

    -- Expose minutes only when the duration is trustworthy; NULL otherwise so it
    -- never silently skews an average.
    case
        when duration_seconds is not null and duration_seconds > 0
            then round(duration_seconds / 60.0, 1)
    end as duration_minutes
from source
