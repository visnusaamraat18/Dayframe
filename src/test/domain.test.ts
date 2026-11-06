import { describe, expect, it } from 'vitest';
import { addDays, toDay, validDay, weekDays } from '../utils/dates';
import {
  habitStats,
  scheduled,
  taskRows,
  occurrenceDates,
  effectiveDate,
  filterTasks,
  analytics,
} from '../services/calculations';
import { demoSnapshot } from '../services/demo';
import { emptySnapshot, type Task, type Habit, type HabitLog, type TaskCompletion } from '../types';
const stamp = '2026-10-28T12:00:00.000Z';
const task: Task = {
  id: 'task',
  createdAt: stamp,
  title: 'Study',
  description: '',
  category: 'Study',
  priority: 'high',
  dueDate: '2026-10-28',
  dueTime: '',
  recurrence: 'none',
  completedAt: null,
  completedDate: null,
};
const habit: Habit = {
  id: 'habit',
  createdAt: stamp,
  title: 'Read',
  description: '',
  weekdays: [1, 3, 5],
  startDate: '2026-10-23',
  archivedDate: null,
  color: '#b8edbe',
};
const logs = (dates: string[]): HabitLog[] =>
  dates.map((date) => ({
    id: date,
    habitId: habit.id,
    date,
    createdAt: stamp,
    completed: true,
    mood: null,
    note: '',
  }));
