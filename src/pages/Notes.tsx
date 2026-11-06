import { useState } from 'react';
import {
  Search,
  Plus,
  Pin,
  PinOff,
  ArrowUpRight,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Pencil,
  X,
  NotebookPen,
  ListChecks,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import {
  pinNote,
  deleteNote,
  renameList,
  editItem,
  completeItem,
  deleteItem,
  clearItems,
} from '../database/repository';
import { addItem, moveItem, deleteList, noteToTask, required } from '../database/repository';
import { PageHeading, Empty, Confirm, Progress, CheckButton } from '../components/ui';
import { Capture, NoteEditor } from '../components/Editors';
import type { Note, Checklist, ChecklistItem } from '../types';
import { dayLabel, toDay } from '../utils/dates';
export default function Notes() {
  const { data, run, prefs } = useApp();
  const [search, setSearch] = useState(''),
    [tab, setTab] = useState('all'),
    [capture, setCapture] = useState(false),
    [editor, setEditor] = useState<Note | null>(null),
    [deleting, setDeleting] = useState<Note | null>(null),
    [convert, setConvert] = useState<Note | null>(null);
  const notes = data.notes
    .filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const lists = data.checklists.filter((l) =>
    `${l.title} ${data.checklistItems
      .filter((i) => i.listId === l.id)
      .map((i) => i.text)
      .join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const visibleNotes = tab === 'lists' ? [] : notes,
    visibleLists = tab === 'notes' ? [] : lists;
  return (
    <>
      <PageHeading
        eyebrow="A home for your ideas"
        title="Notes & lists"
        text="Get it out of your head. Keep the good things close."
      >
        <button className="btn primary" onClick={() => setCapture(true)}>
          <Plus size={17} />
          Create something
        </button>
      </PageHeading>
      <div className="toolbar">
        <div className="tabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
            Everything
          </button>
          <button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>
            <NotebookPen size={15} />
            Notes <span className="count">{data.notes.length}</span>
          </button>
          <button className={tab === 'lists' ? 'active' : ''} onClick={() => setTab('lists')}>
            <ListChecks size={16} />
            Checklists <span className="count">{data.checklists.length}</span>
          </button>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search notes and lists"
            placeholder="Find a thought…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {visibleNotes.length || visibleLists.length ? (
        <div className="notes-grid">
          {visibleNotes.map((note) => (
            <article
              className={`panel note-card ${note.pinned ? 'pinned-note' : ''}`}
              key={note.id}
            >
              <div className="note-top">
                <span className="mini-label">
                  {note.pinned ? (
                    <>
                      <Pin size={12} />
                      PINNED NOTE
                    </>
                  ) : (
                    <>
                      <NotebookPen size={13} />
                      NOTE
                    </>
                  )}
                  {note.demo && <span className="demo-label">Demo</span>}
                </span>
                <button
                  className="icon-btn"
                  aria-label={`${note.pinned ? 'Unpin' : 'Pin'} ${note.title}`}
                  onClick={() => run(() => pinNote(note.id, !note.pinned))}
                >
                  {note.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                </button>
              </div>
              <button className="note-open" onClick={() => setEditor(note)}>
                <h2>{note.title}</h2>
                <p>{note.body || 'A little room for a thought…'}</p>
              </button>
              <div className="note-footer">
                <span>{dayLabel(toDay(new Date(note.updatedAt)), prefs.dateFormat)}</span>
                <div className="flex">
                  <button
                    className="icon-btn"
                    aria-label={`Convert ${note.title} to task`}
                    title="Make a task from this note"
                    onClick={() => setConvert(note)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Edit ${note.title}`}
                    onClick={() => setEditor(note)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn danger-text"
                    aria-label={`Delete ${note.title}`}
                    onClick={() => setDeleting(note)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {visibleLists.map((list) => (
            <ChecklistCard list={list} key={list.id} />
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title={search ? 'That thought isn’t here yet.' : 'Your ideas deserve a home.'}
            text={
              search
                ? 'Try another search or capture something new.'
                : 'Save a thought, collect an idea, or make a list for the little things.'
            }
            action="Create a note or list"
            onAction={() => setCapture(true)}
          />
        </section>
      )}
      {capture && (
        <Capture
          initial={tab === 'lists' ? 'checklist' : 'note'}
          onClose={() => setCapture(false)}
        />
      )}
      {editor && <NoteEditor note={editor} onClose={() => setEditor(null)} />}
      {deleting && (
        <Confirm
          title="Delete this note?"
          description={`“${deleting.title}” will be permanently removed.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteNote(deleting.id)}
        />
      )}
      {convert && (
        <Confirm
          title="Turn this thought into a task?"
          description="A new task will be created with this note’s title and contents. Your note will be kept."
          danger={false}
          onClose={() => setConvert(null)}
          onConfirm={async () => {
            await noteToTask(convert);
          }}
        />
      )}
    </>
  );
}
function ChecklistCard({ list }: { list: Checklist }) {
  const { data, run } = useApp();
  const items = data.checklistItems
      .filter((i) => i.listId === list.id)
      .sort((a, b) => a.position - b.position),
    complete = items.filter((i) => i.completed).length;
  const [text, setText] = useState(''),
    [deleting, setDeleting] = useState(false),
    [clearing, setClearing] = useState(false),
    [renaming, setRenaming] = useState(false),
    [name, setName] = useState(list.title),
    [busy, setBusy] = useState(false);
  return (
    <article className="panel checklist-card">
      <div className="note-top">
        <span className="mini-label">
          <ListChecks size={14} />
          CHECKLIST {list.demo && <span className="demo-label">Demo</span>}
        </span>
        <button
          className="icon-btn danger-text"
          aria-label={`Delete ${list.title}`}
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={15} />
        </button>
      </div>
      {renaming ? (
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => renameList(list.id, required(name)))) setRenaming(false);
          }}
        >
          <input
            aria-label="Checklist title"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="icon-btn" aria-label="Save checklist title">
            <Check size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cancel rename"
            onClick={() => setRenaming(false)}
          >
            <X size={15} />
          </button>
        </form>
      ) : (
        <button
          className="checklist-title"
          onClick={() => {
            setName(list.title);
            setRenaming(true);
          }}
        >
          <h2>{list.title}</h2>
          <Pencil size={13} />
        </button>
      )}
      <div className="checklist-progress">
        <span>
          {complete} of {items.length} complete
        </span>
        <strong>{items.length ? Math.round((complete / items.length) * 100) : 0}%</strong>
      </div>
      <Progress value={items.length ? (complete / items.length) * 100 : 0} />
      <div className="checklist-items">
        {items.map((item, index) => (
          <ItemRow
            item={item}
            first={index === 0}
            last={index === items.length - 1}
            key={item.id}
          />
        ))}
        {!items.length && (
          <p className="muted small-text py-4">A clear list. Add your first item below.</p>
        )}
      </div>
      <form
        className="add-item-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await run(() => addItem(list.id, text))) setText('');
          setBusy(false);
        }}
      >
        <Plus size={16} />
        <input
          aria-label={`New item for ${list.title}`}
          maxLength={500}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a little to-do…"
        />
        <button disabled={busy} className="icon-btn" aria-label={`Add item to ${list.title}`}>
          <ArrowUpRight size={17} />
        </button>
      </form>
      {complete > 0 && (
        <button className="text-btn clear-completed" onClick={() => setClearing(true)}>
          Clear completed items
        </button>
      )}
      {deleting && (
        <Confirm
          title="Delete this checklist?"
          description="The checklist and all of its items will be permanently removed."
          onClose={() => setDeleting(false)}
          onConfirm={() => deleteList(list.id)}
        />
      )}
      {clearing && (
        <Confirm
          title="Clear completed items?"
          description={`${complete} completed items will be permanently removed from this list.`}
          onClose={() => setClearing(false)}
          onConfirm={() => clearItems(list.id)}
        />
      )}
    </article>
  );
}
function ItemRow({ item, first, last }: { item: ChecklistItem; first: boolean; last: boolean }) {
  const { run } = useApp();
  const [edit, setEdit] = useState(false),
    [text, setText] = useState(item.text),
    [deleting, setDeleting] = useState(false);
  return (
    <>
      <div className={`checklist-item ${item.completed ? 'complete' : ''}`}>
        <CheckButton
          checked={item.completed}
          label={`${item.completed ? 'Reopen' : 'Complete'} ${item.text}`}
          onClick={() => run(() => completeItem(item.id, !item.completed))}
        />
        {edit ? (
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => editItem(item.id, required(text, 'Item', 500)))) setEdit(false);
            }}
          >
            <input
              aria-label="Edit checklist item"
              required
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="icon-btn" aria-label="Save item">
              <Check size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cancel item editing"
              onClick={() => setEdit(false)}
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <>
            <button
              className="item-text"
              onClick={() => {
                setText(item.text);
                setEdit(true);
              }}
            >
              {item.text}
            </button>
            <div className="item-actions">
              <button
                className="icon-btn"
                disabled={first}
                aria-label={`Move ${item.text} up`}
                onClick={() => run(() => moveItem(item, -1))}
              >
                <ArrowUp size={12} />
              </button>
              <button
                className="icon-btn"
                disabled={last}
                aria-label={`Move ${item.text} down`}
                onClick={() => run(() => moveItem(item, 1))}
              >
                <ArrowDown size={12} />
              </button>
              <button
                className="icon-btn"
                aria-label={`Remove ${item.text}`}
                onClick={() => setDeleting(true)}
              >
                <X size={13} />
              </button>
            </div>
          </>
        )}
      </div>
      {deleting && (
        <Confirm
          title="Remove this item?"
          description={`“${item.text}” will be removed from the checklist.`}
          onClose={() => setDeleting(false)}
          onConfirm={() => deleteItem(item.id)}
        />
      )}
    </>
  );
}
