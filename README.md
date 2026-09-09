# LifeBridge MedTech — AI Business Operating System

> Repository: `samsonjames7725-blip/LBMTGLk` (the only target repository).
> Supabase project: `ghvjdybgllufjtdurbvh` (existing — never recreated).

Production-oriented business OS for LifeBridge MedTech: CRM, lead management,
sales pipeline, follow-ups, email drafting (human-approved), AI agents with a
mandatory human approval workflow, company knowledge, analytics, tasks,
automations, RBAC, audit logging — on **Next.js + Supabase (PostgreSQL/Auth/
Storage/RLS) + Vercel**.

## AI engines

Provider-based architecture with an honest degradation path:

1. **NVIDIA** (primary per master spec) — `NVIDIA_API_KEY` + `NVIDIA_MODEL`
2. **Google Gemini** (secondary) — `GEMINI_API_KEY` (+ optional model overrides)
3. **Deterministic stub** — used when neither is configured; every output is
   clearly marked `[AI Provider: NOT CONFIGURED]` and structured output
   refuses to fabricate data.

## Status (implemented vs planned — no fake integrations)

| Capability | Status |
| --- | --- |
| CRM (leads, companies, contacts, customers, opportunities, interactions, tasks, follow-ups) | Implemented |
| Auth (Supabase) + RBAC (6 roles) + server-side authorization | Implemented |
| Approval workflow (7 protected action types) + audit logging | Implemented |
| AI Manager + Lead/Sales/Follow-up/Email agents (draft-only) | Implemented |
| Knowledge system (upload → approval → chunking → retrieval) | Implemented |
| Website enquiry API (validated, rate-limited, CORS-restricted) | Implemented |
| Automations + Vercel cron architecture | Implemented |
| Database schema (21 tables, RLS, storage buckets) | Verified offline (34/34 checks); remote push pending CLI login |
| External email/WhatsApp sending | **NOT IMPLEMENTED** — DRAFT_ONLY mode |
| Marketing/SEO/Proposal/Tender/SOP/Procurement/Customer-Success/Service/Website agents | **NOT IMPLEMENTED** |
| Vercel deployment | **NOT VERIFIED** |

## Repository layout

```text
src/app/            Next.js App Router: pages + REST API route handlers
src/ai/             AI provider abstraction + Manager + agents
src/auth/           Session resolution and role→permission matrix
src/repositories/   Repository interfaces + Supabase implementations
src/services/       Business services (leads, approvals, knowledge, analytics, automations)
src/security/       HTTP envelope, rate limiting, CORS
src/validators/     Zod schemas for every API input
src/supabase/       Server admin client, browser client, cookie auth client
src/components/     Layout and UI primitives
supabase/           config.toml, migrations (source of truth), schema.sql, seed.sql
tests/unit/         Unit tests (vitest)
tests/db-harness/   Offline migration verification (embedded PostgreSQL, 34 checks)
legacy-marketing-os/  Previous Express/MySQL marketing OS (preserved, not part of the AI OS)
```

## Setup

```bash
npm install
cp .env.example .env.local   # fill values; never commit .env*
npm run db:verify            # offline migration + RLS verification
npm test                     # unit tests
npm run dev                  # http://localhost:3000
```

See SETUP.md for first-run provisioning, DATABASE.md for the migration and
RLS model, and DEPLOYMENT.md for Vercel.

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Compliance & safety rules baked in

- The AI assists; humans approve. Protected actions always go through the
  approval workflow; the AI cannot grant itself permissions.
- The AI uses only approved company knowledge and answers “Information not
  available in approved company knowledge.” instead of fabricating specs,
  certifications, prices, or medical/claims data.
- Nothing external (email, WhatsApp, reports) is ever sent automatically.
- Unconfigured integrations display NOT CONFIGURED / NOT IMPLEMENTED /
  NOT VERIFIED — never a fake success state.