describe('local calendar rules', () => {
  it('crosses leap days, month ends, year ends, and DST calendar dates', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(toDay(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28');
  });
  it('rejects invalid calendar dates', () => {
    expect(validDay('2026-02-30')).toBe(false);
    expect(validDay('2026-2-3')).toBe(false);
    expect(validDay('2024-02-29')).toBe(true);
    expect(validDay('2200-01-01')).toBe(false);
  });
  it('honors Monday and Sunday week starts', () => {
    expect(weekDays('2026-10-28', 1)[0]).toBe('2026-10-26');
    expect(weekDays('2026-10-28', 0)[0]).toBe('2026-10-25');
  });
});
describe('tasks and recurrence', () => {
  it('filters real task fields, priority, category and overdue dates', () => {
    const data = {
      ...structuredClone(emptySnapshot),
      tasks: [
        task,
        { ...task, id: 'future', priority: 'low' as const, dueDate: '2026-10-30' },
        { ...task, id: 'undated', dueDate: '' },
      ],
    };
    const rows = taskRows(data);
    expect(
      filterTasks(
        rows,
        { search: 'STUDY', status: 'open', priority: 'high', date: 'overdue' },
        '2026-10-29',
      ).map((r) => r.task.id),
    ).toEqual(['task']);
    expect(
      filterTasks(rows, { search: '', status: 'all', priority: 'all', date: 'undated' }),
    ).toHaveLength(1);
    expect(
      filterTasks(
        rows,
        { search: '', status: 'all', priority: 'all', date: 'upcoming' },
        '2026-10-29',
      ),
    ).toHaveLength(1);
  });
  it('generates daily occurrences only within the requested range', () => {
    expect(occurrenceDates({ ...task, recurrence: 'daily' }, '2026-10-27', '2026-10-30')).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
    ]);
  });
  it('generates weekly occurrences across a year boundary', () => {
    expect(
      occurrenceDates(
        { ...task, dueDate: '2026-12-30', recurrence: 'weekly' },
        '2027-01-01',
        '2027-01-15',
      ),
    ).toEqual(['2027-01-06', '2027-01-13']);
  });
  it('advances a recurring task through recorded completions without cloning the task', () => {
    const recurring = { ...task, recurrence: 'daily' as const };
    const completions: TaskCompletion[] = ['2026-10-28', '2026-10-29'].map((date) => ({
      id: date,
      createdAt: stamp,
      taskId: task.id,
      date,
    }));
    expect(effectiveDate(recurring, completions)).toBe('2026-10-30');
    expect(effectiveDate(recurring, completions.slice(1))).toBe('2026-10-28');
    const data = {
      ...structuredClone(emptySnapshot),
      tasks: [recurring],
      taskCompletions: completions,
    };
    expect(taskRows(data)).toHaveLength(1);
    expect(taskRows(data, '2026-10-29')[0].done).toBe(true);
  });
  it('retains non-recurring completed tasks in date views', () => {
    expect(
      taskRows(
        {
          ...structuredClone(emptySnapshot),
          tasks: [{ ...task, completedAt: stamp, completedDate: task.dueDate }],
        },
        task.dueDate,
      )[0].done,
    ).toBe(true);
  });
});
describe('habit schedules and streaks', () => {
  it('respects selected weekdays, start date and archive boundary', () => {
    expect(scheduled(habit, '2026-10-21')).toBe(false);
    expect(scheduled(habit, '2026-10-23')).toBe(true);
    expect(scheduled(habit, '2026-10-24')).toBe(false);
    expect(scheduled({ ...habit, archivedDate: '2026-10-23' }, '2026-10-26')).toBe(false);
  });
  it('ignores rest days when computing consecutive scheduled streaks', () => {
    expect(
      habitStats(habit, logs(['2026-10-23', '2026-10-26', '2026-10-28']), '2026-10-28'),
    ).toEqual({ current: 3, longest: 3, completed: 3, total: 3, percent: 100 });
  });
  it('does not break the streak until today has passed', () => {
    expect(habitStats(habit, logs(['2026-10-23', '2026-10-26']), '2026-10-28').current).toBe(2);
    expect(habitStats(habit, logs(['2026-10-23', '2026-10-26']), '2026-10-29').current).toBe(0);
  });
  it('breaks on missed scheduled days while preserving longest streak', () => {
    const s = habitStats(habit, logs(['2026-10-23', '2026-10-26', '2026-10-30']), '2026-10-30');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
    expect(s.percent).toBe(75);
  });
  it('handles new and future habits without fictional progress', () => {
    expect(habitStats({ ...habit, startDate: '2026-11-01' }, [], '2026-10-28')).toEqual({
      current: 0,
      longest: 0,
      completed: 0,
      total: 0,
      percent: 0,
    });
  });
  it('handles daily streaks over month and year boundaries and ignores duplicate input logs', () => {
    const h = { ...habit, startDate: '2026-12-30', weekdays: [0, 1, 2, 3, 4, 5, 6] };
    const entries = logs(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-01']);
    const s = habitStats(h, entries, '2027-01-01');
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
    expect(s.percent).toBe(100);
  });
});
describe('analytics', () => {
  it('counts overdue recurring work on the actual completion day', () => {
    const data = {
      ...structuredClone(emptySnapshot),
      tasks: [{ ...task, dueDate: '2026-10-20', recurrence: 'daily' as const }],
      taskCompletions: [{ id: 'late', taskId: task.id, date: '2026-10-21', createdAt: stamp }],
    };
    const result = analytics(data, 30, '2026-10-28');
    expect(result.trend.find((d) => d.date === '2026-10-21')?.tasks).toBe(0);
    expect(result.trend.at(-1)?.tasks).toBe(1);
  });
  it('returns zeroes for an empty database', () => {
    const result = analytics(emptySnapshot, 7, '2026-10-28');
    expect(result.count).toBe(0);
    expect(result.consistency).toBe(0);
    expect(result.trend).toHaveLength(7);
    expect(result.expected).toBe(0);
  });
  it('counts stored completions, overdue tasks and rescheduling within the chosen range', () => {
    const data = demoSnapshot('2026-10-28');
    const seven = analytics(data, 7, '2026-10-28'),
      thirty = analytics(data, 30, '2026-10-28');
    expect(seven.count).toBeLessThan(thirty.count);
    expect(seven.overdue).toBe(2);
    expect(seven.rescheduled[0].count).toBe(3);
    expect(seven.consistency).toBeGreaterThan(0);
    expect(seven.consistency).toBeLessThanOrEqual(100);
  });
  it('counts recurring completions once for their occurrence date', () => {
    const data = {
      ...structuredClone(emptySnapshot),
      tasks: [{ ...task, recurrence: 'daily' as const }],
      taskCompletions: [{ id: 'c', taskId: task.id, date: '2026-10-28', createdAt: stamp }],
    };
    expect(analytics(data, 7, '2026-10-28').count).toBe(1);
  });
});
