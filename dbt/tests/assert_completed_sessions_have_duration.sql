-- DATA QUALITY (warn): completed sessions should have an end time and duration.
-- Returns the offending rows; ~98 are expected in the seed.
{{ config(severity = 'warn') }}

select session_id
from {{ ref('stg_sessions') }}
where has_completion_anomaly
