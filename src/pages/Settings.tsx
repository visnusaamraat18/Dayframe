import { api } from '../services/api';
import { db as legacyBrowser } from '../database/db';
import { useRef, useState } from 'react';
import {
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Database,
  ShieldCheck,
  Bell,
  FlaskConical,
  Trash2,
  Check,
  HardDrive,
  Info,
} from 'lucide-react';
import { PageHeading, Confirm } from '../components/ui';
import { useApp } from '../hooks/useApp';
import { savePreferences } from '../database/repository';
import {
  exportBackup,
  restoreBackup,
  validateBackup,
  downloadFile,
  resetData,
  csv,
  type Backup,
} from '../services/backup';
import { loadDemo, clearDemo } from '../services/demo';
import { habitStats } from '../services/calculations';
import type { Preferences } from '../types';
export default function Settings() {
  const { data, prefs, run, today, toast, streaks } = useApp();
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => Promise<unknown>;
    danger?: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false),
    [permission, setPermission] = useState(
      'Notification' in window ? Notification.permission : 'unsupported',
    );
  const records =
      data.tasks.length + data.habits.length + data.notes.length + data.checklists.length,
    demo = [...data.tasks, ...data.habits, ...data.notes, ...data.checklists].some((r) => r.demo);
  const change = (patch: Partial<Preferences>) =>
    run(() => savePreferences(patch), 'Preference saved.');
  const confirmImport = (backup: Backup) =>
    setConfirmation({
      title: 'Replace your local records?',
      description: `This validated backup contains ${backup.data.tasks.length} tasks, ${backup.data.habits.length} habits, ${backup.data.notes.length} notes, and ${backup.data.checklists.length} checklists. All current records and preferences will be replaced. Export a backup of your current data first if you need to keep it.`,
      action: async () => {
        await restoreBackup(backup);
        toast('Backup restored successfully.');
      },
    });
  const importBrowserData = async () => {
    await run(async () => {
      const previous = await legacyBrowser.snapshot();
      if (!Object.values(previous).some((rows) => rows.length)) {
        toast('No previous records were found on this laptop profile.');
        return;
      }
      confirmImport({
        format: 'dayframe',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: previous,
      });
    });
  };
  return (
    <>
      <PageHeading
        eyebrow="Make yourself at home"
        title="Your space, your way"
        text="A few thoughtful settings. Everything stays in your hands."
      />
      <div className="settings-layout">
        <div className="settings-main">
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="settings-icon">
                <Sun size={20} />
              </span>
              <div>
                <h2>A look that feels like you</h2>
                <p>Find a little comfort in your everyday workspace.</p>
              </div>
            </div>
            <label className="setting-label">Appearance</label>
            <div className="theme-options">
              {(
                [
                  { value: 'dark', label: 'After hours', hint: 'Dark', icon: Moon },
                  { value: 'light', label: 'Daylight', hint: 'Light', icon: Sun },
                  { value: 'system', label: 'Go with the flow', hint: 'System', icon: Monitor },
                ] as const
              ).map((t) => (
                <button
                  aria-pressed={prefs.theme === t.value}
                  className={`theme-option ${prefs.theme === t.value ? 'selected' : ''}`}
                  key={t.value}
                  onClick={() => change({ theme: t.value })}
                >
                  <span className={`theme-preview ${t.value}`}>
                    <span />
                    <span />
                    <span />
                    <t.icon size={19} />
                  </span>
                  <span>
                    <strong>{t.label}</strong>
                    <small>{t.hint}</small>
                  </span>
                  {prefs.theme === t.value && <Check size={15} />}
                </button>
              ))}
            </div>
            <div className="settings-row">
              <div>
                <h3>Date format</h3>
                <p>The way dates appear across your workspace.</p>
              </div>
              <select
                aria-label="Date format"
                value={prefs.dateFormat}
                onChange={(e) =>
                  change({ dateFormat: e.target.value as Preferences['dateFormat'] })
                }
              >
                <option value="day-first">Day first · 28 Oct</option>
                <option value="month-first">Month first · Oct 28</option>
                <option value="iso">ISO · YYYY-MM-DD</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <h3>Your week starts on</h3>
                <p>A familiar rhythm for your planner and calendar.</p>
              </div>
              <select
                aria-label="Week starts on"
                value={prefs.weekStart}
                onChange={(e) => change({ weekStart: Number(e.target.value) as 0 | 1 })}
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="settings-icon">
                <Bell size={20} />
              </span>
              <div>
                <h2>A gentle nudge</h2>
                <p>Browser reminders for tasks with a due date and time.</p>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <h3>Task reminders</h3>
                <p>
                  {permission === 'unsupported'
                    ? 'Notifications are not supported on this laptop.'
                    : permission === 'denied'
                      ? 'Blocked by your browser. Enable notifications in site permissions to use reminders.'
                      : prefs.notifications && permission === 'granted'
                        ? 'Reminders are enabled for this browser.'
                        : 'Turn on notifications with your permission.'}
                </p>
              </div>
              <button
                className={`btn ${prefs.notifications ? 'secondary' : 'primary'} small`}
                disabled={permission === 'unsupported' || permission === 'denied'}
                onClick={async () => {
                  if (prefs.notifications) {
                    await change({ notifications: false });
                    return;
                  }
                  try {
                    const result = await Notification.requestPermission();
                    setPermission(result);
                    if (result === 'granted') await change({ notifications: true });
                    else
                      toast(
                        'Notifications were not enabled. You can update site permissions in your browser.',
                      );
                  } catch {
                    toast('This browser could not enable notifications.', true);
                  }
                }}
              >
                {prefs.notifications ? 'Disable reminders' : 'Enable reminders'}
              </button>
            </div>
            <div className="info-callout">
              <Info size={16} />
              <p>
                Reminders are checked about every 30 seconds while DAYFRAME is running. The browser
                and operating system control delivery. Reliable notifications after the website is
                closed are not guaranteed; no background notification service is installed.
              </p>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="settings-icon">
                <Database size={20} />
              </span>
              <div>
                <h2>Your data belongs to you</h2>
                <p>Python backend · SQLite database on this laptop</p>
                <p>Take a copy, bring it back, or start with a clean slate.</p>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <h3>Complete backup</h3>
                <p>Export all records, journal entries, and preferences as JSON.</p>
              </div>
              <button
                className="btn secondary small"
                onClick={() =>
                  run(
                    async () =>
                      downloadFile(
                        JSON.stringify(await exportBackup(), null, 2),
                        `dayframe-backup-${today}.json`,
                      ),
                    'Backup downloaded.',
                  )
                }
              >
                <Download size={15} />
                Export JSON
              </button>
            </div>
            <div className="settings-row">
              <div>
                <h3>Restore a backup</h3>
                <p>Validate a DAYFRAME backup before replacing your records.</p>
              </div>
              <button
                className="btn secondary small"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={15} />
                {importing ? 'Validating…' : 'Import JSON'}
              </button>
              <input
                hidden
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setImporting(true);
                  await run(async () => {
                    if (file.size > 20 * 1024 * 1024)
                      throw new Error('Backups must be smaller than 20 MB.');
                    let content: unknown;
                    try {
                      content = JSON.parse(await file.text());
                    } catch {
                      throw new Error('This file is not valid JSON.');
                    }
                    confirmImport(validateBackup(content));
                  });
                  setImporting(false);
                }}
              />
            </div>
            <div className="settings-row">
              <div>
                <h3>A spreadsheet-friendly copy</h3>
                <p>Export tasks or habit summaries to CSV.</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn secondary small"
                  onClick={() => {
                    downloadFile(
                      csv([
                        [
                          'Title',
                          'Category',
                          'Priority',
                          'Due date',
                          'Due time',
                          'Repeat',
                          'Completed',
                          'Description',
                          'Demo',
                        ],
                        ...data.tasks.map((t) => [
                          t.title,
                          t.category,
                          t.priority,
                          t.dueDate,
                          t.dueTime,
                          t.recurrence,
                          t.completedDate ?? '',
                          t.description,
                          t.demo ? 'Yes' : 'No',
                        ]),
                      ]),
                      `dayframe-tasks-${today}.csv`,
                      'text/csv;charset=utf-8',
                    );
                  }}
                >
                  Tasks CSV
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => {
                    downloadFile(
                      csv([
                        [
                          'Habit',
                          'Schedule (0=Sun)',
                          'Start date',
                          'Current streak',
                          'Longest streak',
                          'Consistency %',
                          'Archived',
                          'Demo',
                        ],
                        ...data.habits.map((h) => {
                          const s = streaks[h.id] ?? habitStats(h, data.habitLogs, today);
                          return [
                            h.title,
                            h.weekdays.join('/'),
                            h.startDate,
                            s.current,
                            s.longest,
                            s.percent,
                            h.archivedDate ?? '',
                            h.demo ? 'Yes' : 'No',
                          ];
                        }),
                      ]),
                      `dayframe-habits-${today}.csv`,
                      'text/csv;charset=utf-8',
                    );
                  }}
                >
                  Habits CSV
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <h3>Check Python backend</h3>
                <p>Verify that the Python server is available.</p>
              </div>
              <button
                className="btn secondary small"
                onClick={() =>
                  run(async () => {
                    const response = await api<{ server: string; ready: boolean }>(
                      '/__dayframe__/health',
                    );
                    toast(
                      response.ready
                        ? 'Python backend is running. Records are stored in data/dayframe.sqlite3.'
                        : 'Python backend is unavailable.',
                    );
                  })
                }
              >
                <HardDrive size={15} />
                Check connection
              </button>
            </div>
            <div className="info-callout">
              <ShieldCheck size={17} />
              <p>
                Python stores your records in data/dayframe.sqlite3 on this laptop. Keep the Python
                server running. Clearing browser site data does not delete this database. Export
                JSON backups regularly, and keep the data folder when moving the project.
              </p>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="settings-icon sand">
                <FlaskConical size={20} />
              </span>
              <div>
                <h2>A little inspiration for your demo</h2>
                <p>Optional sample records for exploring DAYFRAME.</p>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <h3>Load Demo Data</h3>
                <p>
                  Inserts fictional tasks, habits, notes, checklists, and history. Every sample
                  record is labeled Demo.
                </p>
              </div>
              <button
                disabled={demo}
                className="btn secondary small"
                onClick={() =>
                  setConfirmation({
                    title: 'Load fictional demonstration records?',
                    description: records
                      ? 'You already have records. These clearly labeled fictional examples will be added alongside them with your consent. Your existing records will be kept. You can remove the demo records separately.'
                      : 'This adds fictional example tasks, habits, notes, checklists, and completion history. Charts will include these samples while they are loaded. They can be removed separately anytime.',
                    danger: false,
                    action: async () => {
                      await loadDemo();
                      toast('Fictional demonstration data loaded.');
                    },
                  })
                }
              >
                <PlusIcon />
                {demo ? 'Demo data loaded' : 'Load Demo Data'}
              </button>
            </div>
            <div className="settings-row">
              <div>
                <h3>Clear demo records</h3>
                <p>Remove all identifiable demo records, including edited examples.</p>
              </div>
              <button
                disabled={!demo}
                className="btn secondary small"
                onClick={() =>
                  setConfirmation({
                    title: 'Remove demo records?',
                    description:
                      'All records marked Demo, including edits you made to those examples, will be removed. Your own records will be kept.',
                    action: async () => {
                      await clearDemo();
                      toast('Demo records cleared.');
                    },
                  })
                }
              >
                Clear demo data
              </button>
            </div>
          </section>
          <section className="panel settings-panel">
            <h2>Bring your previous browser workspace</h2>
            <p className="muted">
              Import records from the earlier IndexedDB version into Python storage. Review and
              confirm before replacing server records. The browser copy is kept.
            </p>
            <button className="btn secondary" onClick={importBrowserData}>
              Import previous browser data
            </button>
          </section>
          <section className="panel settings-panel danger-panel">
            <div className="settings-row">
              <div>
                <h3>Start with a clean slate</h3>
                <p>Permanently delete all local records and reset preferences.</p>
              </div>
              <button
                className="btn danger small"
                onClick={() =>
                  setConfirmation({
                    title: 'Reset all DAYFRAME data?',
                    description:
                      'This permanently deletes all tasks, habits, journals, notes, checklists, reflections, and preferences on this laptop. Export a JSON backup first if you need to keep them.',
                    action: async () => {
                      await resetData();
                      toast('Your workspace has been reset.');
                    },
                  })
                }
              >
                <Trash2 size={15} />
                Reset all data
              </button>
            </div>
          </section>
        </div>
        <aside className="settings-aside">
          <div className="panel about-card">
            <div className="about-logo">
              D<span>↗</span>
            </div>
            <h2>DAYFRAME</h2>
            <p>Your everyday command center.</p>
            <span className="version-badge">VERSION 1.0.0</span>
            <div className="about-divider" />
            <p>A little structure for a more intentional day. Built around a simple rhythm:</p>
            <div className="workflow">
              <span>01</span>Capture<span>02</span>Plan<span>03</span>Act<span>04</span>Review
            </div>
            <div className="about-divider" />
            <span className="privacy-label">
              <ShieldCheck size={16} />
              Local. Personal. Yours.
            </span>
            <p className="small-text">
              No account. No cloud backend. Normal data operations stay offline once the local app
              is loaded.
            </p>
          </div>
        </aside>
      </div>
      {confirmation && (
        <Confirm
          title={confirmation.title}
          description={confirmation.description}
          danger={confirmation.danger ?? true}
          onClose={() => setConfirmation(null)}
          onConfirm={confirmation.action}
        />
      )}
    </>
  );
}
function PlusIcon() {
  return <FlaskConical size={15} />;
}
