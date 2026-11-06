"""Regression coverage for the authoritative Python data and business layer."""
import copy
from datetime import date, timedelta
import json
from pathlib import Path
import tempfile
import unittest
from backend.store import Store
from backend.domain import habit_stats, analytics

class BackendTests(unittest.TestCase):

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'dayframe.sqlite3'
        self.store = Store(self.path)
        self.today = date.today().isoformat()

    def tearDown(self):
        self.temp.cleanup()

    def call(self, action, **args):
        return self.store.execute(action, args)

    def task(self, **patch):
        return self.call('task.save', input=dict(title='Study', description='', category='Study', priority='high', dueDate=self.today, dueTime='', recurrence='none', **patch))

    def habit(self):
        return self.call('habit.save', input=dict(title='Read', description='', weekdays=list(range(7)), startDate=self.today, archivedDate=None, color='#b8edbe'))

    def test_task_create_edit_complete_undo_delete_and_history(self):
        task = self.task()
        edited = self.call('task.save', id=task['id'], input=dict(task, title='Revised', dueDate=(date.today() + timedelta(days=1)).isoformat()))
        self.assertEqual(edited['title'], 'Revised')
        self.call('task.complete', id=task['id'], date=self.today, completed=True)
        self.assertEqual(self.store.snapshot()['tasks'][0]['completedDate'], self.today)
        self.call('task.complete', id=task['id'], date=self.today, completed=False)
        self.assertIsNone(self.store.snapshot()['tasks'][0]['completedAt'])
        self.assertIn('rescheduled', [r['kind'] for r in self.store.snapshot()['taskEvents']])
        self.call('task.delete', id=task['id'])
        self.assertFalse(self.store.snapshot()['taskEvents'])

    def test_recurring_completions_are_idempotent_and_future_is_rejected(self):
        task = self.task()
        self.call('task.save', id=task['id'], input=dict(task, recurrence='daily'))
        for _ in range(2):
            self.call('task.complete', id=task['id'], date=self.today, completed=True)
        data = self.store.snapshot()
        self.assertEqual(len(data['tasks']), 1)
        self.assertEqual(len(data['taskCompletions']), 1)
        with self.assertRaisesRegex(ValueError, 'Future'):
            self.call('task.complete', id=task['id'], date=(date.today() + timedelta(days=1)).isoformat(), completed=True)
        self.call('task.complete', id=task['id'], date=self.today, completed=False)
        self.assertFalse(self.store.snapshot()['taskCompletions'])

    def test_bad_record_rolls_back_without_mutating_existing_data(self):
        task = self.task()
        before = self.store.snapshot()
        for patch in [dict(title=' '), dict(dueDate='2026-02-30'), dict(priority='urgent')]:
            with self.assertRaises(ValueError):
                self.call('task.save', id=task['id'], input=dict(task, **patch))
            self.assertEqual(self.store.snapshot(), before)

    def test_data_persists_in_a_new_store_instance(self):
        self.task()
        self.assertEqual(Store(self.path).snapshot(), self.store.snapshot())

    def test_habit_log_is_unique_preserves_mood_and_cascades(self):
        habit = self.habit()
        for note in ['First', 'Updated']:
            self.call('habit.log', id=habit['id'], date=self.today, input=dict(completed=True, mood=4, note=note))
        self.assertEqual(len(self.store.snapshot()['habitLogs']), 1)
        self.assertEqual(self.store.snapshot()['habitLogs'][0]['note'], 'Updated')
        self.call('habit.archive', id=habit['id'])
        self.assertTrue(self.store.snapshot()['habits'][0]['archivedDate'])
        self.call('habit.archive', id=habit['id'])
        self.assertIsNone(self.store.snapshot()['habits'][0]['archivedDate'])
        self.call('habit.delete', id=habit['id'])
        self.assertFalse(self.store.snapshot()['habitLogs'])

    def test_unscheduled_habit_and_bad_mood_are_rejected(self):
        habit = self.habit()
        with self.assertRaises(ValueError):
            self.call('habit.log', id=habit['id'], date=(date.today() - timedelta(days=1)).isoformat(), input=dict(completed=True, mood=4, note=''))
        with self.assertRaises(ValueError):
            self.call('habit.log', id=habit['id'], date=self.today, input=dict(completed=True, mood=8, note=''))
        self.assertFalse(self.store.snapshot()['habitLogs'])

    def test_notes_pin_conversion_and_delete(self):
        note = self.call('note.save', input=dict(title='An idea', body='Details', pinned=False))
        self.call('note.pin', id=note['id'], pinned=True)
        task = self.call('note.convert', id=note['id'])
        self.assertEqual(task['description'], 'Details')
        self.assertTrue(self.store.snapshot()['notes'][0]['pinned'])
        self.call('note.delete', id=note['id'])
        self.assertFalse(self.store.snapshot()['notes'])

    def test_checklist_create_reorder_edit_clear_and_delete(self):
        listing = self.call('list.create', title='Reset', lines=['One', 'Two'])
        rows = sorted(self.store.snapshot()['checklistItems'], key=lambda r: r['position'])
        self.call('item.move', id=rows[1]['id'], direction=-1)
        self.assertEqual(next((r for r in self.store.snapshot()['checklistItems'] if r['id'] == rows[1]['id']))['position'], 0)
        self.call('item.edit', id=rows[0]['id'], text='Revised')
        self.call('item.complete', id=rows[0]['id'], completed=True)
        self.call('item.clear', id=listing['id'])
        self.assertEqual(len(self.store.snapshot()['checklistItems']), 1)
        self.call('list.delete', id=listing['id'])
        self.assertFalse(self.store.snapshot()['checklistItems'])

    def test_preferences_and_daily_review(self):
        self.call('preferences.save', patch=dict(theme='light', weekStart=0))
        self.call('review.save', input=dict(date=self.today, mood=5, note='Progress'))
        self.call('review.save', input=dict(date=self.today, mood=4, note='Edited'))
        self.assertEqual(self.store.snapshot()['preferences'][0]['theme'], 'light')
        self.assertEqual(len(self.store.snapshot()['reviews']), 1)

    def test_atomic_reschedule_and_rollback_on_missing_task(self):
        task = self.task()
        before = self.store.snapshot()
        with self.assertRaises(ValueError):
            self.call('tasks.reschedule', ids=[task['id'], 'missing'], date='2090-01-01')
        self.assertEqual(self.store.snapshot(), before)
        self.call('tasks.reschedule', ids=[task['id']], date='2090-01-01')
        self.assertEqual(self.store.snapshot()['tasks'][0]['dueDate'], '2090-01-01')

    def test_backup_restore_validates_and_keeps_recovery_copy(self):
        self.task()
        data = self.store.snapshot()
        backup = dict(format='dayframe', version=1, exportedAt='2026-11-02T12:00:00Z', data=data)
        bad = copy.deepcopy(backup)
        bad['data']['tasks'].append(copy.deepcopy(data['tasks'][0]))
        with self.assertRaises(ValueError):
            self.call('backup.restore', backup=bad)
        self.assertEqual(self.store.snapshot(), data)
        self.call('data.reset')
        self.assertFalse(self.store.snapshot()['tasks'])
        self.call('backup.restore', backup=backup)
        self.assertEqual(self.store.snapshot(), data)
        self.assertEqual(len(list((self.path.parent / 'recovery').glob('*.json'))), 2)

    def test_demo_tags_and_cleanup_preserve_personal_records(self):
        personal = self.task()
        demo = copy.deepcopy(self.store.snapshot())
        for rows in demo.values():
            for row in rows:
                row['id'] = 'demo-' + row['id']
                row['demo'] = True
                if 'taskId' in row:
                    row['taskId'] = 'demo-' + row['taskId']
        self.call('demo.load', data=demo)
        with self.assertRaises(ValueError):
            self.call('demo.load', data=demo)
        self.call('demo.clear')
        self.assertEqual(self.store.snapshot()['tasks'], [personal])

    def test_reminder_claim_is_persistent_and_idempotent(self):
        self.assertTrue(self.call('reminder.claim', id='task:day:time'))
        self.assertFalse(Store(self.path).execute('reminder.claim', dict(id='task:day:time')))

    def test_python_streaks_skip_rest_days_and_today_grace(self):
        habit = dict(id='h', startDate='2026-10-23', archivedDate=None, weekdays=[1, 3, 5])
        logs = [dict(habitId='h', date=d, completed=True) for d in ['2026-10-23', '2026-10-26']]
        self.assertEqual(habit_stats(habit, logs, '2026-10-28')['current'], 2)
        self.assertEqual(habit_stats(habit, logs, '2026-10-29')['current'], 0)
        self.assertEqual(habit_stats(habit, logs, '2026-10-29')['longest'], 2)

    def test_python_analytics_use_stored_records(self):
        task = self.task()
        self.call('task.complete', id=task['id'], date=self.today, completed=True)
        report = analytics(self.store.snapshot(), 7, self.today)
        self.assertEqual(report['count'], 1)
        self.assertEqual(len(report['trend']), 7)
        self.assertEqual(report['consistency'], 0)
if __name__ == '__main__':
    unittest.main()
