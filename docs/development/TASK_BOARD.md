# Development Task Board

**Last updated:** 2026-06-03  
**Source of truth:** [`tasks.yaml`](tasks.yaml)  
**CLI:** `npm run task -- <command>` from repo root

---

## Status summary

| Status | Count |
|--------|------:|
| done | 20 |
| ready | 0 |
| backlog | 1 |

**Statement import + GDPR export: complete.**

**Next:** iOS at P4 (`TASK-IOS-001`, `TASK-IOS-002`).

---

## Recently completed

| ID | Title |
|----|-------|
| TASK-SEC-002 | GDPR JSON data export (`GET /auth/export`) |
| TASK-IMPORT-006–008 | Import compliance, Wave 2 CSV, PDF plugins |
| TASK-IMPORT-001–005 | Full statement import pipeline |

---

## Verify

```bash
cd backend && npm run test:import   # 19 tests
cd backend && npm run test:export   # export secret scan
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/auth/export -o spendflow-export.json
```

---

## iPhone app (deferred — P4)

No active work. See tasks `TASK-IOS-001`, `TASK-IOS-002`.
