import { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pencil,
  Plus,
  CalendarDays,
  TrendingUp,
  Award,
} from 'lucide-react';
import { PageHeading, Stat, Empty, CheckButton, Progress, Modal } from '../components/ui';
import { HabitEditor, HabitLogEditor, ArchiveHabit } from '../components/Editors';
import { useApp } from '../hooks/useApp';
import { habitStats, scheduled, analytics } from '../services/calculations';
import { logHabit } from '../database/repository';
import {
  monthStart,
  monthEnd,
  daysBetween,
  addDays,
  parseDay,
  shiftMonth,
  dayLabel,
  weekDays,
  weekdayLabels,
} from '../utils/dates';
import type { Habit } from '../types';
export default function Habits() {
  const { data, today, run, reports, streaks } = useApp();
  const [editor, setEditor] = useState<Habit | 'new' | null>(null),
    [showArchive, setShowArchive] = useState(false),
    [archive, setArchive] = useState<Habit | null>(null),
    [history, setHistory] = useState<Habit | null>(null),
    [journal, setJournal] = useState<{ habit: Habit; date: string } | null>(null);
  const active = data.habits.filter((h) => !h.archivedDate),
    visible = data.habits.filter((h) => (showArchive ? !!h.archivedDate : !h.archivedDate));
  const stats = active.map((h) => streaks[h.id] ?? habitStats(h, data.habitLogs, today)),
    week = reports[7] ?? analytics(data, 7, today),
    month = reports[30] ?? analytics(data, 30, today);
  return (
    <>
      <PageHeading
        eyebrow="Your habit journal"
        title="A little better, every day"
        text="Build a rhythm. Keep a promise to yourself. Celebrate the small wins."
      >
        <button className="btn primary" onClick={() => setEditor('new')}>
          <Plus size={17} />
          New habit
        </button>
      </PageHeading>
      <div className="stats-grid four">
        <Stat
          icon={<Flame size={18} />}
          label="Current best streak"
          value={
            <>
              {Math.max(0, ...stats.map((s) => s.current))}
              <span> days</span>
            </>
          }
          detail="Showing up adds up"
        />
        <Stat
          icon={<Award size={18} />}
          label="Longest streak"
          value={
            <>
              {Math.max(0, ...stats.map((s) => s.longest))}
              <span> days</span>
            </>
          }
          detail="Your personal best"
        />
        <Stat
          icon={<TrendingUp size={18} />}
          label="Weekly consistency"
          value={`${week.consistency}%`}
          detail={`${week.completed} of ${week.expected} scheduled`}
        />
        <Stat
          icon={<CalendarDays size={18} />}
          label="Monthly consistency"
          value={`${month.consistency}%`}
          detail={`${month.completed} of ${month.expected} scheduled`}
        />
      </div>
      <div className="toolbar">
        <div className="tabs">
          <button className={!showArchive ? 'active' : ''} onClick={() => setShowArchive(false)}>
            Your habits <span className="count">{active.length}</span>
          </button>
          <button className={showArchive ? 'active' : ''} onClick={() => setShowArchive(true)}>
            <Archive size={15} />
            Archived
          </button>
        </div>
        <span className="muted small-text">Small steps are still steps.</span>
      </div>
      {visible.length ? (
        <div className="habit-grid">
          {visible.map((h) => {
            const s = streaks[h.id] ?? habitStats(h, data.habitLogs, today),
              log = data.habitLogs.find((l) => l.habitId === h.id && l.date === today),
              due = scheduled(h, today) && !h.archivedDate;
            return (
              <section className="panel habit-card" key={h.id}>
                <div className="habit-card-heading">
                  <span
                    className="habit-symbol"
                    style={{ background: `${h.color}1a`, color: h.color }}
                  >
                    <Flame size={22} />
                  </span>
                  <div className="ml-auto flex">
                    <button
                      className="icon-btn"
                      aria-label={`Edit ${h.title}`}
                      onClick={() => setEditor(h)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`${h.archivedDate ? 'Restore' : 'Archive'} ${h.title}`}
                      onClick={() => setArchive(h)}
                    >
                      {h.archivedDate ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                  </div>
                </div>
                <h2>{h.title}</h2>
                <p className="habit-description">
                  {h.description || 'A small commitment to a better day.'}
                </p>
                <div className="habit-schedule">
                  {h.weekdays.length === 7
                    ? 'Every day'
                    : [...h.weekdays]
                        .sort()
                        .map((d) => weekdayLabels[d])
                        .join(' · ')}
                  {h.demo && <span className="demo-label">Demo</span>}
                </div>
                <div className="habit-week">
                  {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => {
                    const done = data.habitLogs.some(
                      (l) => l.habitId === h.id && l.date === d && l.completed,
                    );
                    return (
                      <button
                        key={d}
                        disabled={!scheduled(h, d)}
                        aria-label={`${h.title}, ${dayLabel(d)}${done ? ', complete' : ', incomplete'}`}
                        className={`${done ? 'complete' : ''} ${d === today ? 'is-today' : ''}`}
                        onClick={() => setJournal({ habit: h, date: d })}
                      >
                        <span>{parseDay(d).toLocaleDateString('en', { weekday: 'narrow' })}</span>
                        <span className="habit-day">{done ? '✓' : parseDay(d).getDate()}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="habit-stats">
                  <span>
                    <Flame size={14} />
                    {s.current} day streak
                  </span>
                  <strong>
                    {s.percent}% <small>overall</small>
                  </strong>
                </div>
                <Progress value={s.percent} color={h.color} />
                <div className="habit-card-footer">
                  <button className="text-btn" onClick={() => setHistory(h)}>
                    <CalendarDays size={14} />
                    History & journal
                  </button>
                  {due ? (
                    <div className="habit-checkin">
                      <span>{log?.completed ? 'Done today' : 'Check in'}</span>
                      <CheckButton
                        checked={!!log?.completed}
                        label={`Complete ${h.title}`}
                        onClick={() =>
                          run(
                            () =>
                              logHabit(h, today, {
                                completed: !log?.completed,
                                mood: log?.mood ?? null,
                                note: log?.note ?? '',
                              }),
                            'Habit check-in saved.',
                          )
                        }
                      />
                    </div>
                  ) : (
                    <span className="muted small-text">
                      {h.archivedDate
                        ? 'Archived'
                        : h.startDate > today
                          ? `Starts ${dayLabel(h.startDate)}`
                          : 'Rest day'}
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title={showArchive ? 'A place to pause.' : 'Great days start with small habits.'}
            text={
              showArchive
                ? 'Archived habits will appear here, with their history intact.'
                : 'Choose something simple, set a schedule, and keep showing up.'
            }
            action={showArchive ? undefined : 'Create your first habit'}
            onAction={() => setEditor('new')}
          />
        </section>
      )}
      {editor && (
        <HabitEditor
          habit={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {archive && <ArchiveHabit habit={archive} onClose={() => setArchive(null)} />}
      {history && <HabitHistory habit={history} onClose={() => setHistory(null)} />}
      {journal && (
        <HabitLogEditor
          habit={journal.habit}
          date={journal.date}
          onClose={() => setJournal(null)}
        />
      )}
    </>
  );
}
function HabitHistory({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const { data, today, prefs, streaks } = useApp();
  const [month, setMonth] = useState(monthStart(today)),
    [date, setDate] = useState<string | null>(null);
  const stats = streaks[habit.id] ?? habitStats(habit, data.habitLogs, today),
    logs = data.habitLogs
      .filter((l) => l.habitId === habit.id && l.date.startsWith(month.slice(0, 7)))
      .sort((a, b) => b.date.localeCompare(a.date));
  const first = weekDays(month, prefs.weekStart)[0],
    end = weekDays(monthEnd(month), prefs.weekStart)[6];
  return (
    <Modal title={`${habit.title} · Your history`} onClose={onClose} wide>
      <div className="history-metrics">
        <span>
          <strong>{stats.current}</strong> current streak
        </span>
        <span>
          <strong>{stats.longest}</strong> longest streak
        </span>
        <span>
          <strong>
            {stats.completed}/{stats.total}
          </strong>{' '}
          check-ins
        </span>
        <span>
          <strong>{stats.percent}%</strong> consistency
        </span>
      </div>
      <div className="calendar-heading">
        <button
          className="icon-btn"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <h3>{parseDay(month).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h3>
        <button
          className="icon-btn"
          aria-label="Next month"
          disabled={month >= monthStart(today)}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-grid">
        {weekDays(month, prefs.weekStart).map((d) => (
          <span className="calendar-dayname" key={d}>
            {weekdayLabels[parseDay(d).getDay()]}
          </span>
        ))}
        {daysBetween(first, end).map((d) => {
          const log = data.habitLogs.find((l) => l.habitId === habit.id && l.date === d);
          const available = scheduled(habit, d) && d <= today;
          return (
            <button
              title={
                available
                  ? `${dayLabel(d)}: ${log?.completed ? 'Complete' : 'Not complete'}${log?.note ? ' · Journal entry' : ''}`
                  : 'Not scheduled'
              }
              aria-label={`Journal ${d}`}
              disabled={!available}
              className={`${d.slice(0, 7) !== month.slice(0, 7) ? 'other-month' : ''} ${log?.completed ? 'complete' : ''} ${d === today ? 'is-today' : ''}`}
              key={d}
              onClick={() => setDate(d)}
            >
              <strong>{parseDay(d).getDate()}</strong>
              <small>{log?.completed ? '✓' : available ? '·' : '—'}</small>
            </button>
          );
        })}
      </div>
      <p className="form-hint">
        Select a scheduled date to check in, add a mood, or write a journal entry.
      </p>
      <div className="journal-entries">
        <h3>Words from this month</h3>
        {logs.filter((l) => l.note || l.mood).length ? (
          logs
            .filter((l) => l.note || l.mood)
            .map((l) => (
              <button key={l.id} onClick={() => setDate(l.date)}>
                <span>
                  {dayLabel(l.date, prefs.dateFormat)}
                  {l.mood ? ` · Mood ${l.mood}/5` : ''}
                </span>
                <p>{l.note || 'A quiet check-in.'}</p>
              </button>
            ))
        ) : (
          <p className="muted">Your reflections will find a home here.</p>
        )}
      </div>
      {date && <HabitLogEditor habit={habit} date={date} onClose={() => setDate(null)} />}
    </Modal>
  );
}
