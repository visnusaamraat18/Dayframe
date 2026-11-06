import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { Activity, CheckCheck, Flag, Flame, TrendingUp, ArrowUpRight, Repeat2 } from 'lucide-react';
import { PageHeading, Stat, Empty, Progress } from '../components/ui';
import { useApp } from '../hooks/useApp';
import { analytics, habitStats } from '../services/calculations';
import { dayLabel } from '../utils/dates';
export default function Insights() {
  const { data, today, reports, streaks } = useApp();
  const [range, setRange] = useState(7);
  const stats = reports[range] ?? analytics(data, range, today),
    habits = data.habits.map((habit) => ({
      habit,
      ...(streaks[habit.id] ?? habitStats(habit, data.habitLogs, today)),
    })),
    topStreak = Math.max(0, ...habits.map((h) => h.current));
  const tooltip = {
    background: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 12,
  };
  return (
    <>
      <PageHeading
        eyebrow="A little perspective"
        title="See how far you’ve come"
        text="Progress isn’t always loud. Here’s a little proof of yours."
      >
        <div className="tabs range-tabs">
          {[7, 30, 90].map((n) => (
            <button className={range === n ? 'active' : ''} key={n} onClick={() => setRange(n)}>
              Last {n} days
            </button>
          ))}
        </div>
      </PageHeading>
      <div className="stats-grid four">
        <Stat
          label="Tasks completed"
          value={stats.count}
          detail={`Across the last ${range} days`}
          icon={<CheckCheck size={18} />}
        />
        <Stat
          label="Tasks overdue"
          value={stats.overdue}
          detail="Open tasks that need a new plan"
          icon={<Flag size={17} />}
          tone="stat-warm"
        />
        <Stat
          label="Habit consistency"
          value={`${stats.consistency}%`}
          detail={`${stats.completed} of ${stats.expected} scheduled`}
          icon={<TrendingUp size={17} />}
        />
        <Stat
          label="Current best streak"
          value={
            <>
              {topStreak}
              <span> days</span>
            </>
          }
          detail="Across all of your habits"
          icon={<Flame size={17} />}
        />
      </div>
      <div className="insights-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Small wins, over time</h2>
              <p className="panel-subtitle">Your daily task completions</p>
            </div>
            <span className="chart-legend">
              <i />
              Tasks
            </span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend} margin={{ top: 12, right: 14, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="taskFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b8edbe" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#b8edbe" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => dayLabel(d)}
                  minTickGap={25}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                />
                <Tooltip contentStyle={tooltip} labelFormatter={(d) => dayLabel(String(d))} />
                <Area
                  type="monotone"
                  name="Tasks"
                  dataKey="tasks"
                  stroke="#b8edbe"
                  strokeWidth={2}
                  fill="url(#taskFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote">
            <Activity size={14} />
            {stats.activeDays} active {stats.activeDays === 1 ? 'day' : 'days'} in this period
            <span className="ml-auto">Every check-in counts.</span>
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Finding your rhythm</h2>
              <p className="panel-subtitle">Habit check-ins against your schedule</p>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trend} margin={{ top: 12, right: 14, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => dayLabel(d)}
                  minTickGap={30}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                />
                <Tooltip contentStyle={tooltip} labelFormatter={(d) => dayLabel(String(d))} />
                <Bar
                  dataKey="scheduled"
                  name="Scheduled"
                  fill="var(--chart-muted)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="habits"
                  name="Complete"
                  fill="#9bd5e7"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote">
            <span className="chart-legend blue">
              <i />
              Completed
            </span>
            <span className="chart-legend gray">
              <i />
              Scheduled
            </span>
          </div>
        </section>
      </div>
      <div className="insights-grid lower">
        <section className="panel">
          <div className="panel-header">
            <h2>The habits you’re building</h2>
            <Flame size={17} className="muted" />
          </div>
          {habits.length ? (
            <div className="habit-insights">
              <div className="habit-table-head">
                <span>Habit</span>
                <span>Current</span>
                <span>Best</span>
                <span>Consistency</span>
              </div>
              {habits.map((h) => (
                <div className="habit-table-row" key={h.habit.id}>
                  <span>
                    <i style={{ background: h.habit.color }} />
                    {h.habit.title}
                    <small>
                      {h.habit.archivedDate ? 'Archived' : h.habit.demo ? 'Demo' : 'Active'}
                    </small>
                  </span>
                  <strong>
                    {h.current}
                    <small> days</small>
                  </strong>
                  <strong>
                    {h.longest}
                    <small> days</small>
                  </strong>
                  <div>
                    <strong>{h.percent}%</strong>
                    <Progress value={h.percent} color={h.habit.color} />
                  </div>
                </div>
              ))}
              <p className="form-hint">
                Streaks and overall consistency use each habit’s schedule from its start date.
              </p>
            </div>
          ) : (
            <Empty
              compact
              title="Your rhythm starts with one habit."
              text="Create a habit to see your consistency grow over time."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Worth a second look</h2>
            <Repeat2 size={17} className="muted" />
          </div>
          <p className="panel-subtitle">Tasks moved more than once in this period</p>
          {stats.rescheduled.length ? (
            <div className="rescheduled-list">
              {stats.rescheduled.map((r) => (
                <div key={r.task.id}>
                  <div>
                    <h3>{r.task.title}</h3>
                    <span>
                      {r.task.category || 'Uncategorized'}
                      {r.task.demo ? ' · Demo' : ''}
                    </span>
                  </div>
                  <span className="count">{r.count} moves</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              compact
              title="A little more clarity."
              text="No frequently rescheduled tasks in this period. Move a deadline when you need to; the history stays here."
            />
          )}
          <div className="insight-tip">
            <ArrowUpRight size={17} />
            <p>If a task keeps moving, try making the next step smaller.</p>
          </div>
        </section>
      </div>
      {!stats.count && !stats.completed && (
        <p className="muted small-text mt-6">
          These charts reflect your stored records. Complete tasks and scheduled habits to see
          activity here. Optional, clearly labeled demonstration data is available in Settings.
        </p>
      )}
    </>
  );
}
