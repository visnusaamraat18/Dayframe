import { Pencil, Repeat2, Flag } from 'lucide-react';
import { CheckButton } from './ui';
import { useApp } from '../hooks/useApp';
import { completeTask } from '../database/repository';
import { dayLabel } from '../utils/dates';
import type { TaskRow as Row } from '../services/calculations';
import type { Task } from '../types';
export function TaskRow({
  row,
  onEdit,
  showDate = true,
}: {
  row: Row;
  onEdit: (task: Task) => void;
  showDate?: boolean;
}) {
  const { run, today, prefs } = useApp();
  const { task, date, done } = row;
  const overdue = !done && date && date < today;
  const future = task.recurrence !== 'none' && date > today;
  return (
    <div className={`task-row ${done ? 'task-done' : ''}`}>
      <CheckButton
        checked={done}
        disabled={future}
        onClick={() =>
          run(
            () => completeTask(task, date, !done),
            done ? 'Task reopened.' : 'One more thing, done.',
          )
        }
        label={`${done ? 'Reopen' : 'Complete'} ${task.title}${future ? ' (available on the scheduled day)' : ''}`}
      />
      <div className="task-content">
        <button className="task-title" onClick={() => onEdit(task)}>
          {task.title}
        </button>
        <div className="task-meta">
          {task.category && <span className="category">{task.category}</span>}
          {showDate && date && (
            <span className={overdue ? 'overdue-text' : ''}>
              {overdue ? 'Overdue · ' : ''}
              {date === today ? 'Today' : dayLabel(date, prefs.dateFormat)}
              {task.dueTime ? ` · ${task.dueTime}` : ''}
            </span>
          )}
          {task.recurrence !== 'none' && (
            <span title={`Repeats ${task.recurrence}`}>
              <Repeat2 size={12} />
              {task.recurrence}
            </span>
          )}
          {task.demo && <span className="demo-label">Demo</span>}
        </div>
      </div>
      <span className={`priority priority-${task.priority}`} title={`${task.priority} priority`}>
        <Flag size={13} fill="currentColor" />
        <span>{task.priority}</span>
      </span>
      <button
        className="icon-btn row-edit"
        aria-label={`Edit ${task.title}`}
        onClick={() => onEdit(task)}
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}
