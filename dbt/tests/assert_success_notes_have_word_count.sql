-- DATA QUALITY (warn): a successful note generation should have a word count.
-- Returns the offending rows; ~10 are expected in the seed.
{{ config(severity = 'warn') }}

select note_id
from {{ ref('stg_notes') }}
where has_word_count_anomaly
