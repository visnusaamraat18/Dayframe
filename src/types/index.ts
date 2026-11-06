export type Day = string;
export type Priority = 'high' | 'medium' | 'low';
export type Recurrence = 'none' | 'daily' | 'weekly';
export interface RecordBase {
  id: string;
  createdAt: string;
  demo?: boolean;
}
export interface Task extends RecordBase {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  dueDate: Day;
  dueTime: string;
  recurrence: Recurrence;
  completedAt: string | null;
  completedDate: Day | null;
}
export interface TaskCompletion extends RecordBase {
  taskId: string;
  date: Day;
}
export interface TaskEvent extends RecordBase {
  taskId: string;
  kind: 'created' | 'edited' | 'completed' | 'reopened' | 'rescheduled';
  detail: string;
  date: Day;
}
export interface Habit extends RecordBase {
  title: string;
  description: string;
  weekdays: number[];
  startDate: Day;
  archivedDate: Day | null;
  color: string;
}
export interface HabitLog extends RecordBase {
  habitId: string;
  date: Day;
  mood: number | null;
  note: string;
  completed: boolean;
}
export interface Note extends RecordBase {
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: string;
}
export interface Checklist extends RecordBase {
  title: string;
  updatedAt: string;
}
export interface ChecklistItem extends RecordBase {
  listId: string;
  text: string;
  completed: boolean;
  position: number;
}
export interface Preferences {
  id: 'app';
  theme: 'dark' | 'light' | 'system';
  dateFormat: 'day-first' | 'month-first' | 'iso';
  weekStart: 0 | 1;
  notifications: boolean;
}
export interface Review {
  date: Day;
  note: string;
  mood: number | null;
  updatedAt: string;
}
export interface ReminderDelivery {
  id: string;
  deliveredAt: string;
}
export interface Snapshot {
  tasks: Task[];
  taskCompletions: TaskCompletion[];
  taskEvents: TaskEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  notes: Note[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  preferences: Preferences[];
  reviews: Review[];
}
export const defaultPreferences: Preferences = {
  id: 'app',
  theme: 'dark',
  dateFormat: 'day-first',
  weekStart: 1,
  notifications: false,
};
export const emptySnapshot: Snapshot = {
  tasks: [],
  taskCompletions: [],
  taskEvents: [],
  habits: [],
  habitLogs: [],
  notes: [],
  checklists: [],
  checklistItems: [],
  preferences: [],
  reviews: [],
};
