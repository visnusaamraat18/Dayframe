# Current Python backend verification

Verified on 2 November 2026, Asia/Calcutta. This section supersedes the earlier browser-only storage description below.

- Python is the required application backend; the production React interface sends mutations to Python and reads authoritative records and reports from its JSON API.
- `python -m unittest discover -s python_tests -v`: **26 tests passed**, covering current Python business rules, SQLite persistence, atomic rollback, task/history/recurrence, habit journals and streaks, notes, checklists, reviews, preferences, backup restore/recovery, demo isolation, reminders, HTTP routes, MIME types, and host/origin restrictions.
- `npm test`: **36 reference/regression tests passed**. These cover retained IndexedDB-era storage and pure TypeScript calendar/backup calculations; they are not claimed as Python backend tests.
- `npm run build`: strict TypeScript compilation and the production Vite build passed after the migration. No circular-chunk warning remained in the final build.
- Started the actual Python server on **http://127.0.0.1:5173/** with **data/dayframe.sqlite3**.
- Actual browser checks: created a daily recurring task, completed it, refreshed, and confirmed the stored completion. Loaded labeled demo data; checked in to a habit; added and completed a checklist item; viewed the 30-day Insights reports; checked Python connectivity in Settings.
- Stopped and restarted the actual Python process, reloaded the browser, and confirmed the saved checklist and other records survived.
- Exported a real JSON backup through the interface, imported it, reviewed the record counts, and confirmed restore. The prior records were saved in `data/recovery/` before replacement.
- Opened the previous-browser-data import preview and cancelled it. The earlier IndexedDB copy was not deleted or replaced. Migration of a populated personal browser workspace was not manually performed.
- Cleared the labeled demo records and removed the disposable QA task. The final SQLite workspace has no tasks, habits, notes, or checklists; the previous browser workspace is preserved separately.
- The connected UI returned no browser errors/warnings during the Insights check after the restart. A settings screenshot is saved in `docs/dayframe-python-backend.jpg`.

Limits: actual OS notification delivery, full browser-process restarts, and double-clicking the Windows launcher were not manually verified. No closed-tab push service is implemented. The server is local only; no deployment occurred.

## Earlier verification history

# Delivery verification

## Python addition on 2 November 2026

- Added `serve_dayframe.py`, a Python 3.10+ standard-library HTTP server for the production build, and `START-DAYFRAME-PYTHON.cmd`.
- Seven Python unittest integration tests passed using actual loopback HTTP requests. Coverage includes all main page routes, asset MIME types and length, HEAD responses, a Python health endpoint, missing assets, blocked traversal/private paths, and the missing-build error.
- `npm run build` passed again after the addition. The React source and IndexedDB data model were not changed.
- The Python tests needed an unsandboxed run because the Windows sandbox blocked temporary-file writes. The successful rerun executed all seven tests.
- Use the same `127.0.0.1:5173` origin when switching between Vite and Python; stop the previous server first. Browser interaction checks below refer to the original interface verification. The Python addition was verified at the HTTP level; the new Windows launcher's double-click flow has not been manually exercised.

Checked on **29 October 2026**, Asia/Calcutta.

## Automated checks actually run

- `npm install`: completed successfully. Exact resolved dependencies are in `package-lock.json`.
- `npm test`: **36 tests passed in 2 suites**, using Vitest 4.1.12 and fake-indexeddb with actual Dexie operations.
- `npm run build`: strict TypeScript checks passed and Vite 7.3.7 produced `dist/` successfully.
- HTTP readiness: **200 OK** from `http://127.0.0.1:5173/`.

An initial test attempt could not write Vitest's cache inside the Windows sandbox. The suite was rerun outside that sandbox and passed. Likewise, the local server was restarted outside the sandbox so the desktop browser could reach it. These were environment restrictions; neither failed attempt is counted as a passing test.

## Actual browser checks

The app was exercised in the desktop in-app browser, including an explicit **1280×900** desktop viewport and **390×844** phone viewport.

- Fresh database displayed genuine empty states and zero statistics.
- Quick Capture created a task; priority and due-date edits saved.
- Refresh retained the task through IndexedDB.
- Completion updated the dashboard; undo reopened the task.
- Daily recurrence saved and completion advanced the outstanding occurrence to the following day without creating duplicate tasks. Future completion was disabled.
- Task search isolated the temporary QA task.
- Task deletion displayed a confirmation and removed the temporary record.
- Demo loading displayed the mixing-consent dialog; sample records had Demo labels and a global banner.
- Habit completion toggling updated counts; calendar history opened; a dated journal entry with a completed state, mood, and note saved and appeared in history.
- A note was pinned; a checklist item was added, reordered, and completed.
- The Insights range changed to 30 days and both real charts rendered. No browser console errors or warnings were returned during that check.
- Light theme worked, then dark theme was restored.
- JSON export downloaded a real backup. Import validated the downloaded file and displayed its record counts before confirmation. Confirmed restore completed successfully.
- Today's Open planner action opened the weekly planner route and displayed scheduled records.
- Mobile dashboard and Settings fit the viewport without horizontal overflow. Mobile navigation opened and navigated successfully.
- Clear demo data removed all tagged examples and their added test entries. Temporary QA records were removed; the final workspace is empty and dark, ready for the user's own records.

Browser QA found a native date-input event issue. Date/time fields were changed to handle input events, and the saved date was verified on the dashboard afterward. Review also added regression tests for demo-note conversion tags, future-start habit archiving/backups, and late recurring-completion analytics.

## Limits of verification

- No full operating-system/browser-process restart was performed. Browser refresh persistence was manually checked, and database connection close/reopen persistence is covered by an automated test.
- Actual operating-system notification delivery, permission denial flows, and browser storage-persistence grants were not manually exercised. Closed-site background reminders are intentionally not implemented or claimed.
- Automated tests exercise storage and business rules; browser checks were interactive through automation, not a committed Playwright test runner.
- Other browsers and physical mobile devices were not tested. Responsive behavior was checked with the viewport sizes above.
- The Windows convenience launcher was supplied, but its double-click path was not manually launched; the underlying npm development command was started and verified directly.

The server runs locally only. No hosting registration, deployment, or public publication occurred.
