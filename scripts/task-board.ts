#!/usr/bin/env npx tsx
/**
 * SpendFlow task board CLI — atomic claim/release for multi-agent coordination.
 *
 * Usage:
 *   npx tsx scripts/task-board.ts list
 *   npx tsx scripts/task-board.ts next
 *   npx tsx scripts/task-board.ts claim TASK-ID agent-name
 *   npx tsx scripts/task-board.ts release TASK-ID agent-name
 *   npx tsx scripts/task-board.ts complete TASK-ID agent-name
 *   npx tsx scripts/task-board.ts status TASK-ID
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const TASKS_PATH = resolve(REPO_ROOT, "docs/development/tasks.yaml");

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  area: string;
  phase?: number | string;
  assignee: string | null;
  claimed_at: string | null;
  dependencies?: string[];
  source_docs?: string[];
  description?: string;
  acceptance_criteria?: string[];
}

interface TaskFile {
  version: number;
  updated_at: string;
  tasks: Task[];
}

const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

function loadTasks(): TaskFile {
  const raw = readFileSync(TASKS_PATH, "utf8");
  return parseYaml(raw) as TaskFile;
}

function saveTasks(data: TaskFile): void {
  data.updated_at = new Date().toISOString().slice(0, 10);
  writeFileSync(TASKS_PATH, stringifyYaml(data, { lineWidth: 0 }), "utf8");
}

function findTask(data: TaskFile, id: string): Task {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) {
    console.error(`Task not found: ${id}`);
    process.exit(1);
  }
  return task;
}

function depsMet(data: TaskFile, task: Task): boolean {
  const deps = task.dependencies ?? [];
  return deps.every((depId) => {
    const dep = data.tasks.find((t) => t.id === depId);
    return dep?.status === "done";
  });
}

function isReady(data: TaskFile, task: Task): boolean {
  return (
    (task.status === "ready" || task.status === "backlog") &&
    task.assignee === null &&
    depsMet(data, task)
  );
}

function sortByPriority(a: Task, b: Task): number {
  const pa = PRIORITY_ORDER[a.priority] ?? 99;
  const pb = PRIORITY_ORDER[b.priority] ?? 99;
  return pa - pb || a.id.localeCompare(b.id);
}

function cmdList(data: TaskFile): void {
  for (const t of [...data.tasks].sort(sortByPriority)) {
    const assignee = t.assignee ? `@${t.assignee}` : "—";
    console.log(`${t.id.padEnd(18)} ${t.priority.padEnd(3)} ${t.status.padEnd(12)} ${assignee.padEnd(16)} ${t.title}`);
  }
}

function cmdNext(data: TaskFile): void {
  const ready = data.tasks
    .filter((t) => isReady(data, t) && t.status !== "done")
    .map((t) => ({ ...t, status: depsMet(data, t) ? "ready" : t.status }))
    .filter((t) => t.status === "ready" || (t.status === "backlog" && depsMet(data, t)))
    .sort(sortByPriority);

  if (ready.length === 0) {
    console.log("No tasks ready to claim.");
    return;
  }

  console.log("Ready tasks (claim with: npm run task -- claim <ID> <agent-name>):\n");
  for (const t of ready) {
    console.log(`  ${t.id}  [${t.priority}] ${t.area} — ${t.title}`);
    if (t.dependencies?.length) {
      console.log(`         deps: ${t.dependencies.join(", ")} (met)`);
    }
  }
}

function cmdClaim(data: TaskFile, id: string, agent: string): void {
  const task = findTask(data, id);

  if (task.status === "done") {
    console.error(`${id} is already done.`);
    process.exit(1);
  }
  if (task.assignee && task.assignee !== agent) {
    console.error(`${id} is claimed by ${task.assignee}. Release first.`);
    process.exit(1);
  }
  if (!depsMet(data, task)) {
    const unmet = (task.dependencies ?? []).filter((depId) => {
      const dep = data.tasks.find((t) => t.id === depId);
      return dep?.status !== "done";
    });
    console.error(`${id} blocked by: ${unmet.join(", ")}`);
    process.exit(1);
  }

  task.status = "in_progress";
  task.assignee = agent;
  task.claimed_at = new Date().toISOString();
  saveTasks(data);
  console.log(`Claimed ${id} for ${agent}`);
}

function cmdRelease(data: TaskFile, id: string, agent: string): void {
  const task = findTask(data, id);

  if (task.assignee !== agent) {
    console.error(`${id} is assigned to ${task.assignee ?? "nobody"}, not ${agent}.`);
    process.exit(1);
  }

  task.status = depsMet(data, task) ? "ready" : "backlog";
  task.assignee = null;
  task.claimed_at = null;
  saveTasks(data);
  console.log(`Released ${id}`);
}

function cmdComplete(data: TaskFile, id: string, agent: string): void {
  const task = findTask(data, id);

  if (task.assignee !== agent) {
    console.error(`${id} is assigned to ${task.assignee ?? "nobody"}, not ${agent}.`);
    process.exit(1);
  }

  task.status = "done";
  task.assignee = null;
  task.claimed_at = null;
  saveTasks(data);
  console.log(`Completed ${id}`);

  // Unblock dependents
  const unblocked = data.tasks.filter(
    (t) =>
      t.status === "backlog" &&
      (t.dependencies ?? []).includes(id) &&
      depsMet(data, t),
  );
  for (const t of unblocked) {
    t.status = "ready";
  }
  if (unblocked.length > 0) {
    saveTasks(data);
    console.log(`Unblocked: ${unblocked.map((t) => t.id).join(", ")}`);
  }
}

function cmdStatus(data: TaskFile, id: string): void {
  const task = findTask(data, id);
  console.log(stringifyYaml(task, { lineWidth: 0 }));
}

function main(): void {
  const [, , command, arg1, arg2] = process.argv;
  const data = loadTasks();

  switch (command) {
    case "list":
      cmdList(data);
      break;
    case "next":
      cmdNext(data);
      break;
    case "claim":
      if (!arg1 || !arg2) {
        console.error("Usage: claim TASK-ID agent-name");
        process.exit(1);
      }
      cmdClaim(data, arg1, arg2);
      break;
    case "release":
      if (!arg1 || !arg2) {
        console.error("Usage: release TASK-ID agent-name");
        process.exit(1);
      }
      cmdRelease(data, arg1, arg2);
      break;
    case "complete":
      if (!arg1 || !arg2) {
        console.error("Usage: complete TASK-ID agent-name");
        process.exit(1);
      }
      cmdComplete(data, arg1, arg2);
      break;
    case "status":
      if (!arg1) {
        console.error("Usage: status TASK-ID");
        process.exit(1);
      }
      cmdStatus(data, arg1);
      break;
    default:
      console.log(`SpendFlow task board

Commands:
  list                         All tasks
  next                         Ready tasks sorted by priority
  claim TASK-ID agent-name     Start work
  release TASK-ID agent-name   Abandon work
  complete TASK-ID agent-name  Mark done
  status TASK-ID               Show task details
`);
  }
}

main();
