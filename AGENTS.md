# AGENTS

## Registry (spec §57)

| Agent | Status |
| --- | --- |
| Manager | ACTIVE |
| Lead | ACTIVE |
| Sales | ACTIVE |
| Follow-up | ACTIVE |
| Email | ACTIVE / DRAFT ONLY |
| Marketing, SEO, Proposal, Tender/RFP, SOP, Procurement, Customer Success, Service, Website | NOT IMPLEMENTED |

The registry lives in `src/ai/manager.ts` (`AGENT_REGISTRY`) and is surfaced
by `GET /api/agents` and the Agents page. Future agents are listed honestly —
never marked ACTIVE until implemented.

## AI Manager

`POST /api/ai` with `{ "command": "..." }` (authenticated, rate-limited):

```text
intent classification → permission check → agent selection → execution
→ agent_runs + audit log → structured response
```

Response shape:

```json
{
  "success": true,
  "data": {
    "command": "Show today's hot leads.",
    "agent": "lead",
    "status": "completed",
    "result": {},
    "recommended_actions": [],
    "approval_required": false,
    "provider": { "name": "nvidia", "configured": true, "model": "..." }
  }
}
```

Intent classification uses the configured AI provider with a deterministic
keyword fallback. Permission per task type: lead/sales/followup → `crm.read`;
email/proposal → `approvals.request`; analytics/report → `analytics.read`.

## Active agents

- **Lead Agent** — prioritizes open leads by deterministic score, suggests
  next actions, supports “hot leads”, “website leads”, “today's leads”.
- **Sales Agent** — pipeline analysis: open count, total and weighted value,
  stage distribution, opportunities needing attention (missing next action or
  past close date).
- **Follow-up Agent** — overdue/due-today detection, task creation,
  AI-drafted follow-up messages (stored as drafts, never sent).
- **Email Agent** — drafts personalized emails using APPROVED knowledge only,
  creates the draft + an `outbound_sales_email` approval request. It cannot
  send. If approved knowledge is missing it must not invent product facts.

## Adding a future agent

1. Implement the `Agent` interface (`src/ai/agents/types.ts`).
2. Register it in `ACTIVE_AGENTS` and move its entry in `AGENT_REGISTRY` to
   ACTIVE — only when it is actually implemented.
3. Map its task type to a permission in `PERMISSION_FOR_TASK`.
4. Add unit tests for routing and any deterministic logic.

## Knowledge rule

Agents must answer “Information not available in approved company knowledge.”
when facts are missing, and never fabricate product specifications,
certifications, warranties, prices, customer history, product capabilities,
regulatory claims, or medical claims (see KNOWLEDGE.md).
