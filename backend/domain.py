"""Validation, calendar scheduling, streaks and analytics for DAYFRAME."""
from datetime import date, datetime, timedelta
import math
import re
PUBLIC = ('tasks', 'taskCompletions', 'taskEvents', 'habits', 'habitLogs', 'notes', 'checklists', 'checklistItems', 'preferences', 'reviews')
TABLES = (*PUBLIC, 'reminderDeliveries')

def require(condition, message):
    if not condition:
        raise ValueError(message)

def day(value):
    require(isinstance(value, str) and bool(re.fullmatch('\\d{4}-\\d{2}-\\d{2}', value)), 'Invalid calendar date.')
    result = date.fromisoformat(value)
    require(1900 <= result.year <= 2199, 'Dates must be between 1900 and 2199.')
    return result

def stamp(value):
    require(isinstance(value, str) and 'T' in value, 'Invalid timestamp.')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def text(value, maximum=100000, required=False):
    require(isinstance(value, str) and len(value) <= maximum, 'Invalid or oversized text.')
    require(not required or bool(value.strip()), 'A title or item text is required.')

def boolean(value):
    require(type(value) is bool, 'Expected true or false.')

def mood(value):
    require(value is None or (type(value) is int and 1 <= value <= 5), 'Mood must be between 1 and 5.')

def validate(data):
    """Validate the whole aggregate before any SQLite transaction commits."""
    require(isinstance(data, dict) and all((k in data for k in PUBLIC)), 'Backup is missing collections.')
    identities = {}
    for name in TABLES:
        rows = data.get(name, [])
        require(isinstance(rows, list) and len(rows) <= 100000, f'Invalid {name} collection.')
        seen = set()
        for row in rows:
            require(isinstance(row, dict), f'Invalid {name} record.')
            key = row.get('date') if name == 'reviews' else row.get('id')
            text(key, 200, True)
            require(key not in seen, f'Duplicate record in {name}.')
            seen.add(key)
            if name not in ('preferences', 'reviews', 'reminderDeliveries'):
                stamp(row.get('createdAt'))
                if 'demo' in row:
                    boolean(row['demo'])
            if name in ('tasks', 'habits', 'notes', 'checklists'):
                text(row.get('title'), 200, True)
            if name == 'tasks':
                text(row.get('description'))
                text(row.get('category'), 80)
                require(row.get('priority') in ('high', 'medium', 'low'), 'Invalid priority.')
                require(row.get('recurrence') in ('none', 'daily', 'weekly'), 'Invalid recurrence.')
                if row.get('dueDate') != '':
                    day(row.get('dueDate'))
                require(isinstance(row.get('dueTime'), str) and (row['dueTime'] == '' or bool(re.fullmatch('([01]\\d|2[0-3]):[0-5]\\d', row['dueTime']))), 'Invalid due time.')
                require(not row['dueTime'] or bool(row['dueDate']), 'A due time needs a date.')
                require(row['recurrence'] == 'none' or bool(row['dueDate']), 'Recurring tasks need a first date.')
                require('completedAt' in row and 'completedDate' in row, 'Missing task completion fields.')
                require((row['completedAt'] is None) == (row['completedDate'] is None), 'Invalid completion fields.')
                if row['completedAt'] is not None:
                    stamp(row['completedAt'])
                    day(row['completedDate'])
                    require(row['recurrence'] == 'none', 'Recurring completion belongs in history.')
            elif name in ('taskCompletions', 'taskEvents', 'habitLogs'):
                day(row.get('date'))
                if name == 'taskEvents':
                    require(row.get('kind') in ('created', 'edited', 'rescheduled', 'completed', 'reopened'), 'Invalid task history.')
                    text(row.get('detail'))
                if name == 'habitLogs':
                    boolean(row.get('completed'))
                    mood(row.get('mood'))
                    text(row.get('note'))
            elif name == 'habits':
                text(row.get('description'))
                day(row.get('startDate'))
                require('archivedDate' in row, 'Missing habit archive field.')
                if row['archivedDate'] is not None:
                    day(row['archivedDate'])
                days = row.get('weekdays')
                require(isinstance(days, list) and 1 <= len(days) <= 7 and all((type(d) is int and 0 <= d <= 6 for d in days)), 'Choose valid habit weekdays.')
                require(len(set(days)) == len(days), 'Duplicate weekdays.')
                require(isinstance(row.get('color'), str) and bool(re.fullmatch('#[0-9a-fA-F]{6}', row['color'])), 'Invalid habit color.')
            elif name == 'notes':
                text(row.get('body'))
                boolean(row.get('pinned'))
                stamp(row.get('updatedAt'))
            elif name == 'checklists':
                stamp(row.get('updatedAt'))
            elif name == 'checklistItems':
                text(row.get('text'), 500, True)
                boolean(row.get('completed'))
                require(type(row.get('position')) is int and row['position'] >= 0, 'Invalid checklist order.')
            elif name == 'preferences':
                require(row['id'] == 'app' and row.get('theme') in ('dark', 'light', 'system') and (row.get('dateFormat') in ('day-first', 'month-first', 'iso')), 'Invalid preferences.')
                require(type(row.get('weekStart')) is int and row['weekStart'] in (0, 1), 'Invalid week start.')
                boolean(row.get('notifications'))
            elif name == 'reviews':
                day(row['date'])
                mood(row.get('mood'))
                text(row.get('note'))
                stamp(row.get('updatedAt'))
            elif name == 'reminderDeliveries':
                stamp(row.get('deliveredAt'))
        identities[name] = seen
    for child, field, parent in [('taskCompletions', 'taskId', 'tasks'), ('taskEvents', 'taskId', 'tasks'), ('habitLogs', 'habitId', 'habits'), ('checklistItems', 'listId', 'checklists')]:
        for row in data[child]:
            require(isinstance(row.get(field), str) and row[field] in identities[parent], f'Missing parent for {child}.')
    for name, fields in [('taskCompletions', ('taskId', 'date')), ('habitLogs', ('habitId', 'date')), ('checklistItems', ('listId', 'position'))]:
        keys = [tuple((r[f] for f in fields)) for r in data[name]]
        require(len(keys) == len(set(keys)), f'Duplicate daily record or position in {name}.')

