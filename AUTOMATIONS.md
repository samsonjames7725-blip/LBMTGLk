# AUTOMATIONS

## Principles (spec §60/§101)

Automations perform **internal actions only**: create tasks, create drafts,
create alerts, update internal records. They never send external
communications and never bypass the approval workflow.

## Jobs

| Job | Recommended schedule | What it does |
| --- | --- | --- |
| `lead-qualification` | hourly (Vercel Pro) / daily on Hobby — **active** | Scores unscored `new` leads with the deterministic scorer, flags hot leads, creates "contact hot lead" tasks. |
| `overdue-followups` | every 30 min (Pro) / daily on Hobby — **active** | Flags pending follow-ups past their schedule as `overdue`. |
| `pipeline-monitoring` | daily 06:00 UTC — requires Pro cron or external scheduler | Finds open opportunities with no next action or past-due close dates; creates review tasks. |
| `daily-report` | daily 02:00 UTC — requires Pro cron or external scheduler | Composes the internal management report from live KPIs; stored in `automation_runs.result`. Never sent externally. |
| `customer-reactivation` | weekly (Mon 03:00 UTC) — requires Pro cron or external scheduler | Finds active customers with no updates for 6+ months; creates reactivation check-in tasks. |

> **Hosting-plan note:** Vercel's Hobby (free) plan allows only 2 cron jobs, each
> running at most once per day — `vercel.json` therefore schedules
> `lead-qualification` and `overdue-followups` daily. Upgrading to Pro unlocks
> the original schedules for all five jobs (just extend the `crons` array).
> All five endpoints exist regardless of plan and can also be triggered by any
> external scheduler with the `CRON_SECRET` bearer token.

## Invocation & protection

```text
Vercel Cron → GET/POST /api/cron/<job>   (Authorization: Bearer $CRON_SECRET)
```

- Requests without the correct `CRON_SECRET` get 401.
- Unknown job names get 404.
- Every execution writes an `automation_runs` row (`running` → `success` |
  `failed`) plus an audit entry, visible on the Settings page.

## Extending

1. Implement `runX()` in `src/services/automation/jobs.ts`.
2. Add the job name to `AUTOMATION_JOBS`.
3. Add the schedule to `vercel.json` (Vercel cron) or call the endpoint from
   any scheduler with the bearer secret.

Local/other schedulers work the same way — the endpoint is the only entry
point, so the platform stays Vercel-Cron-compatible without lock-in.
