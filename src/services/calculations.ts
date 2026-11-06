import type { Day, Habit, HabitLog, Snapshot, Task, TaskCompletion, Priority } from '../types';
import { addDays, daysBetween, parseDay, toDay } from '../utils/dates';
export function scheduled(habit: Habit, day: Day): boolean {
  return (
    day >= habit.startDate &&
    (!habit.archivedDate || day <= habit.archivedDate) &&
    habit.weekdays.includes(parseDay(day).getDay())
  );
}
export function occurrenceDates(task: Task, start: Day, end: Day): Day[] {
  if (!task.dueDate || end < task.dueDate) return [];
  if (task.recurrence === 'none')
    return task.dueDate >= start && task.dueDate <= end ? [task.dueDate] : [];
  const step = task.recurrence === 'daily' ? 1 : 7;
  const days = Math.round(
    (Date.UTC(...utcParts(start)) - Date.UTC(...utcParts(task.dueDate))) / 86400000,
  );
  let date = addDays(task.dueDate, Math.max(0, Math.ceil(days / step)) * step);
  const result: Day[] = [];
  while (date <= end && result.length < 110000) {
    result.push(date);
    date = addDays(date, step);
  }
  return result;
}
function utcParts(day: Day): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m - 1, d];
}
export function effectiveDate(task: Task, completions: TaskCompletion[]): Day {
  if (task.recurrence === 'none' || !task.dueDate) return task.dueDate;
  const completed = new Set(completions.filter((c) => c.taskId === task.id).map((c) => c.date));
  let day = task.dueDate;
  while (completed.has(day)) day = addDays(day, task.recurrence === 'daily' ? 1 : 7);
  return day;
}
export const isTaskDone = (task: Task, day: Day, completions: TaskCompletion[]) =>
  task.recurrence === 'none'
    ? !!task.completedAt
    : completions.some((c) => c.taskId === task.id && c.date === day);
export interface TaskRow {
  task: Task;
  date: Day;
  done: boolean;
}
export function taskRows(data: Snapshot, day?: Day): TaskRow[] {
  return data.tasks
    .flatMap((task) => {
      if (day && task.recurrence !== 'none')
        return occurrenceDates(task, day, day).map((date) => ({
          task,
          date,
          done: isTaskDone(task, date, data.taskCompletions),
        }));
      const date = effectiveDate(task, data.taskCompletions);
      return !day || date === day
        ? [{ task, date, done: isTaskDone(task, date, data.taskCompletions) }]
        : [];
    })
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.date || '9999').localeCompare(b.date || '9999') ||
        priorityRank[a.task.priority] - priorityRank[b.task.priority],
    );
}
const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export function filterTasks(
  rows: TaskRow[],
  filters: { search: string; status: string; priority: string; date: string; category?: string },
  today = toDay(),
): TaskRow[] {
  return rows.filter(
    (r) =>
      `${r.task.title} ${r.task.description} ${r.task.category}`
        .toLowerCase()
        .includes(filters.search.toLowerCase()) &&
      (filters.status === 'all' ||
        (filters.status === 'completed' && r.done) ||
        (filters.status === 'open' && !r.done)) &&
      (filters.priority === 'all' || filters.priority === r.task.priority) &&
      (!filters.category || filters.category === 'all' || filters.category === r.task.category) &&
      (filters.date === 'all' ||
        (filters.date === 'today' && r.date === today) ||
        (filters.date === 'overdue' && !!r.date && r.date < today && !r.done) ||
        (filters.date === 'upcoming' && r.date > today) ||
        (filters.date === 'undated' && !r.date)),
  );
}
export function habitStats(habit: Habit, logs: HabitLog[], today = toDay()) {
  const done = new Set(
    logs.filter((l) => l.habitId === habit.id && l.completed && l.date <= today).map((l) => l.date),
  );
  const dates = daysBetween(habit.startDate, today).filter((d) => scheduled(habit, d));
  let longest = 0,
    run = 0;
  for (const date of dates) {
    run = done.has(date) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  const due = [...dates];
  if (due.at(-1) === today && !done.has(today)) due.pop();
  for (const date of due.reverse()) {
    if (!done.has(date)) break;
    current++;
  }
  return {
    current,
    longest,
    completed: dates.filter((d) => done.has(d)).length,
    total: dates.length,
    percent: dates.length
      ? Math.round((dates.filter((d) => done.has(d)).length / dates.length) * 100)
      : 0,
  };
}
export function analytics(data: Snapshot, range: number, today = toDay()) {
  const days = daysBetween(addDays(today, 1 - range), today);
  const trend = days.map((date) => {
    const tasks =
      data.tasks.filter((t) => t.recurrence === 'none' && t.completedDate === date).length +
      data.taskCompletions.filter(
        (c) => toDay(new Date(c.createdAt)) === date && data.tasks.some((t) => t.id === c.taskId),
      ).length;
    const eligible = data.habits.filter((h) => scheduled(h, date));
    const habits = eligible.filter((h) =>
      data.habitLogs.some((l) => l.habitId === h.id && l.date === date && l.completed),
    ).length;
    return { date, tasks, habits, scheduled: eligible.length, activity: tasks + habits };
  });
  const count = trend.reduce((a, d) => a + d.tasks, 0),
    completed = trend.reduce((a, d) => a + d.habits, 0),
    expected = trend.reduce((a, d) => a + d.scheduled, 0);
  const overdue = taskRows(data).filter((r) => !r.done && !!r.date && r.date < today).length;
  const rescheduled = data.tasks
    .map((task) => ({
      task,
      count: data.taskEvents.filter(
        (e) =>
          e.taskId === task.id && e.kind === 'rescheduled' && e.date >= days[0] && e.date <= today,
      ).length,
    }))
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count);
  return {
    trend,
    count,
    overdue,
    consistency: expected ? Math.round((completed / expected) * 100) : 0,
    completed,
    expected,
    rescheduled,
    activeDays: trend.filter((d) => d.activity > 0).length,
  };
}
