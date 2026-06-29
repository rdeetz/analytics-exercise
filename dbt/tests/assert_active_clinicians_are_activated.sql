-- DATA QUALITY (warn): a clinician in 'active' status should have activated.
-- Returns the offending rows; ~30 are expected in the seed.
{{ config(severity = 'warn') }}

select clinician_id
from {{ ref('stg_clinicians') }}
where has_activation_conflict
