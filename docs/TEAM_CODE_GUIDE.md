# DAYFRAME code in five parts

Course: Problem solving using Python
Faculty: Sreethul Das

These are study and presentation responsibilities for one connected application. Every member should also understand the full request flow.

## Part 1: Interface and API connection

**Ra. Visnu Saamraat - 26BME0493**

### Part 1: Interface and API connection

- Ra. Visnu Saamraat  26BME0493
- Pages and editors collect tasks, habits, notes and settings.
- repository.ts maps user actions to named commands.
- api.ts sends requests and reports backend errors.
- useApp.tsx shares state and refreshes after saves.

Files to study: src/main.tsx, src/App.tsx, src/pages/*.tsx, src/components/*.tsx, src/styles/index.css, src/types/index.ts, src/utils/dates.ts, src/services/api.ts, src/database/repository.ts and src/hooks/useApp.tsx. Supporting UI helpers are src/services/calculations.ts and src/services/demo.ts. Input: a task form object. Processing: an editor calls saveTask, which sends task.save through command and api. Output: a saved task appears after the next refresh. React context distributes backend state to pages. The effect fetches immediately, listens for dayframe-saved and polls every 3000 ms. Sequence numbers prevent an earlier response from replacing a later response. A failed request produces a visible error. Explain that TypeScript types help during development but Python must still validate network input. Demo: create a non-recurring task, edit its title and refresh the page.

### Part 1: A save becomes a command

- command() wraps the action and arguments as JSON.
- api() selects POST when a body exists.
- A successful save triggers the shared refresh event.
- The browser displays the server result.

src/services/api.ts, lines 30-34

```typescript
export async function command<T = void>(action: string, args: object = {}): Promise<T> {
  const response = await api<{ result: T }>('/api/command', { action, args });
  if (!action.startsWith('reminder.')) window.dispatchEvent(new Event('dayframe-saved'));
  return response.result;
}
```

Walk through each statement. The default generic type T is void when the caller expects no returned value. api returns an object with a result field. The URL is relative, so the built website calls its own Python host. The event is an in-browser message, not a request to SQLite. Reminder commands skip this event to avoid unnecessary refresh loops. await waits for the promise to settle. A non-2xx JSON response becomes an Error inside api. The caller catches that error through useApp.run. Question: what happens if Python stops? Answer: fetch fails or returns an unsuitable response, and the interface shows the backend error. Source: src/services/api.ts.

### Part 1: A task save in the browser

- Input: a task titled "Revise Python".
- saveTask() sends task.save with the form fields.
- Python returns the saved record.
- The refresh event reloads the shared state.
- React displays the task from the saved data.

Trace src/components/Editors.tsx to src/database/repository.ts, then src/services/api.ts and src/hooks/useApp.tsx. The command contains action: task.save and args: {input, id}. A new task has no existing id. api serializes the body with JSON.stringify and sends POST. The backend result resolves the promise. The dayframe-saved event starts a state refresh. If Python is unavailable, the UI reports an error rather than saving to a second primary database. Explain async/await as waiting for the response without blocking the browser interface. Demonstration: create a task, refresh the page and locate the same task.

## Part 2: Python HTTP server

**B. Ashwath - 26BME0562**

### Part 2: Python HTTP server

- B. Ashwath  26BME0562
- serve_dayframe.py listens on 127.0.0.1.
- GET /api/state returns records, reports and streaks.
- POST /api/command accepts a JSON action.
- The same server serves the compiled React files.

Files: serve_dayframe.py, START-DAYFRAME.cmd and START-DAYFRAME-PYTHON.cmd. Python concepts: classes, inheritance, methods, exceptions, argparse and standard-library imports. DayframeHandler inherits SimpleHTTPRequestHandler. ThreadingHTTPServer accepts local HTTP requests. create_server verifies that dist/index.html exists and attaches a Store to the server. The default port is 5173. A direct request to /tasks serves index.html so React Router can render that route. GET /__dayframe__/health reports readiness. The Host check permits localhost or 127.0.0.1 with the actual port. POST also checks Origin when supplied, Content-Type and a 20 MB limit. These are local access protections, not a login system or a public deployment design. Demo: open the health URL and the /tasks URL directly.

### Part 2: Parsing a JSON request

- The server reads only the declared request length.
- json.loads() converts JSON text to Python values.
- Store.execute() handles the command.
- json_response() sends the result to the browser.

serve_dayframe.py, lines 67-72

```python
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 20 * 1024 * 1024:
                raise ValueError('Request must be between 1 byte and 20 MB.')
            payload = json.loads(self.rfile.read(length))
            result = self.server.store.execute(payload['action'], payload.get('args', {}))
            self.json_response({'result': result})
```

length comes from Content-Length after integer conversion and size validation. self.rfile is the incoming binary stream. The payload requires action and defaults args to an empty dictionary. Missing fields or invalid values lead to a 400 JSON error through the exception handler. A successful command returns status 200. Unexpected database errors return a generic 500 message. The store controls the transaction, so the HTTP handler does not issue SQL itself. Question: why JSON rather than passing Python objects directly? The browser and server are separate programs and need a shared serialized format. Source: serve_dayframe.py.

### Part 2: One HTTP request

- Browser sends POST /api/command with JSON.
- The handler checks Host, Origin and content type.
- json.loads() creates Python dictionaries and lists.
- Store.execute() runs the requested action.
- The handler returns {result} or a JSON error.

A successful command returns HTTP 200. A malformed or invalid command returns 400. A disallowed local Host or supplied Origin returns 403. A write with a non-JSON content type returns 415. Host and Origin checks are local protections, not user authentication. GET /api/state returns the current records and calculated reports. GET /__dayframe__/health can demonstrate that Python is running. A direct browser request to /tasks receives the built index.html, then React Router chooses the page. Explain the difference between an HTTP request and a Python function call. Source: serve_dayframe.py.

## Part 3: Python application commands

**Aryaveer Chavda - 26BME0485**

### Part 3: Python application commands

- Aryaveer Chavda  26BME0485
- backend/service.py dispatches commands in mutate().
- Tasks keep creation, editing and completion history.
- Recurring tasks store completion records per date.
- Other branches handle habits, notes and checklists.

Study the entire backend/service.py, especially base, find, event, save_task, remove and mutate. Inputs are a state dictionary, an action string and an arguments dictionary. mutate changes the in-memory aggregate and returns a result. Store owns the surrounding transaction. base creates a UUID and timestamp. A non-recurring task stores completedAt and completedDate on the task. A recurring task keeps its definition and adds taskCompletions by date. Completing the same occurrence twice does not create another entry. Removing a parent removes its related history or child records in service.remove. note.convert creates a task from note title and body. Checklist ordering swaps position values. Backup restore validates and copies public collections. Reminder claims prevent repeated claims across tabs. Demo: complete a daily task and show that the next occurrence advances without adding another task definition.

### Part 3: Command dispatch in Python

- require() rejects an invalid arguments object.
- args.get() reads an optional record identifier.
- task.save calls a dedicated helper.
- task.complete enters its own command branch.

backend/service.py, lines 48-54

```python
def mutate(state, action, args):
    require(isinstance(args, dict), 'Invalid command arguments.')
    key = args.get('id')
    if action == 'task.save':
        return save_task(state, args['input'], key)
    if action == 'task.complete':
        task = find(state, 'tasks', key)
```

The dictionary state holds collections as lists. An if chain selects the requested operation. For a new task, id is absent and save_task creates the base fields. For an edit, find resolves the existing task and deepcopy prepares the update. A dictionary comprehension copies allowed fields rather than every caller-supplied property. save_task strips title whitespace, resets recurring completion fields and adds a task event. The store later validates the complete state before committing. Question: why separate service from store? Service describes the application action, while store manages persistence and atomicity. Unknown actions reach a final ValueError. Source: backend/service.py.

### Part 3: A recurring task

- One daily task has its first due date today.
- Completing today adds one dated completion record.
- Repeating that completion adds no duplicate.
- The next open date advances by one day.
- Undo removes the dated completion record.

In this example the first due date is today, so there are no earlier incomplete occurrences. service.mutate handles task.complete. For a recurring task, it validates the requested date against the schedule and rejects future completion. It searches taskCompletions by taskId and date before adding or removing a record. This makes repeated completion idempotent: repeating the same command has the same final effect as applying it once. domain.effective_date walks forward from the first due date while that date already appears in the completion set. The task definition itself remains a single record. Explain how the service and domain parts cooperate. Source: backend/service.py task.complete and backend/domain.py effective_date.

## Part 4: Python rules and reports

**Gade Madhu Preet - 26BME0528**

### Part 4: Python rules and reports

- Gade Madhu Preet  26BME0528
- backend/domain.py validates fields and relationships.
- scheduled() checks a habit date and weekday.
- habit_stats() calculates current and longest streaks.
- analytics() builds 7, 30 and 90 day reports.

Study require, day, stamp, text, boolean, mood, validate, scheduled, dates, habit_stats, percent, effective_date and analytics. Validation checks string lengths, actual calendar dates, enums, mood bounds, required parents and uniqueness. scheduled includes start and archive bounds and maps Python weekdays to the stored Sunday-zero convention. Streaks count scheduled days, so a rest day does not break a streak. An unfinished scheduled today receives a grace period for current streak. Example: scheduled Monday, Wednesday, Friday with Monday and Wednesday done gives current 2 on Thursday and on unfinished Friday. Missing Wednesday breaks the sequence. Analytics counts task completion activity, scheduled habit completion consistency and overdue tasks. Recurring activity uses completion-record createdAt converted to local date, rather than the occurrence date. A known archived-habit current-streak issue remains and appears on the limitations slide.

### Part 4: Date validation

- A regular expression checks the YYYY-MM-DD format.
- date.fromisoformat() checks the real calendar date.
- require() enforces the supported year range.
- Invalid values raise ValueError before commit.

backend/domain.py, lines 12-16

```python
def day(value):
    require(isinstance(value, str) and bool(re.fullmatch('\\d{4}-\\d{2}-\\d{2}', value)), 'Invalid calendar date.')
    result = date.fromisoformat(value)
    require(1900 <= result.year <= 2199, 'Dates must be between 1900 and 2199.')
    return result
```

Explain the difference between syntax and meaning. 2026-02-30 has the expected shape but is not a real date, so date.fromisoformat raises ValueError. The year range is 1900 through 2199 inclusive. Return value is a Python date object, which supports date subtraction and timedelta arithmetic. A required title rejects whitespace-only strings. Boolean validation uses type(value) is bool because bool is a subclass of int in Python and a loose integer check would be misleading. Question: why validate in Python if the browser checks inputs? A caller can bypass the form and send JSON directly. Source: backend/domain.py.

### Part 4: A streak worked by hand

- Schedule: Monday, Wednesday and Friday.
- Monday and Wednesday are complete.
- On Thursday, the current streak is 2.
- An unfinished Friday keeps 2 during that day.
- A missed Wednesday breaks the sequence.

This example assumes an active habit with no earlier eligible dates and a start date on the Monday described. Only scheduled days enter the eligible list. Tuesday and Thursday are rest days, so they cannot break the streak. When today is eligible but unfinished, habit_stats excludes today from the backward scan for current streak, giving the user the rest of the day to complete it. Once that date passes unfinished, the missing scheduled day breaks current streak. Longest streak scans all eligible dates independently. Consistency is completed scheduled days divided by eligible scheduled days, rounded to the nearest integer, with zero when the denominator is zero. Archived habits have the separate historical-current limitation discussed later. Source: backend/domain.py.

## Part 5: SQLite storage and testing

**Nikil Ranganathan - 26BME0495**

### Part 5: SQLite storage and testing

- Nikil Ranganathan  26BME0495
- backend/store.py owns data/dayframe.sqlite3.
- Transactions commit valid changes or roll back errors.
- Recovery JSON preserves records before reset or restore.
- python_tests verifies backend rules and HTTP behavior.

Primary files: backend/store.py, python_tests/test_backend.py and python_tests/test_server.py. Also study src/services/backup.ts, src/database/db.ts, src/database/legacyRepository.ts and src/test/*. These retained TypeScript storage modules support migration and historical tests. Settings provides explicit legacy import, with confirmation and a recovery copy. SQLite uses one records table with kind, id and a JSON payload, with a primary key on kind and id. It is not a separate SQL table per entity. Partial unique indexes protect task/day and habit/day records. PRAGMA user_version tracks schema version. Store uses RLock for serialization within this process and BEGIN IMMEDIATE for its transaction. Every mutation currently reads, validates and rewrites the aggregate. Recovery files live beside the database and are not an off-device backup. Demo: save, restart Python and verify persistence, then export JSON without resetting personal records.

### Part 5: An atomic write

- The lock serializes Store access within the process.
- BEGIN IMMEDIATE starts a write transaction.
- mutate() applies the action to the current state.
- validate() must pass before the later SQL write.

backend/store.py, lines 43-49

```python
    def execute(self, action, args):
        from .service import mutate
        with self.lock, closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            state = self.read(db)
            result = mutate(state, action, args)
            validate(state)
```

closing(self.connect()) ensures the connection closes. The connection context db commits on normal exit or rolls back if an exception escapes. BEGIN IMMEDIATE obtains the database write reservation early. self.read builds the in-memory state from JSON rows. The omitted later lines create recovery JSON for reset or restore, delete previous rows and insert the valid new aggregate using parameterized SQL. Return from inside the with block still exits the contexts and commits. RLock permits reentrant use by a thread. It does not solve stale form overwrites across tabs. Question: is SQLite a Python dictionary? No. It is a disk-backed SQL database. Python converts JSON payloads to and from dictionaries and lists. Source: backend/store.py.

### Part 5: A failed edit rolls back

- A valid task already exists in SQLite.
- An edit submits an empty title.
- mutate() changes the temporary in-memory state.
- validate() raises ValueError before SQL replacement.
- The transaction rolls back and the saved task stays.

Store.execute acquires its process lock, starts BEGIN IMMEDIATE and reads the latest aggregate. mutate prepares the requested edit. validate rejects a whitespace-only title. The exception exits the database context and triggers rollback, then the handler responds with a JSON error. A normal valid edit reaches DELETE and parameterized INSERT statements and commits on context exit. A test compares the snapshot before and after invalid edits to confirm no saved change. Persistence tests create a second Store using the same temporary file. Recovery files before reset or restore help recover replaced records, but they live on the same device. Sources: backend/store.py and python_tests/test_backend.py.

## One task across all five parts

- Visnu: saveTask() sends task.save with the form fields.
- Ashwath: do_POST() parses the JSON command.
- Aryaveer: mutate() calls save_task().
- Madhu: validate() checks the resulting records.
- Nikil: Store commits, then the UI reads the saved state.

Full trace: Editors.tsx calls repository.saveTask. That calls command("task.save", {input, id}). api sends POST /api/command. do_POST performs request checks and calls Store.execute. Store starts BEGIN IMMEDIATE and reads current records. mutate dispatches to save_task, which creates or updates the task and records an event. validate rejects bad fields or relationships. Store writes the valid aggregate and commits as it exits its contexts. The HTTP response returns result. command dispatches dayframe-saved. useApp fetches GET /api/state and receives records plus computed reports and streaks. React rerenders the task. If validation raises, the transaction rolls back and an error reaches the UI. Each member should explain both the preceding and following handoff.

## Tests and their scope

- 26 Python tests passed for the active backend.
- 36 TypeScript reference and regression tests passed.
- Strict TypeScript compilation and Vite build passed.
- Python tests use temporary databases and local HTTP.
- Passing tests cover the checked cases, not every case.

Fresh verification for this presentation: python -m unittest discover -s python_tests -v ran 26 tests successfully. npm test ran 36 tests in two suites successfully. npm run build completed strict TypeScript compilation and a Vite production build. Initial restricted runs could not access temporary database or cache locations. Successful reruns with the required file access produced these results. The 36 TypeScript tests exercise legacy IndexedDB storage and pure calendar/backup helpers, not Python backend execution. Python tests cover CRUD, rollback, recurrence, streaks, backups, persistence, reminder claims, API round trips and host/origin checks. These are automated checks. Actual operating-system notification delivery remains unverified. Sources: python_tests, src/test, package.json.

## Questions we should be able to answer

- Why Python? It controls commands, validation and storage.
- Why React? It renders pages and handles browser events.
- Why SQLite? It stores local records across restarts.
- Why validate twice? Browser checks can be bypassed.
- Why a transaction? A failed change must not partly save.

More viva practice. Q: What is JSON? A portable text representation for browser/server messages. Q: What does a primary key do? It prevents duplicate kind/id records. Q: How are repeated task completions handled? A daily completion record is checked before insertion, with a unique SQLite index as protection. Q: What is a set used for? Fast membership and duplicate detection, such as completed dates and identity keys. Q: What does yield do in dates()? Produces dates one at a time from a generator. Q: What does 127.0.0.1 mean? The local machine loopback interface. Q: Is there an AI model running in DAYFRAME? The inspected application code does not integrate an AI model API. AI assistance concerns development. Q: Can it work when Python stops? The active interface requires its Python backend for records and actions. Q: Does polling prevent stale edits? It refreshes displayed state, but cannot prevent a previously opened full form from overwriting newer fields.

## Current limits and next improvements

- Archived habits can retain a historical current streak.
- An older open form can overwrite a newer edit.
- Each mutation rewrites the full data aggregate.
- Polling recomputes reports every three seconds.
- Closed-tab reminders are outside the current design.

Explain limitations as current behavior. Archived habit: eligible dates stop at archivedDate, so current can reflect a historical run rather than a streak up to the present. Proposed improvement: define archived current as zero or label the result historical and add a regression test. Stale form: two forms can submit full fields based on different snapshots. Proposed improvement: revision checks and a conflict message. Storage: reading, validating and reinserting every row is simple but grows costly. Proposed improvement: row-level mutations while retaining transaction guarantees. Polling: full reports and streaks are recalculated on each state request. Proposed improvement: cache by data revision and day or reduce refresh work. Notifications currently depend on an open browser page and permission. Existing launcher console wording about retaining a browser profile is outdated for primary SQLite storage. Final explanation: the project demonstrates Python functions, dictionaries, sets, loops, date handling, exceptions, HTTP, JSON, SQLite transactions and tests. Understanding includes being able to explain these limits.
