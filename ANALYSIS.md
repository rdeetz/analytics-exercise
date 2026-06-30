# Part 2 — Stickiness & churn risk (last-6-month signups)

> **Head of sales:** *"Among organizations that signed up in the last 6 months,
> which ones look most 'sticky' and which look most at risk of churning? I want
> to know where to focus our success team's attention this week."*

The cohort is **27 organizations** (all currently `active`). The query below reads
the Part 1 primitive `org_engagement_metrics`, scores each org, and segments them.

---

## 📣 For the sales team (Slack)

> **Sticky vs. at-risk — our last-6-months cohort (27 orgs)**
>
> Good news first: most of this cohort is healthy. ~14 orgs are **sticky** —
> clinicians using Blueprint weekly, adoption spread across most of their seats,
> and usage flat-or-growing — led by **Northstar, Willow Creek, Harbor Point,
> Cedar, Lakeside, and Riverbend**. These are leave-alone / expansion candidates.
>
> The concern is a cluster of **9 orgs flashing clear churn signals**: their
> session volume has fallen **~80–90% versus the prior month** and they've **gone
> quiet for 2–3 weeks**, with only a couple of seats still active. The five most
> urgent are **Meadowlark, Evergreen, Stonebridge, Fairview, and Sunset Ridge** —
> each down to ~1–2 sessions in the last 30 days and barely engaging with the
> generated notes. Separately, **Lighthouse Recovery Center** signed up two months
> ago and has **never run a single session** — that's an onboarding rescue, not a
> churn save.
>
> **Where to focus this week:** start outreach with those six (the five fading
> orgs + Lighthouse's onboarding), then work down the at-risk list below.

---

## How I defined "sticky" vs. "at-risk" (before scoring)

A behavioral-health org is **sticky** when Blueprint is becoming embedded in the
team's routine: clinicians keep showing up (**recent** activity), usage is **broad**
across their seats rather than riding on one champion, it's **stable or growing**,
and clinicians **engage with the output** (editing the AI notes). **At-risk** is the
inverse — early disengagement: usage **dropping sharply** month-over-month, the org
**gone quiet**, **shallow** adoption, or — worst — **never started at all**.

I score each org 0–100 from four equally-weighted, normalized signals (all from
`org_engagement_metrics`). The first two are *leading churn indicators*; the last
two measure *how embedded* the product is:

| Signal (weight) | Metric | Why |
|---|---|---|
| **Recency** (25%) | `days_since_last_session` (inverted) | Silence is the most direct churn precursor. |
| **Momentum** (25%) | `session_trend_pct` (last 30d vs prior 30d) | A falling trend leads churn; direction matters more than level. |
| **Adoption breadth** (25%) | `active_clinicians_last_30d / clinician_seats` | One-champion orgs churn when the champion leaves. |
| **Engagement depth** (25%) | `clinician_edit_rate` | Editing AI notes = trusting and using the output. |

Scores are bucketed **Sticky (≥66) / Steady (41–65) / At-risk (≤40)**; the gap in
the data between the two clusters is wide (lowest Steady = 59, highest At-risk = 25),
so the at-risk shortlist is insensitive to the exact cutoff.

On top of the score, each org carries **independent reason flags** so the success
team knows *what* to act on: `never-activated`, `gone-quiet` (>10 days silent),
`declining` (≤ −40% MoM), `shallow-adoption` (<34% of seats active), `low-engagement`
(edit rate <20%).

**Edge cases handled deliberately:**
- **Never-activated orgs** (Lighthouse: 0 sessions ever) have NULL usage metrics.
  They are scored 0 and forced to **At-risk**, and excluded from the normalization
  bounds so a single outlier can't distort everyone else's scores.
- **No prior-month baseline** (`session_trend_pct` NULL) is treated as *neutral*
  momentum, not as decline — a brand-new ramping org isn't punished for lacking history.
- Data-quality flags from Part 1 are respected upstream (e.g. the ~98 completed
  sessions with no duration are excluded from `avg_session_duration_minutes`).

---

## The query

```sql
-- Stickiness / churn-risk among orgs that signed up in the last 6 months.
-- Reads the reusable Part 1 primitive (org_engagement_metrics) and segments the cohort.
with cohort as (
    select *
    from analytics_marts.org_engagement_metrics
    where is_recent_signup                       -- signed up within the last 6 months
),

prepared as (
    select
        organization_id,
        organization_name,
        plan,
        clinician_seats,
        sessions_last_30d,
        sessions_prev_30d,
        active_clinicians_last_30d,
        -- never-started orgs have no "last session": treat their whole tenure as quiet
        coalesce(days_since_last_session, tenure_days)                             as days_quiet,
        -- no prior-month baseline (brand new or never-started) -> neutral momentum
        coalesce(session_trend_pct, 0)                                            as trend,
        -- breadth of adoption: share of contracted seats actively used recently
        round(active_clinicians_last_30d::numeric / nullif(clinician_seats, 0), 3) as recent_seat_util,
        coalesce(clinician_edit_rate, 0)                                          as edit_rate,
        (sessions_last_30d = 0 and sessions_prev_30d = 0)                         as never_activated
    from cohort
),

-- Normalize each signal 0..1 across orgs that have ANY activity, so a single
-- never-activated outlier can't distort the scale for everyone else.
bounds as (
    select
        min(days_quiet) min_q, max(days_quiet) max_q,
        min(trend) min_t,      max(trend) max_t,
        min(recent_seat_util) min_u, max(recent_seat_util) max_u,
        min(edit_rate) min_e,  max(edit_rate) max_e
    from prepared
    where not never_activated
),

scored as (
    select
        p.*,
        1 - (p.days_quiet - b.min_q)::numeric / nullif(b.max_q - b.min_q, 0)   as s_recency,   -- fewer quiet days = better
        (p.trend - b.min_t)::numeric / nullif(b.max_t - b.min_t, 0)            as s_momentum,
        (p.recent_seat_util - b.min_u)::numeric / nullif(b.max_u - b.min_u, 0) as s_breadth,
        (p.edit_rate - b.min_e)::numeric / nullif(b.max_e - b.min_e, 0)        as s_depth
    from prepared p
    cross join bounds b
),

final as (
    select
        *,
        case when never_activated then 0
        else round(100 * (
              0.25 * least(greatest(s_recency, 0), 1)
            + 0.25 * least(greatest(s_momentum, 0), 1)
            + 0.25 * least(greatest(s_breadth, 0), 1)
            + 0.25 * least(greatest(s_depth, 0), 1)
        )) end as health_score
    from scored
)

select
    organization_name,
    plan,
    health_score,
    case
        when never_activated    then 'At-risk'
        when health_score >= 66 then 'Sticky'
        when health_score <= 40 then 'At-risk'
        else 'Steady'
    end as segment,
    sessions_last_30d  as s30,
    sessions_prev_30d  as sp30,
    trend              as trend_pct,
    days_quiet,
    recent_seat_util,
    edit_rate,
    -- actionable reasons for the success team
    never_activated                                   as f_never_activated,
    (not never_activated and days_quiet > 10)         as f_gone_quiet,
    (trend <= -0.4)                                   as f_declining,
    (not never_activated and recent_seat_util < 0.34) as f_shallow_adoption,
    (not never_activated and edit_rate < 0.20)        as f_low_engagement
from final
order by health_score desc, organization_name;
```

> Depends on the Part 1 models being built (`dbt build` in `dbt/`). Recency windows
> are anchored to `now()`; re-seed (`docker compose down -v && docker compose up`) for
> a fresh, correctly-anchored dataset.

---

## Results (27 orgs)

Flags: **NA** never-activated · **Q** gone-quiet · **D** declining · **S** shallow-adoption · **L** low-engagement

| Org | Plan | Score | Segment | 30d / prior | Trend | Days quiet | Seat use (30d) | Edit rate | Flags |
|---|---|--:|---|--:|--:|--:|--:|--:|---|
| Northstar Family Therapy | growth | 87 | **Sticky** | 31 / 31 | 0% | 5 | 100% | 0.65 | — |
| Willow Creek Counseling | starter | 86 | **Sticky** | 26 / 24 | +8% | 4 | 75% | 0.74 | — |
| Harbor Point Therapy | growth | 85 | **Sticky** | 22 / 22 | 0% | 5 | 89% | 0.69 | — |
| Cedar Behavioral Health | enterprise | 84 | **Sticky** | 21 / 20 | +5% | 3 | 75% | 0.68 | — |
| Lakeside Behavioral Partners | enterprise | 81 | **Sticky** | 31 / 29 | +7% | 3 | 60% | 0.69 | — |
| Riverbend Counseling Group | growth | 81 | **Sticky** | 32 / 28 | +14% | 5 | 62% | 0.70 | — |
| Summit Mental Wellness | enterprise | 79 | **Sticky** | 25 / 28 | −11% | 7 | 78% | 0.72 | — |
| Maple Grove Psychology | growth | 78 | **Sticky** | 32 / 32 | 0% | 4 | 58% | 0.71 | — |
| Silverlake Counseling | growth | 76 | **Sticky** | 10 / 8 | +25% | 4 | 67% | 0.46 | — |
| Oakmont Behavioral | starter | 72 | **Sticky** | 11 / 14 | −21% | 3 | 100% | 0.29 | — |
| Hawthorne Clinical | growth | 71 | **Sticky** | 13 / 14 | −7% | 3 | 67% | 0.43 | — |
| Greenfield Mental Health | enterprise | 69 | **Sticky** | 7 / 5 | +40% | 5 | 40% | 0.42 | — |
| Birchwood Behavioral Health | growth | 68 | **Sticky** | 9 / 11 | −18% | 3 | 63% | 0.44 | — |
| Clearwater Counseling | starter | 67 | **Sticky** | 9 / 8 | +13% | 4 | 33% | 0.52 | S |
| Driftwood Therapy | growth | 65 | Steady | 4 / 3 | +33% | 3 | 33% | 0.32 | S |
| Rockport Wellness Group | starter | 65 | Steady | 6 / 8 | −25% | 5 | 57% | 0.50 | — |
| Hillside Psychology Group | starter | 61 | Steady | 8 / 12 | −33% | 6 | 50% | 0.53 | — |
| Aspen Hill Therapy | growth | 59 | Steady | 15 / 20 | −25% | 4 | 50% | 0.38 | — |
| Pinecrest Psychiatry | growth | 25 | **At-risk** | 3 / 19 | −84% | 11 | 30% | 0.13 | Q D S L |
| Brightpath Clinical Services | growth | 23 | **At-risk** | 2 / 22 | −91% | 14 | 18% | 0.30 | Q D S |
| Crossroads Therapy Center | growth | 21 | **At-risk** | 4 / 27 | −85% | 14 | 18% | 0.22 | Q D S |
| Sunset Ridge Therapy | starter | 21 | **At-risk** | 2 / 11 | −82% | 13 | 17% | 0.19 | Q D S L |
| Fairview Counseling Co | starter | 12 | **At-risk** | 1 / 13 | −92% | 14 | 13% | 0.06 | Q D S L |
| Stonebridge Wellness | starter | 8 | **At-risk** | 2 / 10 | −80% | 23 | 10% | 0.21 | Q D S |
| Evergreen Mind Health | starter | 7 | **At-risk** | 1 / 10 | −90% | 20 | 10% | 0.12 | Q D S L |
| Meadowlark Behavioral | growth | 6 | **At-risk** | 2 / 11 | −82% | 22 | 20% | 0.05 | Q D S L |
| Lighthouse Recovery Center | starter | 0 | **At-risk** | 0 / 0 | — | 61 | 0% | — | NA |

**Read:** 14 sticky, 4 steady, 9 at-risk. The at-risk cluster is unambiguous — all
nine combine a steep MoM drop with multi-week silence and shallow seat usage — and is
cleanly separated from the rest of the cohort (next-lowest score is 59). Lighthouse is
a distinct *onboarding* failure rather than a *churn* one.
