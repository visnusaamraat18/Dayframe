"""All record mutations run here, inside the store's SQLite transaction."""
from datetime import date, datetime, timezone
import copy
import uuid
from .domain import PUBLIC, day, require, scheduled, validate, boolean
DEFAULT_PREFS = dict(id='app', theme='dark', dateFormat='day-first', weekStart=1, notifications=False)

def now():
    return datetime.now(timezone.utc).isoformat()

def today():
    return date.today().isoformat()

def base():
    return dict(id=str(uuid.uuid4()), createdAt=now())

def find(state, kind, key):
    row = next((r for r in state[kind] if r['id'] == key), None)
    require(row is not None, f'This {kind} record was removed.')
    return row

def event(state, task, kind, detail):
    state['taskEvents'].append(dict(**base(), taskId=task['id'], date=today(), kind=kind, detail=detail, demo=task.get('demo', False)))

def save_task(state, fields, key=None, demo=False):
    old = find(state, 'tasks', key) if key else None
    row = copy.deepcopy(old) if old else dict(**base(), completedAt=None, completedDate=None, demo=demo)
    before = row.get('dueDate', '')
    row.update({k: fields.get(k) for k in ('title', 'description', 'category', 'priority', 'dueDate', 'dueTime', 'recurrence')})
    if isinstance(row['title'], str):
        row['title'] = row['title'].strip()
    if row['recurrence'] != 'none':
        row.update(completedAt=None, completedDate=None)
    if old:
        old.update(row)
    else:
        state['tasks'].append(row)
    event(state, row, 'created' if not old else 'rescheduled' if before != row['dueDate'] else 'edited', f"{before or 'No date'} → {row['dueDate'] or 'No date'}" if old and before != row['dueDate'] else row['title'])
    return row

def remove(state, kind, key):
    find(state, kind, key)
    state[kind] = [r for r in state[kind] if r['id'] != key]
    for child, field, parent in [('taskCompletions', 'taskId', 'tasks'), ('taskEvents', 'taskId', 'tasks'), ('habitLogs', 'habitId', 'habits'), ('checklistItems', 'listId', 'checklists')]:
        if kind == parent:
            state[child] = [r for r in state[child] if r[field] != key]

