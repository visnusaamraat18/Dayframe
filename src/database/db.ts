import Dexie, { type Table } from 'dexie';
import type {
  Task,
  TaskCompletion,
  TaskEvent,
  Habit,
  HabitLog,
  Note,
  Checklist,
  ChecklistItem,
  Preferences,
  Review,
  ReminderDelivery,
  Snapshot,
} from '../types';
export class DayframeDB extends Dexie {
  tasks!: Table<Task>;
  taskCompletions!: Table<TaskCompletion>;
  taskEvents!: Table<TaskEvent>;
  habits!: Table<Habit>;
  habitLogs!: Table<HabitLog>;
  notes!: Table<Note>;
  checklists!: Table<Checklist>;
  checklistItems!: Table<ChecklistItem>;
  preferences!: Table<Preferences>;
  reviews!: Table<Review>;
  reminderDeliveries!: Table<ReminderDelivery>;
  constructor(name = 'dayframe') {
    super(name);
    this.version(1).stores({
      tasks: 'id,dueDate,category,priority',
      taskCompletions: 'id,&[taskId+date],taskId,date',
      taskEvents: 'id,taskId,date,kind',
      habits: 'id,startDate',
      habitLogs: 'id,&[habitId+date],habitId,date',
      notes: 'id,updatedAt',
      checklists: 'id',
      checklistItems: 'id,listId,position',
      preferences: 'id',
      reviews: 'date',
      reminderDeliveries: 'id',
    });
  }
  async snapshot(): Promise<Snapshot> {
    return this.transaction('r', this.tables, async () => ({
      tasks: await this.tasks.toArray(),
      taskCompletions: await this.taskCompletions.toArray(),
      taskEvents: await this.taskEvents.toArray(),
      habits: await this.habits.toArray(),
      habitLogs: await this.habitLogs.toArray(),
      notes: await this.notes.toArray(),
      checklists: await this.checklists.toArray(),
      checklistItems: await this.checklistItems.toArray(),
      preferences: await this.preferences.toArray(),
      reviews: await this.reviews.toArray(),
    }));
  }
}
export const db = new DayframeDB();
