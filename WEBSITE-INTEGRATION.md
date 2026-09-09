# WEBSITE-INTEGRATION

The existing LifeBridge website on Hostinger is a separate system. This
project does **not** modify the live website, DNS, `send.php`, or any
production file there. This document describes how the website can start
feeding enquiries into the AI OS when the owner chooses to.

## Endpoint

```text
POST https://<your-app-domain>/api/website/enquiry
Content-Type: application/json
```

## Payload

```json
{
  "name": "Dr. Lakshmi Rao",
  "email": "rao@sunrisedx.example.com",
  "phone": "+91 90000 00000",
  "company": "Sunrise Diagnostics",
  "requirement": "We need 12-channel ECG machines for 4 lab sites.",
  "source": "website"
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `name` | yes | 2–160 chars |
| `email` | yes | valid email, lowercased |
| `phone` | no | 6–25 chars, digits and `+ ( ) - . space` |
| `company` | yes | 1–200 chars |
| `requirement` | yes | 10–5000 chars |
| `source` | no | defaults to `website` |

## Response

```json
// 201 Created
{ "success": true, "data": { "received": true, "lead_id": "…", "created": true,
  "lead_score": 86, "recommended_action": "Contact within 24 hours." } }

// 400 (validation) / 413 (payload) / 429 (rate limit)
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

## Security

- **CORS**: only origins listed in `ALLOWED_ENQUIRY_ORIGINS` (comma-separated)
  or `NEXT_PUBLIC_APP_URL` receive CORS headers. No wildcard. Preflight
  (`OPTIONS`) is supported. Server-to-server calls (e.g. PHP `send.php`
  proxying) do not need CORS at all.
- **Rate limiting**: 5 requests/minute/IP (in-memory, per server instance).
- **Validation**: strict Zod schema; control characters stripped; 16 KB body
  cap; malformed JSON rejected with a safe error.
- **Abuse**: failures return generic safe messages; repeated abuse hits the
  rate limit (HTTP 429).

## Server-side processing

```text
enquiry → lead deduped by email (update) or created (new)
        → deterministic lead scoring (score + temperature + reasons)
        → website_enquiry interaction logged in the CRM timeline
        → next follow-up suggested (24 h) + audit entries
```

## Recommended migration path for the Hostinger site

1. Keep the existing form and `send.php` working exactly as today.
2. Add a server-side forwarder in `send.php` (cURL POST to this endpoint) —
   the user experience does not change, and the website keeps working if the
   OS is unreachable (fire-and-forget).
3. Later, switch the form to call the endpoint directly (same-origin via a
   small proxy, or with CORS enabled for the website origin).

Rollback: remove the forwarder; the website returns to its previous behavior.
No change to the existing website is required for the AI OS to run.
