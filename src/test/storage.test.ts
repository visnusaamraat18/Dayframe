import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import {
  saveTask,
  completeTask,
  deleteTask,
  saveHabit,
  deleteHabit,
  logHabit,
  saveNote,
  noteToTask,
  createChecklist,
  addItem,
  moveItem,
  deleteList,
  savePreferences,
} from '../database/legacyRepository';
import { resetData, exportBackup, restoreBackup, validateBackup, csv } from '../services/backup';
import { clearDemo, loadDemo, demoSnapshot } from '../services/demo';
import { toDay, addDays } from '../utils/dates';
import type { TaskInput, HabitInput } from '../database/legacyRepository';
const today = toDay();
const taskInput: TaskInput = {
  title: '  Write report  ',
  description: 'Draft it',
  category: 'Study',
  priority: 'high',
  dueDate: today,
  dueTime: '15:30',
  recurrence: 'none',
};
const habitInput: HabitInput = {
  title: 'Read',
  description: '',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  startDate: addDays(today, -10),
  color: '#b8edbe',
};
afterEach(async () => {
  if (!db.isOpen()) await db.open();
  await resetData();
});
describe('IndexedDB task lifecycle', () => {
  it('creates, edits, reschedules and cascades task deletion', async () => {
    const task = await saveTask(taskInput);
    expect((await db.tasks.get(task.id))?.title).toBe('Write report');
    const updated = await saveTask(
      { ...taskInput, title: 'Final report', dueDate: addDays(today, 1) },
      task,
    );
    expect(updated.id).toBe(task.id);
    expect(await db.tasks.count()).toBe(1);
    expect(
      (await db.taskEvents.where('taskId').equals(task.id).toArray()).some(
        (e) => e.kind === 'rescheduled',
      ),
    ).toBe(true);
    await deleteTask(task.id);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.taskEvents.count()).toBe(0);
  });
  it('records completion and undo with real history', async () => {
    const task = await saveTask(taskInput);
    await completeTask(task, today, true);
    expect((await db.tasks.get(task.id))?.completedDate).toBe(today);
    await completeTask(task, today, false);
    expect((await db.tasks.get(task.id))?.completedAt).toBeNull();
    expect(await db.taskEvents.count()).toBe(3);
  });
  it('keeps recurring completion idempotent and undoable with one task record', async () => {
    const task = await saveTask({ ...taskInput, recurrence: 'daily' });
    await Promise.all([completeTask(task, today, true), completeTask(task, today, true)]);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.taskCompletions.count()).toBe(1);
    expect(await db.taskEvents.count()).toBe(2);
    await completeTask(task, today, false);
    expect(await db.taskCompletions.count()).toBe(0);
  });
  it('rejects invalid fields and future recurring completion', async () => {
    await expect(saveTask({ ...taskInput, title: ' ' })).rejects.toThrow('required');
    await expect(saveTask({ ...taskInput, dueDate: '2026-02-30' })).rejects.toThrow('date');
    await expect(
      saveTask({ ...taskInput, dueDate: '', recurrence: 'daily', dueTime: '' }),
    ).rejects.toThrow('due date');
    const task = await saveTask({ ...taskInput, recurrence: 'daily' });
    await expect(completeTask(task, addDays(today, 1), true)).rejects.toThrow('Future');
    expect(await db.taskCompletions.count()).toBe(0);
  });
  it('persists after closing and reopening the database connection', async () => {
    const task = await saveTask(taskInput);
    await savePreferences({ theme: 'light' });
    db.close();
    await db.open();
    expect((await db.tasks.get(task.id))?.title).toBe('Write report');
    expect((await db.preferences.get('app'))?.theme).toBe('light');
  });
});
describe('habit journal persistence', () => {
  it('creates and edits habits, and stores one daily log with mood and notes', async () => {
    const habit = await saveHabit(habitInput);
    const edited = await saveHabit({ ...habitInput, title: 'Read a chapter' }, habit);
    expect(await db.habits.count()).toBe(1);
    await logHabit(edited, today, { completed: true, mood: 5, note: 'A good day' });
    await logHabit(edited, today, { completed: true, mood: 4, note: 'Updated thought' });
    expect(await db.habitLogs.count()).toBe(1);
    const log = (await db.habitLogs.toArray())[0];
    expect(log.note).toBe('Updated thought');
    expect(log.mood).toBe(4);
    await logHabit(edited, today, { completed: false, mood: 4, note: log.note });
    expect((await db.habitLogs.toArray())[0].completed).toBe(false);
  });
  it('keeps journal history through archiving and removes it on deletion', async () => {
    const habit = await saveHabit(habitInput);
    await logHabit(habit, today, { completed: true, mood: null, note: '' });
    await db.habits.update(habit.id, { archivedDate: today });
    expect(await db.habitLogs.count()).toBe(1);
    await deleteHabit(habit.id);
    expect(await db.habitLogs.count()).toBe(0);
  });
  it('rejects empty schedules, unscheduled dates and invalid moods', async () => {
    await expect(saveHabit({ ...habitInput, weekdays: [] })).rejects.toThrow('weekday');
    const habit = await saveHabit(habitInput);
    await expect(
      logHabit(habit, addDays(today, -20), { completed: true, mood: null, note: '' }),
    ).rejects.toThrow('scheduled');
    await expect(logHabit(habit, today, { completed: true, mood: 8, note: '' })).rejects.toThrow(
      'Mood',
    );
  });
});
describe('notes and checklists', () => {
  it('creates, edits, pins, converts, and deletes notes', async () => {
    const note = await saveNote({ title: 'Idea', body: 'A useful thought', pinned: false });
    const edited = await saveNote({ title: 'An idea', body: 'Details', pinned: true }, note);
    expect(await db.notes.count()).toBe(1);
    expect((await db.notes.get(note.id))?.pinned).toBe(true);
    const task = await noteToTask(edited);
    expect(task.description).toBe('Details');
    expect(await db.notes.count()).toBe(1);
    await db.notes.delete(note.id);
    expect(await db.notes.count()).toBe(0);
  });
  it('adds, edits, reorders, completes and clears checklist items, then deletes lists', async () => {
    const list = await createChecklist('Weekly reset', ['Clean desk', 'Review week']);
    await addItem(list.id, 'Plan ahead');
    let items = (await db.checklistItems.toArray()).sort((a, b) => a.position - b.position);
    await moveItem(items[2], -1);
    items = (await db.checklistItems.toArray()).sort((a, b) => a.position - b.position);
    expect(items.map((i) => i.text)).toEqual(['Clean desk', 'Plan ahead', 'Review week']);
    await db.checklistItems.update(items[0].id, { text: 'Tidy desk', completed: true });
    await db.checklistItems
      .where('listId')
      .equals(list.id)
      .filter((i) => i.completed)
      .delete();
    expect(await db.checklistItems.count()).toBe(2);
    await deleteList(list.id);
    expect(await db.checklists.count()).toBe(0);
    expect(await db.checklistItems.count()).toBe(0);
  });
});
describe('validated backup and restore', () => {
  it('round-trips the entire database and preferences', async () => {
    await saveTask(taskInput);
    const habit = await saveHabit(habitInput);
    await logHabit(habit, today, { completed: true, mood: 4, note: 'Hello' });
    await saveNote({ title: 'Thought', body: 'Remember', pinned: true });
    await createChecklist('List', ['One', 'Two']);
    await savePreferences({ weekStart: 0, dateFormat: 'iso' });
    const before = await db.snapshot(),
      backup = JSON.parse(JSON.stringify(await exportBackup()));
    await resetData();
    await restoreBackup(backup);
    expect(await db.snapshot()).toEqual(before);
  });
  it('validates complete demonstration data', () => {
    expect(() =>
      validateBackup({
        format: 'dayframe',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: demoSnapshot(),
      }),
    ).not.toThrow();
  });
  it('rejects malformed, missing, duplicate and orphaned records without touching current data', async () => {
    await saveTask(taskInput);
    const backup = await exportBackup();
    const cases = [
      null,
      { ...backup, version: 999 },
      { ...backup, data: {} },
      { ...backup, data: { ...backup.data, tasks: [backup.data.tasks[0], backup.data.tasks[0]] } },
      {
        ...backup,
        data: { ...backup.data, tasks: [{ ...backup.data.tasks[0], dueDate: '2026-02-30' }] },
      },
      {
        ...backup,
        data: {
          ...backup.data,
          taskCompletions: [
            { id: 'orphan', createdAt: new Date().toISOString(), taskId: 'missing', date: today },
          ],
        },
      },
    ];
    for (const invalid of cases) await expect(restoreBackup(invalid)).rejects.toThrow();
    expect(await db.tasks.count()).toBe(1);
  });
  it('rejects duplicate daily logs even if their primary ids differ', async () => {
    const habit = await saveHabit(habitInput);
    await logHabit(habit, today, { completed: true, mood: null, note: '' });
    const backup = await exportBackup();
    backup.data.habitLogs.push({ ...backup.data.habitLogs[0], id: 'different' });
    expect(() => validateBackup(backup)).toThrow('duplicate daily');
  });
  it('exports CSV with quoted values and neutralized spreadsheet formulas', () => {
    expect(csv([['a,b', 'Say "hi"', '=1+1']])).toBe('\uFEFF"a,b","Say ""hi""","\'=1+1"');
  });
});
describe('demonstration isolation', () => {
  it('loads explicitly, prevents repeat loading, and clears only tagged demo records', async () => {
    const personal = await saveTask(taskInput);
    await loadDemo();
    expect(await db.tasks.count()).toBeGreaterThan(1);
    await expect(loadDemo()).rejects.toThrow('already loaded');
    await clearDemo();
    expect(await db.tasks.toArray()).toEqual([personal]);
    expect(await db.habitLogs.count()).toBe(0);
    expect(await db.taskEvents.count()).toBe(1);
  });
});
describe('edge cases found during review', () => {
  it('keeps tasks converted from demo notes identifiable for cleanup', async () => {
    await loadDemo();
    const demoNote = (await db.notes.toArray())[0];
    const converted = await noteToTask(demoNote);
    expect(converted.demo).toBe(true);
    expect((await db.taskEvents.where('taskId').equals(converted.id).first())?.demo).toBe(true);
    await clearDemo();
    expect(await db.tasks.count()).toBe(0);
    expect(await db.taskEvents.count()).toBe(0);
  });
  it('backs up a habit archived before its future start date', async () => {
    const habit = await saveHabit({ ...habitInput, startDate: addDays(today, 10) });
    await db.habits.update(habit.id, { archivedDate: today });
    const backup = await exportBackup();
    expect(() => validateBackup(backup)).not.toThrow();
  });
});
