import { api, command, type BackendState } from './api';
import { db } from '../database/db';
import { emptySnapshot, type Snapshot } from '../types';
import { validDay } from '../utils/dates';
export interface Backup {
  format: 'dayframe';
  version: 1;
  exportedAt: string;
  data: Snapshot;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 100000): v is string => typeof v === 'string' && v.length <= max;
const title = (v: unknown) => text(v, 200) && v.trim().length > 0;
const timestamp = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const nullableDay = (v: unknown) => v === null || validDay(v);
const time = (v: unknown) =>
  v === '' || (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
const mood = (v: unknown) =>
  v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5);
const base = (v: Record<string, unknown>) =>
  text(v.id, 200) &&
  !!v.id &&
  timestamp(v.createdAt) &&
  (v.demo === undefined || typeof v.demo === 'boolean');
export function validateBackup(input: unknown): Backup {
  if (
    !object(input) ||
    input.format !== 'dayframe' ||
    input.version !== 1 ||
    !timestamp(input.exportedAt) ||
    !object(input.data)
  )
    throw new Error('This is not a supported DAYFRAME version 1 backup.');
  const data = input.data;
  for (const name of Object.keys(emptySnapshot)) {
    const rows = data[name];
    if (!Array.isArray(rows) || rows.length > 100000)
      throw new Error(`Invalid or oversized ${name} collection.`);
    const unique = new Set<string>();
    for (const row of rows) {
      if (!object(row)) throw new Error(`Invalid record in ${name}.`);
      let valid = false;
      switch (name) {
        case 'tasks':
          valid =
            base(row) &&
            title(row.title) &&
            text(row.description) &&
            text(row.category, 80) &&
            ['high', 'medium', 'low'].includes(String(row.priority)) &&
            (row.dueDate === '' || validDay(row.dueDate)) &&
            time(row.dueTime) &&
            (!row.dueTime || !!row.dueDate) &&
            ['none', 'daily', 'weekly'].includes(String(row.recurrence)) &&
            (row.recurrence === 'none' || !!row.dueDate) &&
            (row.completedAt === null || timestamp(row.completedAt)) &&
            nullableDay(row.completedDate) &&
            (row.completedAt === null) === (row.completedDate === null) &&
            (row.recurrence === 'none' || row.completedAt === null);
          break;
        case 'taskCompletions':
          valid = base(row) && text(row.taskId, 200) && validDay(row.date);
          break;
        case 'taskEvents':
          valid =
            base(row) &&
            text(row.taskId, 200) &&
            validDay(row.date) &&
            ['created', 'edited', 'completed', 'reopened', 'rescheduled'].includes(
              String(row.kind),
            ) &&
            text(row.detail);
          break;
        case 'habits':
          valid =
            base(row) &&
            title(row.title) &&
            text(row.description) &&
            validDay(row.startDate) &&
            nullableDay(row.archivedDate) &&
            /^#[0-9a-f]{6}$/i.test(String(row.color)) &&
            Array.isArray(row.weekdays) &&
            row.weekdays.length > 0 &&
            row.weekdays.length <= 7 &&
            new Set(row.weekdays).size === row.weekdays.length &&
            row.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
          break;
        case 'habitLogs':
          valid =
            base(row) &&
            text(row.habitId, 200) &&
            validDay(row.date) &&
            mood(row.mood) &&
            text(row.note) &&
            typeof row.completed === 'boolean';
          break;
        case 'notes':
          valid =
            base(row) &&
            title(row.title) &&
            text(row.body) &&
            typeof row.pinned === 'boolean' &&
            timestamp(row.updatedAt);
          break;
        case 'checklists':
          valid = base(row) && title(row.title) && timestamp(row.updatedAt);
          break;
        case 'checklistItems':
          valid =
            base(row) &&
            text(row.listId, 200) &&
            text(row.text, 500) &&
            !!row.text.trim() &&
            typeof row.completed === 'boolean' &&
            typeof row.position === 'number' &&
            Number.isSafeInteger(row.position) &&
            row.position >= 0;
          break;
        case 'preferences':
          valid =
            row.id === 'app' &&
            ['dark', 'light', 'system'].includes(String(row.theme)) &&
            ['day-first', 'month-first', 'iso'].includes(String(row.dateFormat)) &&
            [0, 1].includes(Number(row.weekStart)) &&
            typeof row.weekStart === 'number' &&
            typeof row.notifications === 'boolean';
          break;
        case 'reviews':
          valid =
            validDay(row.date) && text(row.note) && mood(row.mood) && timestamp(row.updatedAt);
          break;
      }
      const key = String(name === 'reviews' ? row.date : row.id);
      if (!valid || unique.has(key)) throw new Error(`Invalid or duplicate record in ${name}.`);
      unique.add(key);
    }
  }
  const snapshot = data as unknown as Snapshot;
  const taskIds = new Set(snapshot.tasks.map((t) => t.id)),
    habitIds = new Set(snapshot.habits.map((h) => h.id)),
    listIds = new Set(snapshot.checklists.map((l) => l.id));
  if (
    snapshot.taskCompletions.some((r) => !taskIds.has(r.taskId)) ||
    snapshot.taskEvents.some((r) => !taskIds.has(r.taskId)) ||
    snapshot.habitLogs.some((r) => !habitIds.has(r.habitId)) ||
    snapshot.checklistItems.some((r) => !listIds.has(r.listId))
  )
    throw new Error('Backup contains records with missing parents.');
  for (const rows of [
    snapshot.taskCompletions.map((r) => `${r.taskId}\u0000${r.date}`),
    snapshot.habitLogs.map((r) => `${r.habitId}\u0000${r.date}`),
    snapshot.checklistItems.map((r) => `${r.listId}\u0000${r.position}`),
  ])
    if (new Set(rows).size !== rows.length)
      throw new Error('Backup contains duplicate daily records or item positions.');
  return {
    format: 'dayframe',
    version: 1,
    exportedAt: input.exportedAt as string,
    data: Object.fromEntries(
      Object.keys(emptySnapshot).map((k) => [k, data[k]]),
    ) as unknown as Snapshot,
  };
}
export async function exportBackup(): Promise<Backup> {
  return {
    format: 'dayframe',
    version: 1,
    exportedAt: new Date().toISOString(),
    data:
      import.meta.env.MODE === 'test'
        ? await db.snapshot()
        : (await api<BackendState>('/api/state')).data,
  };
}
export async function restoreBackup(input: unknown) {
  const backup = validateBackup(input);
  if (import.meta.env.MODE !== 'test') {
    await command('backup.restore', { backup });
    return;
  }
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    for (const [name, records] of Object.entries(backup.data))
      await db.table(name).bulkAdd(records);
  });
}
export async function resetData() {
  if (import.meta.env.MODE !== 'test') {
    await command('data.reset');
    return;
  }
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}
export function downloadFile(content: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const csv = (rows: (string | number)[][]) =>
  '\uFEFF' +
  rows
    .map((row) =>
      row
        .map((v) => {
          let value = String(v);
          if (/^[=+@\-\t\r]/.test(value)) value = `'${value}`;
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(','),
    )
    .join('\r\n');
