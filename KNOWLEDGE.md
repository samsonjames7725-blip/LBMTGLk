# KNOWLEDGE

## Data model

- `knowledge_documents` — metadata: filename, category, storage path,
  uploader, approval status (`pending` | `approved` | `rejected`).
- `knowledge_chunks` — ordered text chunks with a generated `tsvector`
  (`search`) column and GIN index for full-text retrieval.

Categories: `company_profile`, `products`, `product_specifications`,
`services`, `certifications`, `warranty`, `previous_proposals`, `sops`, `faqs`.

## Storage

Uploads go to the private `company-knowledge` Supabase Storage bucket (20 MB
cap; PDF, DOCX, XLSX, TXT, MD). Buckets are private; access requires an
authenticated, provisioned user via storage policies.

## Lifecycle

```text
Upload (knowledge.manage permission)
        ↓  status: pending
Human review (Knowledge page, knowledge.manage)
        ↓  approve                ↓ reject
Text files chunked (~900 chars, overlap) into knowledge_chunks
        ↓
ACTIVE AI KNOWLEDGE
```

Only **approved** documents are visible to production AI. RLS hides pending
documents from non-admins; the email agent additionally filters retrieval
results to approved documents.

## AI safety rules (spec §43)

If information is unavailable in approved knowledge, AI output must say:

```text
Information not available in approved company knowledge.
```

The AI never fabricates: product specifications, certifications, warranties,
prices, customer history, product capabilities, regulatory claims, or medical
claims. System prompts for all agents encode this rule.

## Retrieval

`knowledgeRepository.searchChunks(query)` performs full-text search over
chunks. The email agent uses it to ground drafts; future RAG features (vector
embeddings via `AIProvider.embed`) can be added without schema changes —
`GEMINI_EMBEDDING_MODEL` is already part of the model registry.
