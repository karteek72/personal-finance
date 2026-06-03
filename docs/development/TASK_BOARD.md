# Development Task Board

**Last updated:** 2026-06-03  
**Source of truth:** [`tasks.yaml`](tasks.yaml)  
**CLI:** `npm run task -- <command>` from repo root (uses backend `tsx`; no root `npm install` needed)

---

## Status summary

| Status | Count |
|--------|------:|
| done | 11 |
| backlog | 3 |
| ready | 0 |

**Phase 3.5 preview→live complete.** Next: Phase 4 iOS + GDPR export.

---

## Recently completed ✅ (P2)

| ID | Title |
|----|-------|
| TASK-PREVIEW-001 | Budgets from transaction aggregates + suggested limits |
| TASK-PREVIEW-002 | Recurring charge detector (≥3 monthly pattern) |
| TASK-PREVIEW-003 | Wellness score computed from live data |
| TASK-PREVIEW-004 | Coach `POST /coach/ask` rule-based Q&A |

---

## Next up (backlog)

| ID | Priority | Area | Title |
|----|----------|------|-------|
| TASK-IOS-001 | P3 | ios | Face ID app unlock |
| TASK-IOS-002 | P3 | ios | APNs push for alerts |
| TASK-SEC-002 | P3 | backend | GDPR JSON data export |

Claim: `npm run task -- claim TASK-IOS-001 your-agent-name`
