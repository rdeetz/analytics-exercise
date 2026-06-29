-- One cleaned row per clinician, with activation flags surfaced.
with source as (
    select * from {{ source('blueprint', 'clinicians') }}
)

select
    id              as clinician_id,
    organization_id,
    status          as clinician_status,
    created_at      as signed_up_at,
    activated_at,

    -- A clinician counts as activated only once an activation timestamp exists.
    (activated_at is not null) as is_activated,

    -- DATA QUALITY: marked 'active' but never activated. Contradictory; flagged
    -- here rather than dropped so downstream models can decide how to treat it.
    (status = 'active' and activated_at is null) as has_activation_conflict
from source
