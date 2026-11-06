import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  CircleCheck,
  Flame,
  Flag,
  Plus,
  Sparkles,
  Sun,
  Sunset,
  CalendarDays,
  ArrowDown,
  Check,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import {
  Empty,
  Modal,
  PageHeading,
  Progress,
  SectionTitle,
  Stat,
  CheckButton,
  Confirm,
} from '../components/ui';
import { TaskRow } from '../components/TaskRow';
import { TaskEditor, HabitLogEditor } from '../components/Editors';
import { analytics, taskRows, scheduled, habitStats } from '../services/calculations';
import { logHabit } from '../database/repository';
import { saveReview, rescheduleTasks } from '../database/repository';
import { addDays, dayLabel, parseDay } from '../utils/dates';
import type { Habit, Task } from '../types';
export default function Today({ onCapture }: { onCapture: () => void }) {
  const { data, today, run, reports, streaks } = useApp(),
    navigate = useNavigate();
  const [editor, setEditor] = useState<Task | 'new' | null>(null),
    [journal, setJournal] = useState<Habit | null>(null),
    [review, setReview] = useState(false);
  const rows = taskRows(data),
    todays = taskRows(data, today),
    overdue = rows.filter((r) => !r.done && r.date && r.date < today),
    upcoming = rows.filter((r) => !r.done && r.date > today).slice(0, 4),
    priorities = rows.filter((r) => !r.done && r.task.priority === 'high').slice(0, 4),
    habits = data.habits.filter((h) => !h.archivedDate && scheduled(h, today));
  const doneTasks = todays.filter((r) => r.done).length,
    doneHabits = habits.filter((h) =>
      data.habitLogs.some((l) => l.habitId === h.id && l.date === today && l.completed),
    ).length,
    total = todays.length + habits.length,
    done = doneTasks + doneHabits,
    progress = total ? Math.round((done / total) * 100) : 0;
  const week = reports[7] ?? analytics(data, 7, today),
    bestStreak = Math.max(
      0,
      ...data.habits.map((h) => (streaks[h.id] ?? habitStats(h, data.habitLogs, today)).current),
    );
  const hour = new Date().getHours(),
    greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <PageHeading
        eyebrow={parseDay(today).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        title={greeting}
        text="A fresh perspective. A little intention. A day that’s yours."
      >
        <button className="btn secondary" onClick={() => setReview(true)}>
          <Sunset size={16} />
          Daily review
        </button>
        <button className="btn primary" onClick={onCapture}>
          <Plus size={17} />
          Quick capture
        </button>
      </PageHeading>
      <div className="today-layout">
        <div className="today-main">
          <section className="day-hero">
            <div className="hero-copy">
              <span className="mini-label">
                <span className="status-dot" />
                YOUR DAY, AT A GLANCE
              </span>
              <h2>
                Small steps.
                <br />
                <span>Meaningful progress.</span>
              </h2>
              <p>
                {total
                  ? `${done} of ${total} daily commitments complete. Keep moving at your own pace.`
                  : 'Your day is a blank canvas. Start with one thing that matters.'}
              </p>
              <button className="hero-link" onClick={() => navigate('/tasks')}>
                Let’s make a little progress
                <ArrowRight size={17} />
              </button>
            </div>
            <div
              className="progress-ring"
              style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}
            >
              <div>
                <span className="ring-sparkle">
                  <Sparkles size={19} />
                </span>
                <strong>
                  {progress}
                  <small>%</small>
                </strong>
                <span>daily progress</span>
              </div>
            </div>
            <div className="hero-footer">
              <span>
                <Check size={14} />
                {doneTasks}/{todays.length} tasks
              </span>
              <span>
                <Check size={14} />
                {doneHabits}/{habits.length} habits
              </span>
              <span className="hero-footer-right">A little better, every day.</span>
            </div>
          </section>
          <div className="stats-grid">
            <Stat
              label="Tasks completed"
              value={doneTasks}
              detail={`${todays.length} scheduled for today`}
              icon={<CircleCheck size={17} />}
            />
            <Stat
              label="Habits checked in"
              value={
                <>
                  {doneHabits}
                  <span>/{habits.length}</span>
                </>
              }
              detail="Build a rhythm that lasts"
              icon={<Flame size={17} />}
            />
            <Stat
              label="Need your attention"
              value={overdue.length}
              detail="Overdue tasks to revisit"
              icon={<Flag size={17} />}
              tone={overdue.length ? 'stat-warm' : ''}
            />
          </div>
          <section className="dashboard-section">
            <SectionTitle
              title="Today’s focus"
              count={priorities.length}
              action="All tasks"
              onAction={() => navigate('/tasks')}
            />
            <div className="panel focus-panel">
              <div className="focus-caption">
                <span>
                  <span className="priority-dot" />
                  YOUR HIGH PRIORITIES
                </span>
                <span>Make space for what matters.</span>
              </div>
              {priorities.length ? (
                priorities.map((r) => <TaskRow key={r.task.id} row={r} onEdit={setEditor} />)
              ) : (
                <Empty
                  compact
                  title="Choose what matters today."
                  text="Give a task high priority to keep it in focus."
                  action="Add a priority"
                  onAction={() => setEditor('new')}
                />
              )}
            </div>
          </section>
          <section className="dashboard-section">
            <SectionTitle
              title="On the agenda"
              count={todays.length}
              action="Open planner"
              onAction={() => navigate('/tasks?view=planner')}
            />
            <div className="panel">
              {todays.length ? (
                todays.map((r) => <TaskRow key={r.task.id} row={r} onEdit={setEditor} />)
              ) : (
                <Empty
                  compact
                  title="A little breathing room."
                  text="No tasks due today. Add one, or enjoy the space."
                  action="Plan a task"
                  onAction={() => setEditor('new')}
                />
              )}
            </div>
          </section>
          {overdue.length > 0 && (
            <section className="dashboard-section">
              <SectionTitle title="A gentle nudge" count={overdue.length} />
              <div className="panel">
                {overdue.slice(0, 4).map((r) => (
                  <TaskRow key={r.task.id} row={r} onEdit={setEditor} />
                ))}
                {overdue.length > 4 && (
                  <button className="text-btn panel-bottom-link" onClick={() => navigate('/tasks')}>
                    See all overdue tasks
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            </section>
          )}
          <section className="planning-note">
            <span className="planning-note-icon">
              <Sparkles size={21} />
            </span>
            <div>
              <h3>A little direction for your day</h3>
              <p>
                {overdue.length
                  ? `Start by reviewing ${overdue.length} overdue ${overdue.length === 1 ? 'task' : 'tasks'}. Decide what still matters, then choose a realistic date.`
                  : priorities.length
                    ? `You’ve picked ${priorities.length} high priorities. Protect a little focused time for the first one.`
                    : todays.length
                      ? 'Pick one task to start with. You don’t need to do everything at once.'
                      : 'Capture one task, set a date, and give yourself a clear place to start.'}
                {habits.length - doneHabits > 0
                  ? ` ${habits.length - doneHabits} scheduled habits are still waiting for a check-in.`
                  : ''}
              </p>
            </div>
          </section>
        </div>
        <aside className="today-aside">
          <section className="panel habit-today">
            <div className="panel-header">
              <h2>Your daily rhythm</h2>
              <span className="icon-tint">
                <Flame size={18} />
              </span>
            </div>
            <p className="panel-subtitle">Consistency is a quiet superpower.</p>
            {habits.length ? (
              <div className="today-habits">
                {habits.map((h) => {
                  const log = data.habitLogs.find((l) => l.habitId === h.id && l.date === today);
                  return (
                    <div className={`today-habit ${log?.completed ? 'done' : ''}`} key={h.id}>
                      <span className="habit-marker" style={{ background: h.color }} />
                      <button className="habit-title" onClick={() => setJournal(h)}>
                        {h.title}
                        <small>
                          {(streaks[h.id] ?? habitStats(h, data.habitLogs, today)).current} day
                          streak {h.demo ? '· Demo' : ''}
                        </small>
                      </button>
                      <CheckButton
                        checked={!!log?.completed}
                        label={`Check in ${h.title}`}
                        onClick={() =>
                          run(
                            () =>
                              logHabit(h, today, {
                                completed: !log?.completed,
                                mood: log?.mood ?? null,
                                note: log?.note ?? '',
                              }),
                            log?.completed ? 'Check-in undone.' : 'A small promise, kept.',
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                compact
                title="Find your rhythm."
                text="A tiny daily habit can make a big difference."
                action="Create a habit"
                onAction={() => navigate('/habits')}
              />
            )}
            <div className="habit-summary">
              <span>
                {doneHabits} of {habits.length} complete
              </span>
              <strong>{habits.length ? Math.round((doneHabits / habits.length) * 100) : 0}%</strong>
            </div>
            <Progress value={habits.length ? (doneHabits / habits.length) * 100 : 0} />
            <button className="text-btn panel-bottom-link" onClick={() => navigate('/habits')}>
              Visit your habit journal
              <ArrowUpRight size={15} />
            </button>
          </section>
          <section className="panel week-glance">
            <div className="panel-header">
              <h2>The bigger picture</h2>
              <ArrowUpRight size={17} className="muted" />
            </div>
            <div className="week-chart">
              {week.trend.map((d) => (
                <div key={d.date} title={`${d.date}: ${d.activity} completions`}>
                  <span
                    style={{
                      height: `${Math.max(5, (d.activity / Math.max(1, ...week.trend.map((d) => d.activity))) * 70)}px`,
                    }}
                    className={d.date === today ? 'current' : ''}
                  />
                  <small>{parseDay(d.date).toLocaleDateString('en', { weekday: 'narrow' })}</small>
                </div>
              ))}
            </div>
            <div className="week-numbers">
              <div>
                <strong>{week.count}</strong>
                <span>tasks this week</span>
              </div>
              <div>
                <strong>
                  {bestStreak}
                  <small> days</small>
                </strong>
                <span>best current streak</span>
              </div>
            </div>
            <button className="text-btn panel-bottom-link" onClick={() => navigate('/insights')}>
              Explore your insights
              <ArrowUpRight size={15} />
            </button>
          </section>
          <section className="upcoming">
            <SectionTitle title="Coming up" />
            <div className="upcoming-list">
              {upcoming.length ? (
                upcoming.map((r) => (
                  <button key={r.task.id} onClick={() => setEditor(r.task)}>
                    <span className="upcoming-date">
                      <strong>{parseDay(r.date).getDate()}</strong>
                      <small>{parseDay(r.date).toLocaleDateString('en', { month: 'short' })}</small>
                    </span>
                    <span>
                      {r.task.title}
                      <small>
                        {r.task.category || 'Your next step'}
                        {r.task.demo ? ' · Demo' : ''}
                      </small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))
              ) : (
                <div className="quiet-empty">
                  <CalendarDays size={18} />
                  <p>
                    No upcoming deadlines.
                    <br />
                    <span>A little room to look ahead.</span>
                  </p>
                </div>
              )}
            </div>
          </section>
          <div className="daily-quote">
            <Sun size={22} strokeWidth={1.3} />
            <p>“You don’t have to see the whole staircase. Just take the first step.”</p>
            <span>MAKE TODAY A LITTLE MEANINGFUL</span>
          </div>
        </aside>
      </div>
      <footer className="page-footer">
        <span>
          <span className="status-dot" />
          Saved by Python on this device
        </span>
        <span>Capture. Plan. Act. Review.</span>
      </footer>
      {editor && (
        <TaskEditor
          task={editor === 'new' ? undefined : editor}
          initialDate={today}
          onClose={() => setEditor(null)}
        />
      )}
      {journal && <HabitLogEditor habit={journal} date={today} onClose={() => setJournal(null)} />}
      {review && <DailyReview onClose={() => setReview(false)} />}
    </>
  );
}
function DailyReview({ onClose }: { onClose: () => void }) {
  const { data, today, run } = useApp(),
    existing = data.reviews.find((r) => r.date === today);
  const [note, setNote] = useState(existing?.note ?? ''),
    [mood, setMood] = useState<number | null>(existing?.mood ?? null),
    [selected, setSelected] = useState<string[]>([]),
    [reschedule, setReschedule] = useState(false),
    [target, setTarget] = useState(addDays(today, 1));
  const unfinished = taskRows(data).filter(
    (r) => !r.done && r.date && r.date <= today && r.task.recurrence === 'none',
  );
  return (
    <Modal title="Close the day with a little clarity." onClose={onClose}>
      <p className="muted">Notice your progress. Let tomorrow start fresh.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () => saveReview({ date: today, note, mood, updatedAt: new Date().toISOString() }),
              'Your day, reflected.',
            )
          )
            onClose();
        }}
      >
        <label>
          How was your day?
          <select
            value={mood ?? ''}
            onChange={(e) => setMood(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Choose a mood (optional)</option>
            {['Tough', 'Low', 'Okay', 'Good', 'Great'].map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          What went well? What’s on your mind?
          <textarea
            rows={4}
            maxLength={100000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Even a small win is worth noticing."
          />
        </label>
        {unfinished.length > 0 && (
          <div className="review-reschedule">
            <h3>Give unfinished tasks a new home</h3>
            {unfinished.map((r) => (
              <label key={r.task.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selected.includes(r.task.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, r.task.id]
                        : selected.filter((id) => id !== r.task.id),
                    )
                  }
                />
                {r.task.title}
              </label>
            ))}
            <label>
              New due date
              <input
                type="date"
                required
                value={target}
                min={today}
                max="2199-12-31"
                onInput={(e) => setTarget(e.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={!selected.length || !target}
              className="btn secondary small"
              onClick={() => setReschedule(true)}
            >
              <ArrowDown size={14} />
              Reschedule {selected.length} selected
            </button>
          </div>
        )}
        <div className="form-actions">
          <button className="btn secondary" type="button" onClick={onClose}>
            Close
          </button>
          <button className="btn primary">
            <CheckCheck size={16} />
            Save reflection
          </button>
        </div>
      </form>
      {data.reviews.filter((r) => r.date < today).length > 0 && (
        <details className="history">
          <summary>Previous reflections</summary>
          {data.reviews
            .filter((r) => r.date < today)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 14)
            .map((r) => (
              <div key={r.date}>
                <h4>
                  {dayLabel(r.date)}
                  {r.mood ? ` · Mood ${r.mood}/5` : ''}
                </h4>
                <p className="whitespace-pre-wrap">{r.note || 'No written reflection.'}</p>
              </div>
            ))}
        </details>
      )}
      {reschedule && (
        <Confirm
          danger={false}
          title="Move these deadlines?"
          description={`${selected.length} selected tasks will move to ${dayLabel(target)}. You can edit them again anytime.`}
          onClose={() => setReschedule(false)}
          onConfirm={async () => {
            await rescheduleTasks(selected, target);
            setSelected([]);
          }}
        />
      )}
    </Modal>
  );
}
