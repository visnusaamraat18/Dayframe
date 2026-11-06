# DAYFRAME — Your Everyday Command Center

DAYFRAME is a local Python application with a React and TypeScript interface. **Python is required for normal operation**: it handles record mutations, validation, recurring completions, habit journals, analytics, backup restores, and SQLite persistence. React renders the interface and Recharts graphs. No account, cloud service, API key, or pip package is required.

## Course project

**Course:** Problem solving using Python  
**Faculty:** Sreethul Das

| Team member | Registration number | Presentation responsibility |
| --- | --- | --- |
| Ra. Visnu Saamraat | 26BME0493 | Interface and API connection |
| B. Ashwath | 26BME0562 | Python HTTP server |
| Aryaveer Chavda | 26BME0485 | Python application commands |
| Gade Madhu Preet | 26BME0528 | Python rules and reports |
| Nikil Ranganathan | 26BME0495 | SQLite storage and testing |

## For the teacher

Use **Code > Download ZIP** on this repository and extract the ZIP, or clone it:

```powershell
git clone https://github.com/visnusaamraat18/Dayframe.git
cd Dayframe
```

If you downloaded a ZIP, open a terminal inside the extracted folder containing `package.json` and `serve_dayframe.py`. Follow the three commands under **Run on Windows** below. The database is created automatically on first launch. The initial workspace is empty. Optional demo records are available in Settings.

The repository contains the application source, dependency lockfile, tests and setup documentation. Personal records and installed dependencies are excluded. This repository shares the source code; the complete application runs locally with Python. A static GitHub Pages site cannot run this Python backend.

See [the five code parts](docs/TEAM_CODE_GUIDE.md) for module explanations and questions to practise.

## Run on Windows

Install **Python 3.10 or newer** and **Node.js 22.12 or newer**. From this folder:

```powershell
npm install
npm run build
python serve_dayframe.py
```

Open **http://127.0.0.1:5173/**. `py -3 serve_dayframe.py` also works on Windows. Keep the Python terminal running and press Ctrl+C to stop it. After the first build, double-click **START-DAYFRAME.cmd** or **START-DAYFRAME-PYTHON.cmd** to reopen the application. Node is used to build the interface; Python runs the built application. Rebuild after changing React source.

If npm is absent from PATH, use `& "C:\Program Files\nodejs\npm.cmd" run build`. If port 5173 is occupied, stop the previous DAYFRAME/Vite process first. Do not launch two servers on the same port. The server binds only to this laptop's loopback address. All installed app features work without internet while Python is running.

## Python architecture

- `serve_dayframe.py`: local HTTP server, React Router page delivery, JSON API, request-size limits, MIME types, and same-origin write protection.
- `backend/store.py`: SQLite schema version 1, unique daily log indexes, serialized transactional writes, rollback, durable records, and recovery snapshots.
- `backend/service.py`: task CRUD/history, recurring completion and undo, batch rescheduling, habit CRUD/archive/check-ins, notes and conversion, checklist CRUD/order, preferences, daily reviews, demo isolation, restore/reset, and reminder claims.
- `backend/domain.py`: server-side validation, schedule eligibility, current/longest streaks, and 7/30/90-day analytics.
- `src/services/api.ts`: typed HTTP client with clear errors if Python is unavailable.
- `src/database/repository.ts`: frontend commands to Python. The active interface has no browser-only storage fallback.

The interface obtains its records and Python-calculated reports through `GET /api/state`. Changes use `POST /api/command` with an action and arguments. Every mutation re-reads the current database state inside a SQLite write transaction, applies business rules, validates the resulting aggregate, and commits atomically. Invalid input rolls back. The interface refreshes after saves and polls every three seconds for changes in another tab.

Task and habit streak/trend functions retained in TypeScript serve as reference calculations and formatting fallbacks; the active dashboard, habit summaries, and Insights consume Python reports. Basic search/filter rendering and browser notification display remain browser responsibilities.

## Storage and migration

**Your primary database is `data/dayframe.sqlite3`**, beside the project source. It is independent of browser-profile storage. Clearing browser site data does not delete it. Keep the `data` folder when moving the project, and export JSON backups regularly. There is no cloud synchronization or user account isolation: browsers connecting to this local application see the same database.

