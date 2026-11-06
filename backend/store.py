"""Atomic SQLite persistence, schema versioning, and recovery snapshots."""
from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import threading
import uuid
from .domain import TABLES, PUBLIC, validate

class Store:

    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with closing(self.connect()) as db, db:
            version = db.execute('PRAGMA user_version').fetchone()[0]
            if version > 1:
                raise ValueError('Database schema is newer than this application.')
            db.execute('CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(kind,id))')
            for kind, parent in [('habitLogs', 'habitId'), ('taskCompletions', 'taskId')]:
                db.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS unique_{kind}_day ON records(json_extract(payload,'$.{parent}'), json_extract(payload,'$.date')) WHERE kind='{kind}'")
            db.execute('PRAGMA user_version=1')

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.execute('PRAGMA busy_timeout=10000')
        return db

    @staticmethod
    def read(db):
        state = {k: [] for k in TABLES}
        for kind, payload in db.execute('SELECT kind,payload FROM records ORDER BY kind,id'):
            state[kind].append(json.loads(payload))
        return state

    def snapshot(self):
        with self.lock, closing(self.connect()) as db:
            state = self.read(db)
            return {k: state[k] for k in PUBLIC}

    def execute(self, action, args):
        from .service import mutate
        with self.lock, closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            state = self.read(db)
            result = mutate(state, action, args)
            validate(state)
            if action in ('backup.restore', 'data.reset'):
                recovery = self.path.parent / 'recovery'
                recovery.mkdir(exist_ok=True)
                previous = self.read(db)
                name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:8] + '.json'
                (recovery / name).write_text(json.dumps({'format': 'dayframe', 'version': 1, 'exportedAt': datetime.now(timezone.utc).isoformat(), 'data': {k: previous[k] for k in PUBLIC}}, ensure_ascii=False, indent=2), encoding='utf-8')
            db.execute('DELETE FROM records')
            db.executemany('INSERT INTO records(kind,id,payload) VALUES(?,?,?)', [(kind, row['date'] if kind == 'reviews' else row['id'], json.dumps(row, ensure_ascii=False)) for kind in TABLES for row in state[kind]])
            return result
