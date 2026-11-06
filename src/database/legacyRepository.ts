import { db } from './db';
import type { Task, Habit, HabitLog, Note, ChecklistItem, Day, Preferences } from '../types';
import { defaultPreferences } from '../types';
import { toDay, validDay } from '../utils/dates';
import { occurrenceDates, scheduled } from '../services/calculations';
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function required(value: string, label = 'Title', max = 200) {
  const result = value.trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return result;
}
function checkDate(value: string) {
  if (value && !validDay(value)) throw new Error('Enter a valid date between 1900 and 2199.');
}
export type TaskInput = Pick<
  Task,
  'title' | 'description' | 'category' | 'priority' | 'dueDate' | 'dueTime' | 'recurrence'
>;
export async function saveTask(input: TaskInput, existing?: Task) {
  const title = required(input.title);
  checkDate(input.dueDate);
  if (input.dueTime && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.dueTime) || !input.dueDate))
    throw new Error('A due time needs a due date and a valid time.');
  if (input.recurrence !== 'none' && !input.dueDate)
    throw new Error('Recurring tasks need a first due date.');
  if (
    !['none', 'daily', 'weekly'].includes(input.recurrence) ||
    !['high', 'medium', 'low'].includes(input.priority)
  )
    throw new Error('Invalid task options.');
  const task: Task = {
    id: existing?.id ?? id(),
    createdAt: existing?.createdAt ?? now(),
    completedAt: existing?.completedAt ?? null,
    completedDate: existing?.completedDate ?? null,
    ...(existing?.demo ? { demo: true } : {}),
    ...input,
    title,
    category: input.category.trim().slice(0, 80),
    ...(input.recurrence !== 'none' ? { completedAt: null, completedDate: null } : {}),
  };
  await db.transaction('rw', db.tasks, db.taskEvents, async () => {
    await db.tasks.put(task);
    await db.taskEvents.add({
      id: id(),
      createdAt: now(),
      taskId: task.id,
      kind: existing ? (existing.dueDate !== task.dueDate ? 'rescheduled' : 'edited') : 'created',
      detail:
        existing && existing.dueDate !== task.dueDate
          ? `${existing.dueDate || 'No date'} → ${task.dueDate || 'No date'}`
          : title,
      date: toDay(),
      demo: task.demo,
    });
  });
  return task;
}
export async function completeTask(task: Task, date: Day, completed: boolean) {
  await db.transaction('rw', db.tasks, db.taskCompletions, db.taskEvents, async () => {
    const current = await db.tasks.get(task.id);
    if (!current) throw new Error('This task was removed.');
    let changed = false;
    if (current.recurrence === 'none') {
      changed = !!current.completedAt !== completed;
      await db.tasks.update(task.id, {
        completedAt: completed ? now() : null,
        completedDate: completed ? toDay() : null,
      });
    } else {
      if (!occurrenceDates(current, date, date).length)
        throw new Error('This date is outside the recurring schedule.');
      if (date > toDay()) throw new Error('Future recurring tasks cannot be completed early.');
      const record = await db.taskCompletions
        .where('[taskId+date]')
        .equals([task.id, date])
        .first();
      changed = !!record !== completed;
      if (completed && !record)
        await db.taskCompletions.add({
          id: id(),
          taskId: task.id,
          date,
          createdAt: now(),
          demo: task.demo,
        });
      if (!completed && record) await db.taskCompletions.delete(record.id);
    }
    if (changed)
      await db.taskEvents.add({
        id: id(),
        taskId: task.id,
        createdAt: now(),
        date: toDay(),
        kind: completed ? 'completed' : 'reopened',
        detail: date || 'Undated task',
        demo: task.demo,
      });
  });
}
export async function deleteTask(taskId: string) {
  await db.transaction('rw', db.tasks, db.taskCompletions, db.taskEvents, async () => {
    await db.tasks.delete(taskId);
    await db.taskCompletions.where('taskId').equals(taskId).delete();
    await db.taskEvents.where('taskId').equals(taskId).delete();
  });
}
export type HabitInput = Pick<Habit, 'title' | 'description' | 'weekdays' | 'startDate' | 'color'>;
export async function saveHabit(input: HabitInput, existing?: Habit) {
  const title = required(input.title);
  checkDate(input.startDate);
  if (
    !input.startDate ||
    !input.weekdays.length ||
    input.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new Error('Choose a start date and at least one weekday.');
  const habit: Habit = {
    id: existing?.id ?? id(),
    createdAt: existing?.createdAt ?? now(),
    archivedDate: existing?.archivedDate ?? null,
    demo: existing?.demo,
    ...input,
    title,
    weekdays: [...new Set(input.weekdays)].sort(),
  };
  await db.habits.put(habit);
  return habit;
}
export async function deleteHabit(habitId: string) {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habits.delete(habitId);
    await db.habitLogs.where('habitId').equals(habitId).delete();
  });
}
export async function logHabit(
  habit: Habit,
  date: Day,
  input: Pick<HabitLog, 'completed' | 'mood' | 'note'>,
) {
  if (!scheduled(habit, date) || date > toDay())
    throw new Error('Choose a scheduled date up to today.');
  if (input.mood !== null && (!Number.isInteger(input.mood) || input.mood < 1 || input.mood > 5))
    throw new Error('Mood must be between 1 and 5.');
  await db.transaction('rw', db.habitLogs, async () => {
    const old = await db.habitLogs.where('[habitId+date]').equals([habit.id, date]).first();
    await db.habitLogs.put({
      id: old?.id ?? id(),
      createdAt: old?.createdAt ?? now(),
      habitId: habit.id,
      date,
      demo: habit.demo,
      ...input,
    });
  });
}
export async function saveNote(input: Pick<Note, 'title' | 'body' | 'pinned'>, existing?: Note) {
  const note: Note = {
    id: existing?.id ?? id(),
    createdAt: existing?.createdAt ?? now(),
    demo: existing?.demo,
    ...input,
    title: required(input.title),
    updatedAt: now(),
  };
  await db.notes.put(note);
  return note;
}
export async function noteToTask(note: Note) {
  return db.transaction('rw', db.tasks, db.taskEvents, async () => {
    const task = await saveTask({
      title: note.title,
      description: note.body,
      priority: 'medium',
      category: 'Notes',
      dueDate: '',
      dueTime: '',
      recurrence: 'none',
    });
    if (note.demo) {
      task.demo = true;
      await db.tasks.put(task);
      await db.taskEvents.where('taskId').equals(task.id).modify({ demo: true });
    }
    return task;
  });
}
export async function createChecklist(title: string, lines: string[] = []) {
  const list = { id: id(), title: required(title), createdAt: now(), updatedAt: now() };
  await db.transaction('rw', db.checklists, db.checklistItems, async () => {
    await db.checklists.add(list);
    await db.checklistItems.bulkAdd(
      lines
        .filter((t) => t.trim())
        .map((text, position) => ({
          id: id(),
          listId: list.id,
          text: required(text, 'Item', 500),
          completed: false,
          position,
          createdAt: now(),
        })),
    );
  });
  return list;
}
export async function addItem(listId: string, text: string) {
  await db.transaction('rw', db.checklists, db.checklistItems, async () => {
    const list = await db.checklists.get(listId);
    if (!list) throw new Error('This checklist was removed.');
    const items = await db.checklistItems.where('listId').equals(listId).toArray();
    await db.checklistItems.add({
      id: id(),
      listId,
      text: required(text, 'Item', 500),
      completed: false,
      position: Math.max(-1, ...items.map((i) => i.position)) + 1,
      createdAt: now(),
      demo: list.demo,
    });
  });
}
export async function moveItem(item: ChecklistItem, direction: -1 | 1) {
  await db.transaction('rw', db.checklistItems, async () => {
    const items = (await db.checklistItems.where('listId').equals(item.listId).toArray()).sort(
      (a, b) => a.position - b.position,
    );
    const index = items.findIndex((i) => i.id === item.id),
      target = items[index + direction];
    if (target) {
      await db.checklistItems.update(item.id, { position: target.position });
      await db.checklistItems.update(target.id, { position: item.position });
    }
  });
}
export async function deleteList(listId: string) {
  await db.transaction('rw', db.checklists, db.checklistItems, async () => {
    await db.checklists.delete(listId);
    await db.checklistItems.where('listId').equals(listId).delete();
  });
}
export async function savePreferences(patch: Partial<Preferences>) {
  const existing = await db.preferences.get('app');
  await db.preferences.put({ ...defaultPreferences, ...existing, ...patch, id: 'app' });
}