def mutate(state, action, args):
    require(isinstance(args, dict), 'Invalid command arguments.')
    key = args.get('id')
    if action == 'task.save':
        return save_task(state, args['input'], key)
    if action == 'task.complete':
        task = find(state, 'tasks', key)
        complete = args['completed']
        boolean(complete)
        value = args['date']
        if task['recurrence'] == 'none':
            changed = bool(task['completedAt']) != complete
            if changed:
                task.update(completedAt=now() if complete else None, completedDate=today() if complete else None)
        else:
            delta = (day(value) - day(task['dueDate'])).days
            require(delta >= 0 and (task['recurrence'] == 'daily' or delta % 7 == 0), 'Date is outside the recurring schedule.')
            require(value <= today(), 'Future recurring tasks cannot be completed early.')
            old = next((r for r in state['taskCompletions'] if r['taskId'] == key and r['date'] == value), None)
            changed = bool(old) != complete
            if complete and (not old):
                state['taskCompletions'].append(dict(**base(), taskId=key, date=value, demo=task.get('demo', False)))
            if not complete and old:
                state['taskCompletions'].remove(old)
        if changed:
            event(state, task, 'completed' if complete else 'reopened', value or 'Undated task')
        return None
    if action == 'tasks.reschedule':
        day(args['date'])
        for task_id in set(args['ids']):
            task = find(state, 'tasks', task_id)
            require(not task['completedAt'] and task['recurrence'] == 'none', 'Only unfinished non-recurring tasks can be moved here.')
            save_task(state, dict(task, dueDate=args['date']), task_id)
        return None
    if action == 'habit.save':
        old = find(state, 'habits', key) if key else None
        row = copy.deepcopy(old) if old else dict(**base(), archivedDate=None)
        row.update({k: args['input'].get(k) for k in ('title', 'description', 'weekdays', 'startDate', 'color')})
        if isinstance(row['title'], str):
            row['title'] = row['title'].strip()
        if old:
            old.update(row)
        else:
            state['habits'].append(row)
        return row
    if action == 'habit.archive':
        row = find(state, 'habits', key)
        row['archivedDate'] = None if row['archivedDate'] else today()
        return None
    if action == 'habit.log':
        habit = find(state, 'habits', key)
        value = args['date']
        day(value)
        require(scheduled(habit, value) and value <= today(), 'Choose a scheduled date up to today.')
        old = next((r for r in state['habitLogs'] if r['habitId'] == key and r['date'] == value), None)
        row = old if old else dict(**base(), habitId=key, date=value, demo=habit.get('demo', False))
        row.update({k: args['input'].get(k) for k in ('completed', 'mood', 'note')})
        if not old:
            state['habitLogs'].append(row)
        return None
    if action == 'note.save':
        old = find(state, 'notes', key) if key else None
        row = copy.deepcopy(old) if old else base()
        row.update({k: args['input'].get(k) for k in ('title', 'body', 'pinned')})
        row['updatedAt'] = now()
        if old:
            old.update(row)
        else:
            state['notes'].append(row)
        return row
    if action == 'note.pin':
        row = find(state, 'notes', key)
        boolean(args['pinned'])
        row['pinned'] = args['pinned']
        return None
    if action == 'note.convert':
        row = find(state, 'notes', key)
        return save_task(state, dict(title=row['title'], description=row['body'], priority='medium', category='Notes', dueDate='', dueTime='', recurrence='none'), demo=row.get('demo', False))
    if action == 'list.create':
        row = dict(**base(), title=args['title'], updatedAt=now())
        state['checklists'].append(row)
        for text in args.get('lines', []):
            if text.strip():
                mutate(state, 'item.add', dict(id=row['id'], text=text))
        return row
    if action == 'list.rename':
        row = find(state, 'checklists', key)
        row.update(title=args['title'], updatedAt=now())
        return None
    if action == 'item.add':
        parent = find(state, 'checklists', key)
        position = max([r['position'] for r in state['checklistItems'] if r['listId'] == key], default=-1) + 1
        row = dict(**base(), listId=key, text=args['text'].strip(), completed=False, position=position, demo=parent.get('demo', False))
        state['checklistItems'].append(row)
        return None
    if action in ('item.edit', 'item.complete'):
        row = find(state, 'checklistItems', key)
        if action == 'item.edit':
            row['text'] = args['text'].strip()
        else:
            boolean(args['completed'])
            row['completed'] = args['completed']
        return None
    if action == 'item.move':
        row = find(state, 'checklistItems', key)
        require(args['direction'] in (-1, 1), 'Invalid move direction.')
        ordered = sorted([r for r in state['checklistItems'] if r['listId'] == row['listId']], key=lambda r: r['position'])
        index = ordered.index(row) + args['direction']
        if 0 <= index < len(ordered):
            target = ordered[index]
            row['position'], target['position'] = (target['position'], row['position'])
        return None
    if action == 'item.clear':
        find(state, 'checklists', key)
        state['checklistItems'] = [r for r in state['checklistItems'] if not (r['listId'] == key and r['completed'])]
        return None
    if action.endswith('.delete'):
        kind = {'task': 'tasks', 'habit': 'habits', 'note': 'notes', 'list': 'checklists', 'item': 'checklistItems'}.get(action.split('.')[0])
        require(kind is not None, 'Unknown deletion command.')
        remove(state, kind, key)
        return None
    if action == 'preferences.save':
        row = dict(DEFAULT_PREFS, **{})
        if state['preferences']:
            row.update(state['preferences'][0])
        row.update(args['patch'])
        row['id'] = 'app'
        state['preferences'] = [row]
        return None
    if action == 'review.save':
        row = {k: args['input'].get(k) for k in ('date', 'mood', 'note')}
        row['updatedAt'] = now()
        state['reviews'] = [r for r in state['reviews'] if r['date'] != row['date']] + [row]
        return None
    if action == 'backup.restore':
        backup = args['backup']
        require(backup.get('format') == 'dayframe' and type(backup.get('version')) is int and (backup['version'] == 1), 'Unsupported DAYFRAME backup.')
        from .domain import stamp
        stamp(backup.get('exportedAt'))
        validate(backup.get('data'))
        for name in PUBLIC:
            state[name] = copy.deepcopy(backup['data'][name])
        state['reminderDeliveries'] = []
        return None
    if action == 'data.reset':
        for name in state:
            state[name] = []
        return None
    if action == 'demo.load':
        require(not any((r.get('demo') for k in PUBLIC for r in state[k])), 'Demo data is already loaded.')
        data = args['data']
        validate(data)
        for name in PUBLIC:
            require(not data[name] or name not in ('preferences', 'reviews'), 'Invalid demo collection.')
            require(all((r.get('demo') is True for r in data[name])), 'Demo records must be labeled.')
            state[name].extend(copy.deepcopy(data[name]))
        return None
    if action == 'demo.clear':
        for name in PUBLIC:
            state[name] = [r for r in state[name] if not r.get('demo')]
        return None
    if action == 'reminder.claim':
        require(isinstance(key, str) and len(key) <= 500, 'Invalid reminder identifier.')
        if any((r['id'] == key for r in state['reminderDeliveries'])):
            return False
        state['reminderDeliveries'].append(dict(id=key, deliveredAt=now()))
        return True
    if action == 'reminder.release':
        state['reminderDeliveries'] = [r for r in state['reminderDeliveries'] if r['id'] != key]
        return None
    raise ValueError('Unknown DAYFRAME command.')
