# Statement Import — UI Flow & Security

**Status:** Planned (Wave 1 UI + API scaffold)  
**Last Updated:** June 2026  
**Related:** [import-parser-design.md](../architecture/import-parser-design.md), [data-security-compliance.md](../architecture/data-security-compliance.md)

---

## User flow (Accounts → Import)

Single-user / self-hosted instance. User adds history without Plaid first.

```
Accounts page
  └─ [Import history] button (alongside Plaid Link)
       └─ Step 1: Choose path
            • Import from files (recommended for 5–10 yr history)
            • Connect with Plaid (≤10 accounts, ~24 mo history)
       └─ Step 2: Supported formats (informational)
            • QFX / OFX — bank, credit, brokerage (best metadata)
            • CSV — broker activity exports (E*TRADE, Fidelity, Webull, …)
            • PDF — monthly statements (fallback; SoFi Invest, some banks)
       └─ Step 3: Consent checkbox (required)
            "I authorize SpendFlow to process these files containing my
             financial data. Files are encrypted and deleted after parsing."
       └─ Step 4: Upload (drag-and-drop)
            • 1–10 files per batch
            • Per-file and total size limits shown
            • Accepted: .qfx .ofx .csv .pdf
       └─ Step 5: Review detected accounts (post-parse preview)
       └─ Step 6: Confirm import → worker persists transactions
       └─ Progress / completion toast
```

**Entry points:** `/accounts/import` (primary), optional CTA on empty accounts state.

---

## Upload limits (HTTP / single instance)

Tuned for self-hosted Podman behind reverse proxy. All limits configurable via env.

| Limit | Default | Env var | Rationale |
|-------|---------|---------|-----------|
| Files per request | **10** | `IMPORT_MAX_FILES` | User uploads monthly batches; repeat for more |
| Max file size | **10 MiB** | `IMPORT_MAX_FILE_BYTES` | Large PDF statements; CSV trade files |
| Max batch size | **50 MiB** | `IMPORT_MAX_BATCH_BYTES` | Sum of all files in one request |
| Requests per hour / user | **6** | (rate limit bucket `import`) | Abuse prevention |
| Concurrent batches / user | **1** | app logic | Avoid overlapping parses |

**Reverse proxy:** set `client_max_body_size 52m` (nginx) or equivalent ≥ batch limit + overhead.

**Fastify:** `@fastify/multipart` with `limits.fileSize` and pre-check file count before read.

**Client validation:** mirror limits in UI before upload to fail fast.

---

## Supported formats (UI copy)

| Format | Extensions | Best for | Day-trade brokers |
|--------|------------|----------|-------------------|
| QFX / OFX | `.qfx`, `.ofx` | Bank, credit, some brokerage | Fidelity (QFX) |
| CSV | `.csv` | Broker activity exports | **E*TRADE, Fidelity, Webull** (Wave 1) |
| PDF | `.pdf` | Monthly statements | Fallback when no CSV |

Format is **auto-detected** after upload; user does not pick parser manually. UI shows detected format in review step.

---

## Security model (financial data)

Uploaded statements contain **Sensitive financial PII** — same classification as transactions in [data-security-compliance.md](../architecture/data-security-compliance.md).

### In transit

| Control | Implementation |
|---------|----------------|
| TLS 1.2+ | HTTPS only in production; HSTS at reverse proxy |
| Auth | `Authorization: Bearer <jwt>` on all import routes |
| No CDN caching | `Cache-Control: no-store` on upload responses |
| CORS | Existing allowlist; credentials mode |
| Request ID | Correlate audit logs without file content |

### At rest (uploaded files)

| Control | Implementation |
|---------|----------------|
| Encryption | **AES-256-GCM** per file (`ENCRYPTION_KEY`, unique IV) |
| Storage | `import_files.content_encrypted` in PostgreSQL (Phase 1) |
| Key | Same 32-byte hex key as Plaid tokens; separate salt namespace |
| Retention | **Delete encrypted blob within 24h** of successful parse; immediate on user delete |
| Parsed data | Normal transaction rows — DB volume encryption (LUKS / cloud TDE) |
| Backups | Encrypted backups must include import blobs only until TTL purge |

### Processing

| Control | Implementation |
|---------|----------------|
| Worker isolation | Parse in BullMQ worker, not API process |
| Memory | Stream to buffer max file size; no unbounded read |
| Logs | Log batch id, file count, byte size, format — **never** log file contents, account numbers, or trade details |
| Temp files | Prefer in-memory decrypt → parse; if disk needed, tmpfs + shred on exit |
| Error messages | Generic to client; details server-side only |

### Access control

| Control | Implementation |
|---------|----------------|
| User scope | Every query filtered by `user_id` |
| Audit | `audit_events`: `statement_import_upload`, `statement_import_complete`, `statement_import_delete` |
| Consent | `consent_records` row `statement_import` v1 before first batch |
| Erasure | User delete cascades `import_batches` / `import_files`; included in `DELETE /users/me` |

### Input validation

| Control | Implementation |
|---------|----------------|
| Extension allowlist | `.qfx`, `.ofx`, `.csv`, `.pdf` only |
| Content sniff | Magic bytes / OFX header / PDF `%PDF-` |
| Reject polyglots | Sniff must match extension |
| Filename | Sanitize; max 255 chars; no path segments |
| ZIP | Not accepted in v1 (zip bomb risk) |

### Compliance alignment

| Framework | Relevant control |
|-----------|------------------|
| CCPA/CPRA | Right to delete; privacy notice discloses file processing |
| GDPR | Consent + erasure + minimization (short blob retention) |
| SOC2-style | Encryption, access logs, least privilege |

---

## API summary

See [api-contract.md](api-contract.md#imports).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/imports/formats` | Supported formats + limits for UI |
| POST | `/imports/batches` | Multipart upload (`files[]`, `consentAccepted`) |
| GET | `/imports/batches/:id` | Batch status + per-file results |
| DELETE | `/imports/batches/:id` | Cancel / purge encrypted blobs |

---

## UI components

```
ui/src/app/(dashboard)/accounts/import/page.tsx
ui/src/components/import/
  import-wizard.tsx          # steps container
  format-info-panel.tsx      # QFX/OFX/CSV/PDF cards
  import-upload-zone.tsx     # drag-drop + validation
  import-batch-status.tsx    # polling progress
```

**Accounts page:** add "Import history" link next to Plaid Link.

---

## Environment variables

```bash
IMPORT_MAX_FILES=10
IMPORT_MAX_FILE_BYTES=10485760      # 10 MiB
IMPORT_MAX_BATCH_BYTES=52428800     # 50 MiB
IMPORT_BLOB_RETENTION_HOURS=24      # purge encrypted upload after parse
```

---

## Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **A** | Docs + API scaffold + encrypted upload storage + UI wizard shell |
| **B** | Parser integration (E*TRADE, Fidelity, Webull CSV) + review screen |
| **C** | Consent records table + audit events + retention cron |
| **D** | PDF plugins + Plaid merge after import |
