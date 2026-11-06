# Python backend responsibilities

The production website requires Python. React displays the interface and sends JSON commands; Python owns persistent records and validates every mutation before committing it to SQLite.

| Python module | Responsibility |
| --- | --- |
| `serve_dayframe.py` | Serves the compiled website, routes API requests, limits request size, and checks local hosts and origins |
| `backend/store.py` | Owns `data/dayframe.sqlite3`, schema versioning, unique daily log indexes, atomic commits, rollback, and recovery backups |
| `backend/service.py` | Creates and edits tasks, records recurrence/history, handles habits/journals, manages notes/checklists/preferences/reviews, restores backups, and isolates demo records |
| `backend/domain.py` | Validates records, schedules and calendar dates; calculates streaks and 7/30/90-day reports |
| `python_tests/` | Tests Python rules, SQLite persistence, command handling, and real HTTP responses |

## Request flow

1. A React form sends an action and arguments to `POST /api/command`.
2. Python starts a SQLite write transaction and reads the current aggregate.
3. Python applies the action, validates field values and relationships, and commits the result. An invalid action rolls back completely.
4. The browser refreshes `GET /api/state`, including Python-generated reports and streaks, and renders the new state.

Examples of commands: `task.save`, `task.complete`, `habit.log`, `note.convert`, `item.move`, `tasks.reschedule`, and `backup.restore`. Reminder claims are also recorded by Python so repeat delivery is prevented across browser refreshes and tabs.

## Run and inspect

```powershell
npm run build
python serve_dayframe.py
```

Open `http://127.0.0.1:5173/`. Settings displays the Python/SQLite storage information and includes a connection check. The health endpoint is `http://127.0.0.1:5173/__dayframe__/health`.

The Python server uses only the standard library. No pip installation, cloud database, or login is needed. Keep the Python process running to use the website. The SQLite data folder is independent of `dist/` and survives interface rebuilds.

## Earlier browser data

Settings includes **Import previous browser data**. This reads the earlier IndexedDB workspace in that browser profile and opens the normal replacement confirmation. The Python database is replaced only after confirmation, and the original browser copy remains untouched. Server records are saved to `data/recovery/` before replacement or reset.

The old TypeScript storage implementation remains for explicit migration and historical regression tests; it is not the active application's persistence fallback. React still handles visual components, browser interactions and notifications. Python is the data and application backend.
