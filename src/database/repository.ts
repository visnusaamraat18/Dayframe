import type { Task, Habit, HabitLog, Note, ChecklistItem, Preferences, Review } from '../types';
import { command } from '../services/api';
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function required(value: string, label = 'Title', maximum = 200) {
  const result = value.trim();
  if (!result || result.length > maximum)
    throw new Error(`${label} is required and must be ${maximum} characters or fewer.`);
  return result;
}
export type { TaskInput, HabitInput } from './legacyRepository';
import type { TaskInput, HabitInput } from './legacyRepository';
export const saveTask = (input: TaskInput, task?: Task) =>
  command<Task>('task.save', { input, id: task?.id });
export const completeTask = (task: Task, date: string, completed: boolean) =>
  command('task.complete', { id: task.id, date, completed });
export const deleteTask = (id: string) => command('task.delete', { id });
export const saveHabit = (input: HabitInput, habit?: Habit) =>
  command<Habit>('habit.save', { input, id: habit?.id });
export const deleteHabit = (id: string) => command('habit.delete', { id });
export const logHabit = (
  habit: Habit,
  date: string,
  input: Pick<HabitLog, 'completed' | 'mood' | 'note'>,
) => command('habit.log', { id: habit.id, date, input });
export const saveNote = (input: Pick<Note, 'title' | 'body' | 'pinned'>, note?: Note) =>
  command<Note>('note.save', { input, id: note?.id });
export const noteToTask = (note: Note) => command<Task>('note.convert', { id: note.id });
export const createChecklist = (title: string, lines: string[] = []) =>
  command<{ id: string; title: string; createdAt: string; updatedAt: string }>('list.create', {
    title,
    lines,
  });
export const addItem = (id: string, text: string) => command('item.add', { id, text });
export const moveItem = (item: ChecklistItem, direction: -1 | 1) =>
  command('item.move', { id: item.id, direction });
export const deleteList = (id: string) => command('list.delete', { id });
export const savePreferences = (patch: Partial<Preferences>) =>
  command('preferences.save', { patch });
export const archiveHabit = (id: string) => command('habit.archive', { id });
export const pinNote = (id: string, pinned: boolean) => command('note.pin', { id, pinned });
export const deleteNote = (id: string) => command('note.delete', { id });
export const renameList = (id: string, title: string) => command('list.rename', { id, title });
export const editItem = (id: string, text: string) => command('item.edit', { id, text });
export const completeItem = (id: string, completed: boolean) =>
  command('item.complete', { id, completed });
export const deleteItem = (id: string) => command('item.delete', { id });
export const clearItems = (id: string) => command('item.clear', { id });
export const saveReview = (input: Review) => command('review.save', { input });
export const rescheduleTasks = (ids: string[], date: string) =>
  command('tasks.reschedule', { ids, date });
