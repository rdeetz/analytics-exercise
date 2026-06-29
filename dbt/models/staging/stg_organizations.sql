-- One cleaned row per organization. Rename + cast only; no business logic.
with source as (
    select * from {{ source('blueprint', 'organizations') }}
)

select
    id              as organization_id,
    name            as organization_name,
    plan,
    status          as organization_status,
    clinician_seats,
    created_at      as signed_up_at
from source