def scheduled(habit, value):
    return value >= habit['startDate'] and (not habit['archivedDate'] or value <= habit['archivedDate']) and ((day(value).weekday() + 1) % 7 in habit['weekdays'])

def dates(start, end):
    current, last = (day(start), day(end))
    while current <= last:
        yield current.isoformat()
        current += timedelta(days=1)

def habit_stats(habit, logs, today):
    done = {r['date'] for r in logs if r['habitId'] == habit['id'] and r['completed'] and (r['date'] <= today)}
    eligible = [d for d in dates(habit['startDate'], today) if scheduled(habit, d)]
    longest = run = 0
    for d in eligible:
        run = run + 1 if d in done else 0
        longest = max(longest, run)
    due = eligible[:-1] if eligible and eligible[-1] == today and (today not in done) else eligible
    current = 0
    for d in reversed(due):
        if d not in done:
            break
        current += 1
    completed = sum((d in done for d in eligible))
    return dict(current=current, longest=longest, completed=completed, total=len(eligible), percent=percent(completed, len(eligible)))

def percent(n, total):
    return math.floor(n / total * 100 + 0.5) if total else 0

def effective_date(task, completions):
    value = task['dueDate']
    if task['recurrence'] == 'none' or not value:
        return value
    done = {r['date'] for r in completions if r['taskId'] == task['id']}
    step = 1 if task['recurrence'] == 'daily' else 7
    while value in done:
        value = (day(value) + timedelta(days=step)).isoformat()
    return value

def analytics(data, span, today):
    first = (day(today) + timedelta(days=1 - span)).isoformat()
    trend = []
    for d in dates(first, today):
        count = sum((t['recurrence'] == 'none' and t['completedDate'] == d for t in data['tasks']))
        count += sum((stamp(c['createdAt']).astimezone().date().isoformat() == d for c in data['taskCompletions']))
        eligible = [h for h in data['habits'] if scheduled(h, d)]
        complete = sum((any((l['habitId'] == h['id'] and l['date'] == d and l['completed'] for l in data['habitLogs'])) for h in eligible))
        trend.append(dict(date=d, tasks=count, habits=complete, scheduled=len(eligible), activity=count + complete))
    overdue = sum((not t['completedAt'] and bool(effective_date(t, data['taskCompletions'])) and (effective_date(t, data['taskCompletions']) < today) for t in data['tasks']))
    moved = [{'task': t, 'count': sum((e['taskId'] == t['id'] and e['kind'] == 'rescheduled' and (first <= e['date'] <= today) for e in data['taskEvents']))} for t in data['tasks']]
    expected = sum((d['scheduled'] for d in trend))
    complete = sum((d['habits'] for d in trend))
    return dict(trend=trend, count=sum((d['tasks'] for d in trend)), overdue=overdue, consistency=percent(complete, expected), completed=complete, expected=expected, rescheduled=sorted([m for m in moved if m['count'] > 1], key=lambda m: -m['count']), activeDays=sum((d['activity'] > 0 for d in trend)))
