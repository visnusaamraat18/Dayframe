import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCheck,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { PageHeading, Empty } from '../components/ui';
import { TaskEditor } from '../components/Editors';
import { TaskRow } from '../components/TaskRow';
import { filterTasks, taskRows, type TaskRow as Row } from '../services/calculations';
import { addDays, dayLabel, parseDay, weekDays } from '../utils/dates';
import type { Task } from '../types';
export default function Tasks() {
  const { data, today, prefs } = useApp();
  const [params] = useSearchParams();
  const [editor, setEditor] = useState<Task | 'new' | null>(null),
    [view, setView] = useState<'list' | 'planner'>(
      params.get('view') === 'planner' ? 'planner' : 'list',
    ),
    [selected, setSelected] = useState(today),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('open'),
    [priority, setPriority] = useState('all'),
    [date, setDate] = useState('all'),
    [category, setCategory] = useState('all');
  const all = taskRows(data),
    source: Row[] =
      status === 'completed' && view === 'list'
        ? [
            ...all.filter((r) => r.task.recurrence === 'none'),
            ...data.taskCompletions.flatMap((c) => {
              const task = data.tasks.find((t) => t.id === c.taskId);
              return task ? [{ task, date: c.date, done: true }] : [];
            }),
          ]
        : view === 'planner'
          ? taskRows(data, selected)
          : all;
  const rows = filterTasks(
      source,
      { search, status, priority, date: view === 'planner' ? 'all' : date, category },
      today,
    ),
    active = all.filter((r) => !r.done).length;
  return (
    <>
      <PageHeading
        eyebrow="A little structure. A clearer mind."
        title="Your tasks"
        text={`${active} open ${active === 1 ? 'task' : 'tasks'}. One thing at a time.`}
      >
        <button className="btn primary" onClick={() => setEditor('new')}>
          <Plus size={17} />
          New task
        </button>
      </PageHeading>
      <div className="toolbar">
        <div className="tabs">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            <List size={16} />
            List view
          </button>
          <button className={view === 'planner' ? 'active' : ''} onClick={() => setView('planner')}>
            <CalendarDays size={16} />
            Planner
          </button>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Find a task…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {view === 'planner' && (
        <div className="planner panel">
          <div className="planner-heading">
            <div>
              <h2>
                {parseDay(selected).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              <p className="muted">Make space for the week ahead.</p>
            </div>
            <div className="flex gap-2">
              <button
                className="icon-btn"
                aria-label="Previous week"
                onClick={() => setSelected(addDays(selected, -7))}
              >
                <ChevronLeft size={18} />
              </button>
              <button className="btn secondary small" onClick={() => setSelected(today)}>
                Today
              </button>
              <button
                className="icon-btn"
                aria-label="Next week"
                onClick={() => setSelected(addDays(selected, 7))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="planner-week">
            {weekDays(selected, prefs.weekStart).map((d) => {
              const count = taskRows(data, d).length;
              return (
                <button
                  key={d}
                  className={`${d === selected ? 'selected' : ''} ${d === today ? 'is-today' : ''}`}
                  onClick={() => setSelected(d)}
                >
                  <span>{parseDay(d).toLocaleDateString('en', { weekday: 'short' })}</span>
                  <strong>{parseDay(d).getDate()}</strong>
                  <small>{count ? `${count} ${count === 1 ? 'task' : 'tasks'}` : '—'}</small>
                </button>
              );
            })}
          </div>
          <label className="planner-date">
            Jump to date
            <input
              aria-label="Planner date"
              type="date"
              min="1900-01-01"
              max="2199-12-31"
              value={selected}
              onInput={(e) => e.currentTarget.value && setSelected(e.currentTarget.value)}
            />
          </label>
        </div>
      )}
      <div className="filter-bar">
        <SlidersHorizontal size={16} />
        <select aria-label="Task status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open tasks</option>
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
        </select>
        <select
          aria-label="Filter priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {view === 'list' && (
          <select aria-label="Filter date" value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="all">Any date</option>
            <option value="today">Due today</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
            <option value="undated">No due date</option>
          </select>
        )}
        <select
          aria-label="Filter category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {[...new Set(data.tasks.map((t) => t.category).filter(Boolean))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="ml-auto muted small-text">
          {rows.length} {rows.length === 1 ? 'result' : 'results'}
        </span>
      </div>
      <section className="panel task-list">
        <div className="panel-header">
          <h2>
            {view === 'planner'
              ? `Your plan · ${dayLabel(selected, prefs.dateFormat)}`
              : status === 'completed'
                ? 'A little proof of progress'
                : 'Everything on your radar'}
          </h2>
          <CheckCheck size={18} className="muted" />
        </div>
        {rows.length ? (
          rows.map((r) => <TaskRow row={r} key={`${r.task.id}-${r.date}`} onEdit={setEditor} />)
        ) : (
          <Empty
            title={data.tasks.length ? 'A clear view.' : 'Good things start with a small task.'}
            text={
              data.tasks.length
                ? 'No tasks match these filters. Try a different date or status.'
                : 'Capture your first to-do and make a little room in your mind.'
            }
            action="Create a task"
            onAction={() => setEditor('new')}
          />
        )}
      </section>
      {editor && (
        <TaskEditor
          task={editor === 'new' ? undefined : editor}
          initialDate={view === 'planner' ? selected : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
