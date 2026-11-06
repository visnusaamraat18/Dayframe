import { command } from './api';
import { db } from '../database/db';
import { emptySnapshot, type Snapshot, type Task, type Habit } from '../types';
import { addDays, daysBetween, toDay } from '../utils/dates';
import { scheduled } from './calculations';
export function demoSnapshot(today = toDay()): Snapshot {
  const data: Snapshot = structuredClone(emptySnapshot);
  const stamp = new Date().toISOString();
  const base = (id: string) => ({ id: `demo-${id}`, createdAt: stamp, demo: true });
  const task = (
    key: string,
    title: string,
    offset: number,
    category: string,
    priority: Task['priority'] = 'medium',
  ): Task => ({
    ...base(key),
    title,
    description: 'Fictional demonstration task. Edit or remove this example anytime.',
    category,
    priority,
    dueDate: addDays(today, offset),
    dueTime: '',
    recurrence: 'none',
    completedAt: null,
    completedDate: null,
  });
  data.tasks = [
    task('presentation', 'Finish the project presentation', 0, 'Study', 'high'),
    task('design', 'Review the dashboard designs', 0, 'Personal', 'high'),
    task('read', 'Read a chapter of Atomic Habits', 0, 'Personal', 'low'),
    task('assignment', 'Submit the research assignment', -2, 'Study', 'high'),
    task('budget', 'Review monthly expenses', -1, 'Life', 'medium'),
    task('meeting', 'Prepare for the project review', 1, 'Study'),
    task('plan', 'Plan next week’s priorities', 3, 'Personal'),
    task('groceries', 'Pick up groceries', 0, 'Life'),
  ];
  data.tasks.at(-1)!.completedAt = stamp;
  data.tasks.at(-1)!.completedDate = today;
  for (let n = 1; n <= 21; n++)
    for (let i = 0; i < (n % 4) + 1; i++)
      data.tasks.push({
        ...task(
          `history-${n}-${i}`,
          [
            'Organize lecture notes',
            'Complete a study session',
            'Clear the inbox',
            'Plan tomorrow',
          ][i],
          -n,
          'Study',
        ),
        completedAt: new Date(`${addDays(today, -n)}T14:00:00`).toISOString(),
        completedDate: addDays(today, -n),
      });
  const habit = (
    key: string,
    title: string,
    color: string,
    weekdays = [0, 1, 2, 3, 4, 5, 6],
  ): Habit => ({
    ...base(key),
    title,
    description: 'Fictional demo habit',
    color,
    weekdays,
    startDate: addDays(today, -27),
    archivedDate: null,
  });
  data.habits = [
    habit('water', 'Drink enough water', '#9bd5e7'),
    habit('move', 'Move for 30 minutes', '#c4b2ef'),
    habit('journal', 'Write a little, reflect a little', '#e4c48f'),
    habit('focus', 'One focused study session', '#b8edbe', [1, 2, 3, 4, 5]),
  ];
  for (const [index, h] of data.habits.entries())
    for (const [n, date] of daysBetween(h.startDate, today).entries())
      if (scheduled(h, date) && (n + index) % 6 !== 0 && (date !== today || index === 0))
        data.habitLogs.push({
          ...base(`log-${index}-${date}`),
          habitId: h.id,
          date,
          mood: 3 + (n % 3),
          note: n % 4 === 0 ? 'A small step forward today. (Demo)' : '',
          completed: true,
        });
  data.notes = [
    {
      ...base('note-1'),
      title: 'A little less, but better.',
      body: 'Make room for the things that matter.\n\n• Pick three priorities each morning.\n• Protect a little time for deep work.\n• End the day with a clean slate.\n\nFictional demonstration note.',
      pinned: true,
      updatedAt: stamp,
    },
    {
      ...base('note-2'),
      title: 'Ideas for the next project',
      body: 'A campus resource exchange, a reading journal, or a simple budget companion.\n\nFictional demonstration note.',
      pinned: false,
      updatedAt: stamp,
    },
  ];
  data.checklists = [{ ...base('list'), title: 'The weekly reset', updatedAt: stamp }];
  data.checklistItems = [
    'Tidy up the workspace',
    'Review upcoming deadlines',
    'Plan meals for the week',
    'Make time for something fun',
  ].map((text, i) => ({
    ...base(`item-${i}`),
    listId: 'demo-list',
    text,
    position: i,
    completed: i === 0,
  }));
  data.taskEvents = [0, 1, 2].map((n) => ({
    ...base(`reschedule-${n}`),
    taskId: 'demo-budget',
    date: addDays(today, -n),
    kind: 'rescheduled',
    detail: 'Fictional demonstration reschedule',
  }));
  return data;
}
export async function loadDemo() {
  const data = demoSnapshot();
  if (import.meta.env.MODE !== 'test') {
    await command('demo.load', { data });
    return;
  }
  await db.transaction('rw', db.tables, async () => {
    if (
      (await db.tasks.toArray()).some((t) => t.demo) ||
      (await db.habits.toArray()).some((h) => h.demo)
    )
      throw new Error('Demo data is already loaded. Clear it before loading again.');
    for (const [name, records] of Object.entries(data))
      if (records.length) await db.table(name).bulkAdd(records);
  });
}
export async function clearDemo() {
  if (import.meta.env.MODE !== 'test') {
    await command('demo.clear');
    return;
  }
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.filter((row) => row.demo === true).delete();
  });
}
