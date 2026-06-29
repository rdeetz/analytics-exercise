-- One cleaned row per AI-generated note (one per completed session).
with source as (
    select * from {{ source('blueprint', 'notes') }}
)

select
    id                                as note_id,
    session_id,
    organization_id,
    generation_status,
    created_at                        as note_created_at,
    word_count,
    coalesce(clinician_edited, false) as clinician_edited,

    (generation_status = 'success') as is_successful,

    -- DATA QUALITY: a successful generation should have a word count. ~10 rows
    -- violate this; flagged here rather than dropped.
    (generation_status = 'success' and word_count is null) as has_word_count_anomaly
from source
