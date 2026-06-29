-- Dimension. Grain: one row per organization.
-- Org attributes plus derived tenure / signup-cohort fields used across analyses.
with organizations as (
    select * from {{ ref('stg_organizations') }}
)

select
    organization_id,
    organization_name,
    plan,
    organization_status,
    (organization_status = 'active') as is_active,
    clinician_seats,
    signed_up_at,

    -- Cohort + tenure for slicing acquisition and maturity.
    date_trunc('month', signed_up_at)::date as signup_cohort_month,
    (current_date - signed_up_at::date)     as tenure_days,

    -- Sales' "signed up in the last 6 months" cohort (see Part 2).
    (signed_up_at >= now() - interval '6 months') as is_recent_signup
from organizations
