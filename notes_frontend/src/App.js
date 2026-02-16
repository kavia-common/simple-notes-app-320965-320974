import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const STORAGE_KEY = 'simple_notes_app.notes.v1';

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} title
 * @property {string} content
 * @property {number} updatedAt
 * @property {number} createdAt
 */

// PUBLIC_INTERFACE
function App() {
  /**
   * UI state
   */
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  /** @type {[Note[], Function]} */
  const [notes, setNotes] = useState([]);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  /**
   * Editor state
   */
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [formError, setFormError] = useState('');
  const titleInputRef = useRef(null);

  // Load notes once (simulate a real app loading state).
  useEffect(() => {
    let cancelled = false;

    const load = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const sanitized = Array.isArray(parsed) ? parsed : [];

        // Ensure stable sort and minimal shape.
        const normalized = sanitized
          .filter(Boolean)
          .map((n) => ({
            id: String(n.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
            title: String(n.title ?? ''),
            content: String(n.content ?? ''),
            createdAt: Number(n.createdAt ?? Date.now()),
            updatedAt: Number(n.updatedAt ?? n.createdAt ?? Date.now()),
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);

        if (!cancelled) {
          setNotes(normalized);
          setLoadError('');
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError('Could not load notes from this browser storage.');
          setNotes([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Small timeout makes loading state actually visible and realistic.
    const t = window.setTimeout(load, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  // Persist notes to localStorage whenever notes change.
  useEffect(() => {
    if (isLoading) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {
      // If storage is full/blocked, we surface a non-blocking message.
      setLoadError('Notes are not saving (storage is unavailable or full).');
    }
  }, [notes, isLoading]);

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedId) || null, [notes, selectedId]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const hay = `${n.title}\n${n.content}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, query]);

  const canSave = draftTitle.trim().length > 0 || draftContent.trim().length > 0;

  const startNewNote = () => {
    setSelectedId(null);
    setDraftTitle('');
    setDraftContent('');
    setFormError('');
    // Focus after UI updates
    window.setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const startEditNote = (note) => {
    setSelectedId(note.id);
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setFormError('');
    window.setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  // PUBLIC_INTERFACE
  const saveNote = () => {
    setFormError('');

    const title = draftTitle.trim();
    const content = draftContent.trim();

    if (!title && !content) {
      setFormError('Add a title or some content before saving.');
      return;
    }

    const now = Date.now();

    setNotes((prev) => {
      if (selectedId) {
        // Update existing
        const updated = prev.map((n) =>
          n.id === selectedId
            ? {
                ...n,
                title,
                content,
                updatedAt: now,
              }
            : n
        );
        // Sort by recency
        return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
      }

      // Create new
      const id = (crypto?.randomUUID && crypto.randomUUID()) || `${now}-${Math.random().toString(16).slice(2)}`;
      const next = {
        id,
        title,
        content,
        createdAt: now,
        updatedAt: now,
      };
      return [next, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
    });

    // After save: keep editing the created note by selecting it.
    if (!selectedId) {
      const now2 = Date.now();
      const id2 = (crypto?.randomUUID && crypto.randomUUID()) || `${now2}-${Math.random().toString(16).slice(2)}`;
      // We cannot reliably know the generated id from setNotes above without complicating state;
      // instead we reselect by matching the most recently updated note in a follow-up effect-like tick.
      window.setTimeout(() => {
        setNotes((prev) => {
          if (prev.length === 0) return prev;
          const top = prev[0];
          setSelectedId(top.id);
          return prev;
        });
      }, 0);
    }
  };

  // PUBLIC_INTERFACE
  const deleteNote = (id) => {
    setFormError('');
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) {
      startNewNote();
    }
  };

  const clearAllNotes = () => {
    setFormError('');
    setNotes([]);
    startNewNote();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div className="App">
      <header className="appTopbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="brandMark" aria-hidden="true" />
            <div className="brandText">
              <div className="brandTitle">Notes</div>
              <div className="brandSub">Local, fast, and private (saved in your browser)</div>
            </div>
          </div>

          <div className="topbarActions">
            <button className="btn btnSecondary" onClick={startNewNote}>
              New note
            </button>
            <button className="btn btnDanger" onClick={clearAllNotes} disabled={notes.length === 0}>
              Clear all
            </button>
          </div>
        </div>
      </header>

      <main className="appShell" role="main">
        <section className="panel panelList" aria-label="Notes list">
          <div className="panelHeader">
            <div className="panelTitleRow">
              <h2 className="panelTitle">Your notes</h2>
              <span className="pill" aria-label={`${notes.length} total notes`}>
                {notes.length}
              </span>
            </div>

            <label className="search" aria-label="Search notes">
              <span className="searchIcon" aria-hidden="true">
                ⌕
              </span>
              <input
                className="searchInput"
                value={query}
                placeholder="Search title or content..."
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          <div className="panelBody">
            {isLoading ? (
              <div className="stateBox" role="status" aria-live="polite">
                <div className="spinner" aria-hidden="true" />
                Loading notes…
              </div>
            ) : loadError ? (
              <div className="stateBox stateError" role="alert">
                <div className="stateTitle">Storage error</div>
                <div className="stateText">{loadError}</div>
                <div className="stateHint">You can still use the app, but persistence may not work.</div>
              </div>
            ) : null}

            {!isLoading && filteredNotes.length === 0 ? (
              <div className="emptyState">
                <div className="emptyTitle">{notes.length === 0 ? 'No notes yet' : 'No matches'}</div>
                <div className="emptyText">
                  {notes.length === 0 ? 'Create your first note to get started.' : 'Try a different search term.'}
                </div>
                <button className="btn btnPrimary" onClick={startNewNote}>
                  Create a note
                </button>
              </div>
            ) : (
              <ul className="noteList">
                {filteredNotes.map((n) => {
                  const isActive = n.id === selectedId;
                  const preview = (n.content || '').trim().replace(/\s+/g, ' ');
                  const previewText = preview.length > 88 ? `${preview.slice(0, 88)}…` : preview;

                  return (
                    <li key={n.id} className={`noteItem ${isActive ? 'active' : ''}`}>
                      <button
                        className="noteSelect"
                        onClick={() => startEditNote(n)}
                        aria-current={isActive ? 'true' : 'false'}
                      >
                        <div className="noteTitle">{n.title || 'Untitled'}</div>
                        <div className="noteMeta">
                          <span className="notePreview">{previewText || 'No content'}</span>
                        </div>
                      </button>

                      <button
                        className="iconBtn"
                        onClick={() => deleteNote(n.id)}
                        aria-label={`Delete note ${n.title || 'Untitled'}`}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="panel panelEditor" aria-label="Note editor">
          <div className="panelHeader">
            <div className="panelTitleRow">
              <h2 className="panelTitle">{selectedNote ? 'Edit note' : 'Create note'}</h2>
              {selectedNote ? (
                <span className="pill pillInfo" title="Saved in your browser">
                  Saved locally
                </span>
              ) : (
                <span className="pill pillGradient" title="Create a new note">
                  New
                </span>
              )}
            </div>

            {formError ? (
              <div className="inlineError" role="alert">
                {formError}
              </div>
            ) : null}
          </div>

          <div className="panelBody">
            <div className="form">
              <label className="field">
                <div className="labelRow">
                  <span className="labelText">Title</span>
                  <span className="labelHint">Optional</span>
                </div>
                <input
                  ref={titleInputRef}
                  className="input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="e.g. Meeting notes"
                />
              </label>

              <label className="field">
                <div className="labelRow">
                  <span className="labelText">Content</span>
                  <span className="labelHint">Markdown not required</span>
                </div>
                <textarea
                  className="textarea"
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Write your note..."
                  rows={12}
                />
              </label>

              <div className="formActions">
                <button className="btn btnPrimary" onClick={saveNote} disabled={!canSave}>
                  Save
                </button>
                <button className="btn btnSecondary" onClick={startNewNote}>
                  Reset
                </button>
                {selectedNote ? (
                  <button className="btn btnDanger" onClick={() => deleteNote(selectedNote.id)}>
                    Delete
                  </button>
                ) : null}
              </div>

              <div className="editorFooter">
                <div className="smallMuted">
                  Tip: Your notes are stored in <code>localStorage</code> for this browser/device only.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="appFooter">
        <div className="footerInner">
          <span className="smallMuted">Simple Notes App • Frontend-only • No backend</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
