import { useState } from 'react';
import { ChevronDown, Plus, Repeat2, Trash2, Undo2 } from 'lucide-react';
import { Modal, Confirm } from './ui';
import type { Task, Habit, Note, HabitLog } from '../types';
import {
  saveTask,
  deleteTask,
  saveHabit,
  deleteHabit,
  saveNote,
  createChecklist,
  logHabit,
  completeTask,
} from '../database/repository';
import { useApp } from '../hooks/useApp';
import { weekdayLabels, dayLabel } from '../utils/dates';
import { archiveHabit } from '../database/repository';
export type CaptureKind = 'task' | 'habit' | 'note' | 'checklist';
export function Capture({
  onClose,
  initial = 'task',
}: {
  onClose: () => void;
  initial?: CaptureKind;
}) {
  const [kind, setKind] = useState<CaptureKind>(initial);
  return (
    <Modal title="A little space for what’s next." onClose={onClose}>
      <div className="tabs capture-tabs">
        {(['task', 'note', 'checklist', 'habit'] as const).map((k) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
            {k === 'checklist' ? 'Checklist' : k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      {kind === 'task' ? (
        <TaskForm onClose={onClose} quick />
      ) : kind === 'habit' ? (
        <HabitForm onClose={onClose} />
      ) : kind === 'note' ? (
        <NoteForm onClose={onClose} />
      ) : (
        <ListForm onClose={onClose} />
      )}
    </Modal>
  );
}
export function TaskEditor({
  task,
  onClose,
  initialDate,
}: {
  task?: Task;
  onClose: () => void;
  initialDate?: string;
}) {
  return (
    <Modal title={task ? 'Task details' : 'Make room for a new task'} onClose={onClose}>
      <TaskForm task={task} onClose={onClose} initialDate={initialDate} />
    </Modal>
  );
}
function TaskForm({
  task,
  onClose,
  quick = false,
  initialDate,
}: {
  task?: Task;
  onClose: () => void;
  quick?: boolean;
  initialDate?: string;
}) {
  const { run, data, today } = useApp();
  const [title, setTitle] = useState(task?.title ?? ''),
    [description, setDescription] = useState(task?.description ?? ''),
    [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'medium'),
    [category, setCategory] = useState(task?.category ?? ''),
    [date, setDate] = useState(task?.dueDate ?? initialDate ?? ''),
    [time, setTime] = useState(task?.dueTime ?? ''),
    [recurrence, setRecurrence] = useState<Task['recurrence']>(task?.recurrence ?? 'none'),
    [details, setDetails] = useState(!quick),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  const events = data.taskEvents
    .filter((e) => e.taskId === task?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const completions = data.taskCompletions
    .filter((c) => c.taskId === task?.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await run(
            () =>
              saveTask(
                {
                  title,
                  description,
                  category,
                  priority,
                  dueDate: date,
                  dueTime: time,
                  recurrence,
                },
                task,
              ),
            task ? 'Task updated.' : 'A fresh task, captured.',
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label>
          What’s on your mind?
          <input
            data-autofocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Finish the project proposal"
          />
        </label>
        {quick && (
          <button
            type="button"
            className="text-btn details-toggle"
            onClick={() => setDetails(!details)}
          >
            <ChevronDown size={15} />
            {details ? 'Fewer details' : 'Add a date, priority, or more'}
          </button>
        )}
        {details && (
          <>
            <label>
              Description
              <textarea
                maxLength={100000}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A little context goes a long way…"
              />
            </label>
            <div className="form-grid">
              <label>
                {recurrence !== 'none' ? 'First due date' : 'Due date'}
                <input
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  required={recurrence !== 'none'}
                  value={date}
                  onInput={(e) => {
                    setDate(e.currentTarget.value);
                    if (!e.currentTarget.value) setTime('');
                  }}
                />
              </label>
              <label>
                Time <span className="muted">(optional)</span>
                <input
                  type="time"
                  disabled={!date}
                  value={time}
                  onInput={(e) => setTime(e.currentTarget.value)}
                />
              </label>
              <label>
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Task['priority'])}
                >
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
              </label>
              <label>
                Category
                <input
                  maxLength={80}
                  list="task-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Personal, Study, Work…"
                />
                <datalist id="task-categories">
                  {[...new Set(data.tasks.map((t) => t.category).filter(Boolean))].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            </div>
            <label>
              Repeat
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Task['recurrence'])}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </label>
            {recurrence !== 'none' && (
              <p className="form-hint">
                <Repeat2 size={13} />
                Each scheduled date is a separate completion. Editing the first due date changes the
                series schedule.
              </p>
            )}
          </>
        )}
        <div className="form-actions">
          {task && (
            <button
              type="button"
              className="icon-btn danger-text mr-auto"
              aria-label="Delete task"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
            </button>
          )}
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="btn primary" type="submit">
            <Plus size={16} />
            {busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
      {task && (
        <details className="history">
          <summary>Activity & recurring completions</summary>
          {completions.map((c) => (
            <div className="history-row" key={c.id}>
              <span>Completed {dayLabel(c.date)}</span>
              <button
                className="text-btn"
                onClick={() => run(() => completeTask(task, c.date, false), 'Completion undone.')}
              >
                <Undo2 size={13} />
                Undo
              </button>
            </div>
          ))}
          {events.slice(0, 30).map((e) => (
            <p key={e.id}>
              <time>{dayLabel(e.date)}</time> {e.kind}: {e.detail}
            </p>
          ))}
          {!events.length && !completions.length && <p>No recorded activity yet.</p>}
          {task.recurrence !== 'none' && (
            <p>
              Current date: {today}. Future occurrences can be completed on their scheduled day.
            </p>
          )}
        </details>
      )}
      {deleting && task && (
        <Confirm
          title="Delete this task?"
          description="This permanently removes the task and its completion history."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await deleteTask(task.id);
            onClose();
          }}
        />
      )}
    </>
  );
}
export function HabitEditor({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  return (
    <Modal title={habit ? 'Edit your habit' : 'Small steps. Lasting change.'} onClose={onClose}>
      <HabitForm habit={habit} onClose={onClose} />
    </Modal>
  );
}
function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { run, today } = useApp();
  const [title, setTitle] = useState(habit?.title ?? ''),
    [description, setDescription] = useState(habit?.description ?? ''),
    [weekdays, setWeekdays] = useState(habit?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]),
    [start, setStart] = useState(habit?.startDate ?? today),
    [color, setColor] = useState(habit?.color ?? '#b8edbe'),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await run(
            () => saveHabit({ title, description, weekdays, startDate: start, color }, habit),
            'Habit saved. Keep showing up.',
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label>
          Habit name
          <input
            data-autofocus
            required
            maxLength={200}
            placeholder="e.g. Read for 20 minutes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          A little intention
          <textarea
            rows={2}
            maxLength={100000}
            placeholder="Why does this matter to you?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Make it a rhythm</legend>
          <div className="weekday-picker">
            {weekdayLabels.map((d, i) => (
              <button
                type="button"
                key={d}
                aria-pressed={weekdays.includes(i)}
                className={weekdays.includes(i) ? 'selected' : ''}
                onClick={() =>
                  setWeekdays(
                    weekdays.includes(i) ? weekdays.filter((w) => w !== i) : [...weekdays, i],
                  )
                }
              >
                {d}
              </button>
            ))}
          </div>
          <p className="form-hint">Select every day, or just the days that fit your life.</p>
        </fieldset>
        <div className="form-grid">
          <label>
            Start date
            <input
              type="date"
              required
              min="1900-01-01"
              max="2199-12-31"
              value={start}
              onInput={(e) => setStart(e.currentTarget.value)}
            />
          </label>
          <label>
            Habit color
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="#b8edbe">Sage</option>
              <option value="#9bd5e7">Sky</option>
              <option value="#c4b2ef">Lavender</option>
              <option value="#e4c48f">Sand</option>
              <option value="#eeaaa1">Rose</option>
            </select>
          </label>
        </div>
        {habit && (
          <p className="form-hint">
            Schedule changes recalculate history against the new weekdays. Existing journal entries
            are kept.
          </p>
        )}
        <div className="form-actions">
          {habit && (
            <button
              type="button"
              className="icon-btn danger-text mr-auto"
              aria-label="Delete habit"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
            </button>
          )}
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn primary">
            {busy ? 'Saving…' : habit ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </form>
      {deleting && habit && (
        <Confirm
          title="Delete this habit?"
          description="The habit and all its journal entries will be permanently removed."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await deleteHabit(habit.id);
            onClose();
          }}
        />
      )}
    </>
  );
}
export function NoteEditor({ note, onClose }: { note?: Note; onClose: () => void }) {
  return (
    <Modal title={note ? 'A space for your thoughts' : 'Capture an idea'} onClose={onClose}>
      <NoteForm note={note} onClose={onClose} />
    </Modal>
  );
}
function NoteForm({ note, onClose }: { note?: Note; onClose: () => void }) {
  const { run } = useApp();
  const [title, setTitle] = useState(note?.title ?? ''),
    [body, setBody] = useState(note?.body ?? ''),
    [pinned, setPinned] = useState(note?.pinned ?? false),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await run(() => saveNote({ title, body, pinned }, note), 'Thoughts saved.');
        setBusy(false);
        if (ok) onClose();
      }}
    >
      <label>
        Title
        <input
          data-autofocus
          required
          maxLength={200}
          placeholder="Give this thought a name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Note
        <textarea
          rows={9}
          maxLength={100000}
          placeholder="Ideas, reminders, a little inspiration…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        Pin this note
      </label>
      <div className="form-actions">
        <button type="button" className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </form>
  );
}
function ListForm({ onClose }: { onClose: () => void }) {
  const { run } = useApp();
  const [title, setTitle] = useState(''),
    [items, setItems] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await run(() => createChecklist(title, items.split('\n')), 'Checklist created.');
        setBusy(false);
        if (ok) onClose();
      }}
    >
      <label>
        List name
        <input
          data-autofocus
          required
          maxLength={200}
          placeholder="e.g. The weekly reset"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Items <span className="muted">(one per line)</span>
        <textarea
          rows={6}
          maxLength={50000}
          placeholder={'Clear my inbox\nReview the week\nPlan something good'}
          value={items}
          onChange={(e) => setItems(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <button type="button" className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create checklist'}
        </button>
      </div>
    </form>
  );
}
export function HabitLogEditor({
  habit,
  date,
  onClose,
}: {
  habit: Habit;
  date: string;
  onClose: () => void;
}) {
  const { data, run } = useApp();
  const old = data.habitLogs.find((l) => l.habitId === habit.id && l.date === date);
  const [completed, setCompleted] = useState(old?.completed ?? false),
    [mood, setMood] = useState<number | null>(old?.mood ?? null),
    [note, setNote] = useState(old?.note ?? ''),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={`${habit.title} · ${dayLabel(date)}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const input: Pick<HabitLog, 'completed' | 'mood' | 'note'> = { completed, mood, note };
          const ok = await run(() => logHabit(habit, date, input), 'Journal entry saved.');
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
          />
          I showed up for this habit
        </label>
        <fieldset>
          <legend>
            How did it feel? <span className="muted">(optional)</span>
          </legend>
          <div className="mood-picker">
            {['Tough', 'Low', 'Okay', 'Good', 'Great'].map((label, i) => (
              <button
                type="button"
                className={mood === i + 1 ? 'selected' : ''}
                aria-pressed={mood === i + 1}
                key={label}
                onClick={() => setMood(mood === i + 1 ? null : i + 1)}
              >
                <span>{['☁', '◔', '◑', '◕', '☀'][i]}</span>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          A few words about today
          <textarea
            rows={4}
            value={note}
            maxLength={100000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What worked? What would help tomorrow?"
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="btn primary">
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ArchiveHabit({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  return (
    <Confirm
      title={habit.archivedDate ? 'Bring this habit back?' : 'Archive this habit?'}
      description={
        habit.archivedDate
          ? 'Your habit will reappear in your active journal. Previous entries will be kept.'
          : 'This habit will leave your daily plan. All of your progress and journal entries will be kept.'
      }
      danger={false}
      onClose={onClose}
      onConfirm={() => archiveHabit(habit.id)}
    />
  );
}