The previous IndexedDB workspace is **not deleted or automatically overwritten**. To migrate, open the app at its previous origin in the same browser profile, go to **Settings → Import previous browser data**, review the replacement warning, and confirm. This replaces the Python database with the previous workspace while leaving the browser copy intact. If moving between browsers, export JSON from the earlier version and use **Import JSON** instead. Migration is explicit because existing Python records must not be silently replaced.

Before a confirmed reset or JSON/browser-data restore, Python saves the prior server records as a versioned JSON backup in **`data/recovery/`**. Recovery files are not automatically deleted. Restore one through Settings if needed. Back up the data folder yourself as well.

## Features

- **Today:** real priorities, due/overdue tasks, upcoming deadlines, scheduled habits, daily progress, Python analytics, rule-based planning suggestions, and a daily reflection with confirmed rescheduling.
- **Tasks:** CRUD, complete/reopen, descriptions, categories, priorities, due dates and times, search/filter controls, a weekly planner, daily/weekly recurrence, dated completion history and undo.
- **Habits:** daily/weekday schedules, calendar history, mood and notes, archive/restore, current/longest streaks, and weekly/monthly consistency.
- **Notes and Lists:** searchable and pinned notes, note-to-task conversion, checklists, inline editing, completion, ordering, clearing and deletion.
- **Insights:** Python-calculated task trends, overdue count, habit consistency, activity, streaks and repeated rescheduling for 7, 30 and 90 days.
- **Settings:** dark/light/system themes, date/week preferences, JSON backup/restore, task/habit CSV export, a Python connection check, browser-data migration, optional fictional demo data and confirmed reset.
- **Quick Capture:** tasks, habits, notes and checklists from every screen; Ctrl+K or Command+K opens capture.

The first Python workspace is empty. Load optional, clearly labeled fictional examples through **Settings → Load Demo Data**, then confirm. Samples are labeled Demo and can be cleared separately without deleting personal records. Edited examples and tasks converted from demo notes retain their Demo marker.

## Calendar and reminder rules

Python uses local calendar dates and the laptop's local date/time for statistics and validation. Keep your laptop's timezone and date correct. Habits skip rest days, stop counting at archive boundaries, and allow today to remain unfinished until the day ends. Editing a habit schedule recalculates history against that schedule while preserving entries. Weekly and monthly consistency use the trailing 7 and 30 days.

Recurring tasks remain one task plus unique task/date completion records. No task copies are generated during refresh. The list shows the earliest outstanding occurrence, while the planner displays each scheduled date. Future recurring work cannot be completed early. Actual completion timestamps determine task trend dates. Deleting tasks/habits removes associated history after confirmation, so statistics reflect remaining records.

Reminders require a due date/time and explicit browser notification permission. Python stores persistent delivery claims; the browser displays the notification while the website is running. **Closed-tab background notification delivery is not implemented or guaranteed.** Browser/OS notification delivery still needs manual verification on the assessment laptop.

## Backups

JSON backups preserve version 1 of the DAYFRAME format, including tasks/history, habits/logs, notes, checklists/items, preferences and daily reviews. Both the interface and Python validate imports. Python checks dates, timestamps, required fields, types, priorities, schedules, moods, identities, parent references, duplicate daily records and checklist positions before committing. Unsupported formats, unknown versions, and requests over 20 MB are rejected. JSON is the full restoration format; CSV is a spreadsheet-friendly summary.

## Development and tests

For live interface development, start Python on 5174 in one terminal and Vite on 5173 in another:

```powershell
python serve_dayframe.py --port 5174
npm run dev
```

Vite proxies the JSON API and health endpoint to Python. Production use needs only `python serve_dayframe.py` on 5173 after building. A static preview without Python cannot save or load records.

```powershell
python -m unittest discover -s python_tests -v
npm test
npm run typecheck
npm run build
```

Python tests exercise the current backend and HTTP API. Vitest includes retained IndexedDB-era repository regression tests and pure calendar/reference calculations; those tests do not substitute for Python backend tests. `legacyRepository.ts` and the Dexie schema remain solely for those regression checks and explicit browser-data migration. See **VERIFICATION.md** for checks actually performed.

The dependency lockfile reproduces the React toolchain. Python uses only its standard library, including SQLite. The application runs locally; publishing this source repository does not host a running backend.
