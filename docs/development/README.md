# Development coordination

This folder tracks **actionable work** derived from design and architecture docs. Product intent lives in `docs/design/`; this board tracks implementation gaps and agent assignments.

## Files

| File | Purpose |
|------|---------|
| [`tasks.yaml`](tasks.yaml) | Machine-readable tasks — status, priority, dependencies, acceptance criteria |
| [`TASK_BOARD.md`](TASK_BOARD.md) | Human dashboard — summary, next items, doc audit notes |
| [`../../scripts/task-board.ts`](../../scripts/task-board.ts) | CLI for claim / release / complete |

Run from repo root: `npm run task -- next` — uses backend `tsx` + `yaml` (no root `npm install` required).

## Workflow for agents

1. Read relevant doc under `docs/design/` or `docs/architecture/` (listed in each task's `source_docs`).
2. Run `npm run task -- next` to see unclaimed ready tasks.
3. **Claim** before editing: `npm run task -- claim TASK-ID your-agent-name`
4. Implement only what acceptance criteria require — minimal diff.
5. **Complete** when done: `npm run task -- complete TASK-ID your-agent-name`
6. Update `TASK_BOARD.md` assignment log if you add notes (optional; CLI updates `tasks.yaml`).

## Task fields

- **status:** `backlog` → `ready` → `in_progress` → `done` (or `blocked` / `cancelled`)
- **priority:** P0 critical · P1 high · P2 medium · P3 low · **P4 deferred** (iOS)
- **area:** `backend` · `ui` · `ios` · `docs` · `infra`
- **dependencies:** Task IDs that must be `done` before this task becomes `ready`

## Adding tasks

Edit `tasks.yaml` directly. Run `npm run task -- sync-board` to regenerate summary counts in `TASK_BOARD.md` (or update the markdown tables manually for small changes).

## Related

- [AGENTS.md](../../AGENTS.md) — coding standards
- [product-requirements.md](../design/product-requirements.md) — MVP scope
- [api-contract.md](../design/api-contract.md) — REST contract
