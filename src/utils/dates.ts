import type { Day, Preferences } from '../types';
export const toDay = (date = new Date()): Day =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const parseDay = (day: Day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const addDays = (day: Day, count: number): Day => {
  const date = parseDay(day);
  date.setDate(date.getDate() + count);
  return toDay(date);
};
export const validDay = (value: unknown): value is Day =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value >= '1900-01-01' &&
  value <= '2199-12-31' &&
  toDay(parseDay(value)) === value;
export function daysBetween(start: Day, end: Day): Day[] {
  const dates: Day[] = [];
  for (let date = start; date <= end && dates.length < 110000; date = addDays(date, 1))
    dates.push(date);
  return dates;
}
export const dayLabel = (day: Day, format: Preferences['dateFormat'] = 'day-first'): string =>
  format === 'iso'
    ? day
    : parseDay(day).toLocaleDateString(format === 'month-first' ? 'en-US' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      });
export const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const monthStart = (day: Day): Day => `${day.slice(0, 7)}-01`;
export const monthEnd = (day: Day): Day => {
  const d = parseDay(day);
  d.setMonth(d.getMonth() + 1, 0);
  return toDay(d);
};
export const shiftMonth = (day: Day, amount: number): Day => {
  const d = parseDay(monthStart(day));
  d.setMonth(d.getMonth() + amount);
  return toDay(d);
};
export const weekDays = (day: Day, start: 0 | 1) => {
  const delta = (parseDay(day).getDay() - start + 7) % 7;
  const first = addDays(day, -delta);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
};
