-- Business-metric model. Grain: one row per organization.
--
-- Engagement / stickiness primitives the success and sales teams can reuse —
-- adoption, recent usage momentum, recency, and output quality — rather than raw
-- aggregates. Recency windows are anchored to now() (the seed places data ending
-- ~3 days before load time, so now() is the natural "as of" reference).
with organizations as (
    select * from {{ ref('dim_organizations') }}
),

clinicians as (
    select * from {{ ref('stg_clinicians') }}
),

sessions as (
    select * from {{ ref('fct_sessions') }}
),

clinician_rollup as (
    select
        organization_id,
        count(*)                                            as total_clinicians,
        count(*) filter (where is_activated)                as activated_clinicians,
        count(*) filter (where clinician_status = 'active') as active_clinicians
    from clinicians
    group by 1
),

activity_rollup as (
    select
        organization_id,

        -- volume & quality
        count(*)                                             as total_sessions,
        count(*) filter (where is_completed)                 as completed_sessions,
        count(*) filter (where session_status = 'abandoned') as abandoned_sessions,
        max(started_date)                                    as last_session_date,
        -- average only over sessions with a trustworthy duration
        round(avg(duration_minutes) filter (where has_valid_duration), 1)
            as avg_session_duration_minutes,

        -- recent usage & momentum (trailing 30d vs the prior 30d)
        count(*) filter (where started_at >= now() - interval '30 days')
            as sessions_last_30d,
        count(*) filter (
            where started_at >= now() - interval '60 days'
              and started_at <  now() - interval '30 days'
        )   as sessions_prev_30d,
        count(distinct clinician_id) filter (where started_at >= now() - interval '30 days')
            as active_clinicians_last_30d,

        -- note (AI output) quality
        count(*) filter (where has_note)            as notes_total,
        count(*) filter (where note_is_successful)  as notes_succeeded,
        count(*) filter (where note_clinician_edited) as notes_edited
    from sessions
    group by 1
)

select
    -- identity
    o.organization_id,
    o.organization_name,
    o.plan,
    o.organization_status,
    o.is_active,
    o.signed_up_at,
    o.tenure_days,
    o.is_recent_signup,
    o.clinician_seats,

    -- clinician adoption
    coalesce(c.total_clinicians, 0)     as total_clinicians,
    coalesce(c.activated_clinicians, 0) as activated_clinicians,
    coalesce(c.active_clinicians, 0)    as active_clinicians,
    round(c.activated_clinicians::numeric / nullif(c.total_clinicians, 0), 3)
        as activation_rate,
    round(c.active_clinicians::numeric / nullif(o.clinician_seats, 0), 3)
        as seat_utilization,

    -- session volume & quality
    coalesce(a.total_sessions, 0)     as total_sessions,
    coalesce(a.completed_sessions, 0) as completed_sessions,
    coalesce(a.abandoned_sessions, 0) as abandoned_sessions,
    round(a.completed_sessions::numeric / nullif(a.total_sessions, 0), 3)
        as completion_rate,
    a.avg_session_duration_minutes,

    -- recent engagement & momentum
    coalesce(a.sessions_last_30d, 0)          as sessions_last_30d,
    coalesce(a.sessions_prev_30d, 0)          as sessions_prev_30d,
    round((a.sessions_last_30d - a.sessions_prev_30d)::numeric
          / nullif(a.sessions_prev_30d, 0), 3) as session_trend_pct,
    coalesce(a.active_clinicians_last_30d, 0) as active_clinicians_last_30d,
    round(a.sessions_last_30d::numeric / nullif(a.active_clinicians_last_30d, 0), 2)
        as sessions_per_active_clinician_last_30d,
    a.last_session_date,
    (current_date - a.last_session_date) as days_since_last_session,

    -- note (AI output) quality
    coalesce(a.notes_total, 0) as notes_total,
    round(a.notes_succeeded::numeric / nullif(a.notes_total, 0), 3)
        as note_success_rate,
    round(a.notes_edited::numeric / nullif(a.notes_succeeded, 0), 3)
        as clinician_edit_rate
from organizations o
left join clinician_rollup c on c.organization_id = o.organization_id
left join activity_rollup  a on a.organization_id = o.organization_id
