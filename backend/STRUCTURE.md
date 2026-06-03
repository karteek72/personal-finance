# Backend Folder Structure (Planned)

Target layout for Phase 1 scaffolding. Do not create files outside this structure without updating this doc.

```
backend/
├── README.md
├── STRUCTURE.md
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── .env.example
├── drizzle/                      # SQL migrations (generated)
├── src/
│   ├── index.ts                  # Fastify server entry
│   ├── worker.ts                 # BullMQ worker entry
│   ├── config/
│   │   └── env.ts                # Zod-validated environment
│   ├── db/
│   │   ├── client.ts             # Drizzle instance
│   │   └── schema/               # Table definitions
│   │       ├── users.ts
│   │       ├── plaid-items.ts
│   │       ├── accounts.ts
│   │       └── transactions.ts
│   ├── plugins/
│   │   ├── error-handler.ts      # AppError → JSON + logging
│   │   └── request-context.ts    # Request ID + completion logs
│   ├── routes/
│   │   ├── health.ts
│   │   ├── auth/
│   │   ├── plaid/
│   │   ├── transactions/
│   │   ├── insights/
│   │   └── webhooks/
│   │       └── plaid.ts
│   ├── services/
│   │   ├── plaid/
│   │   │   ├── client.ts
│   │   │   ├── link-token.ts
│   │   │   └── sync-transactions.ts
│   │   ├── reconciliation/
│   │   │   ├── classify.ts
│   │   │   └── match-pairs.ts
│   │   └── categorize/
│   │       ├── rules.ts
│   │       └── pipeline.ts
│   ├── jobs/
│   │   ├── queue.ts              # BullMQ setup
│   │   └── sync-transactions.job.ts
│   ├── lib/
│   │   ├── errors.ts             # AppError + api-contract error shape
│   │   ├── logger.ts             # Pino root + module child loggers
│   │   ├── validate.ts           # Zod body helpers
│   │   └── auth-http.ts
│   └── types/
│       └── index.ts              # Shared domain types
└── tests/                        # Vitest (when added)
    ├── services/
    └── routes/
```

## Conventions

- **ESM modules** — `"type": "module"` in package.json; import with `.js` extensions
- **Routes are thin** — validate input (Zod) → call service → map response
- **Services own business logic** — no SQL in route handlers
- **One queue job per file** in `jobs/`
- **Never log secrets** — redact tokens and PII in structured logs

## API route prefix

All routes mounted under `/api/v1` in `index.ts`.
