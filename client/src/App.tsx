import { useEffect, useState, type ReactNode } from 'react';
import { apiDelete, apiGet, apiSend, type Contact, type ContactListItem } from './api';
import './App.css';

type ContactDraft = {
  displayName: string;
  note: string;
  phones: Array<{ id: string; label: string; phone: string }>;
  emails: Array<{ id: string; label: string; email: string }>;
};

type ViewMode = 'list' | 'view' | 'edit' | 'new';
type FieldKind = 'phone' | 'email';

type CustomLabelTarget = {
  kind: FieldKind;
  id: string;
} | null;

const PHONE_LABELS = ['Mobile', 'Home', 'Work', 'Main', 'Other'];
const EMAIL_LABELS = ['Personal', 'Work', 'School', 'Other'];
const CUSTOM_LABEL_VALUE = '__custom__';

function emptyContactDraft(): ContactDraft {
  return { displayName: '', note: '', phones: [], emails: [] };
}

function App() {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(emptyContactDraft());
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [customLabelTarget, setCustomLabelTarget] = useState<CustomLabelTarget>(null);
  const [customLabelDraft, setCustomLabelDraft] = useState('');

  useEffect(() => {
    void loadContacts();
  }, [query, viewMode]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    void loadContact(selectedId);
  }, [selectedId]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ contacts: ContactListItem[] }>(`/api/contacts?query=${encodeURIComponent(query)}`);
      setContacts(data.contacts);

      const stillSelected = selectedId && data.contacts.some((c) => c.id === selectedId);
      const draftIsEmpty =
        !draft.displayName.trim() && !draft.note.trim() && !draft.phones.length && !draft.emails.length;
      const allowAutoSelect = viewMode !== 'list';

      if (selectedId && !stillSelected) {
        setSelectedId(data.contacts[0]?.id ?? null);
      }

      if (!selectedId && data.contacts.length && draftIsEmpty && allowAutoSelect) {
        setSelectedId(data.contacts[0].id);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadContact(id: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Contact>(`/api/contacts/${id}`);
      setSelected(data);
      setDraft({
        displayName: data.displayName,
        note: data.note ?? '',
        phones: data.phones.map((p) => ({ id: p.id, label: p.label ?? '', phone: p.phone })),
        emails: data.emails.map((e) => ({ id: e.id, label: e.label ?? '', email: e.email }))
      });
      setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function applyDraft(updater: (prev: ContactDraft) => ContactDraft) {
    setDraft((prev) => updater(prev));
    setDirty(true);
  }

  function canLeaveEditing() {
    if (!dirty) return true;
    return confirm('Discard unsaved changes?');
  }

  function handleSelectContact(id: string) {
    if ((viewMode === 'edit' || viewMode === 'new') && !canLeaveEditing()) return;
    setSelectedId(id);
    setViewMode('view');
  }

  async function handleCreate() {
    setError(null);
    const payload = draftToPayload(draft);
    if (!payload.displayName) {
      setError('Display name is required.');
      return;
    }

    setSaving(true);
    try {
      const contact = await apiSend<Contact>('/api/contacts', 'POST', payload);
      setDraft(emptyContactDraft());
      setDirty(false);
      await loadContacts();
      setSelectedId(contact.id);
      setViewMode('view');
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedId) return;
    setError(null);
    const payload = draftToPayload(draft);
    if (!payload.displayName) {
      setError('Display name is required.');
      return;
    }

    setSaving(true);
    try {
      await apiSend<Contact>(`/api/contacts/${selectedId}`, 'PUT', payload);
      setDirty(false);
      await loadContacts();
      await loadContact(selectedId);
      setViewMode('view');
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    if (!confirm('Delete this contact?')) return;
    setError(null);
    try {
      await apiDelete(`/api/contacts/${selectedId}`);
      setSelectedId(null);
      setSelected(null);
      setDraft(emptyContactDraft());
      setDirty(false);
      setViewMode('list');
      await loadContacts();
    } catch (err) {
      setError(String(err));
    }
  }

  function handleNew() {
    if ((viewMode === 'edit' || viewMode === 'new') && !canLeaveEditing()) return;
    setError(null);
    setSelectedId(null);
    setSelected(null);
    setDraft(emptyContactDraft());
    setDirty(false);
    setViewMode('new');
  }

  function handleCancelEdit() {
    if (!canLeaveEditing()) return;
    if (viewMode === 'edit' && selected) {
      setDraft({
        displayName: selected.displayName,
        note: selected.note ?? '',
        phones: selected.phones.map((p) => ({ id: p.id, label: p.label ?? '', phone: p.phone })),
        emails: selected.emails.map((e) => ({ id: e.id, label: e.label ?? '', email: e.email }))
      });
      setDirty(false);
      setViewMode('view');
      return;
    }

    if (viewMode === 'new') {
      setDraft(emptyContactDraft());
      setDirty(false);
      setViewMode('list');
    }
  }

  function handleBackToList() {
    if ((viewMode === 'edit' || viewMode === 'new') && !canLeaveEditing()) return;
    setViewMode('list');
  }

  function handleStartEdit() {
    if (!selected) return;
    setDraft({
      displayName: selected.displayName,
      note: selected.note ?? '',
      phones: selected.phones.map((p) => ({ id: p.id, label: p.label ?? '', phone: p.phone })),
      emails: selected.emails.map((e) => ({ id: e.id, label: e.label ?? '', email: e.email }))
    });
    setDirty(false);
    setViewMode('edit');
  }

  function openCustomLabel(kind: FieldKind, id: string, currentLabel: string) {
    setCustomLabelTarget({ kind, id });
    setCustomLabelDraft(currentLabel || '');
  }

  function saveCustomLabel() {
    if (!customLabelTarget) return;
    const trimmed = customLabelDraft.trim();

    applyDraft((prev) => {
      if (customLabelTarget.kind === 'phone') {
        return {
          ...prev,
          phones: prev.phones.map((p) => (p.id === customLabelTarget.id ? { ...p, label: trimmed } : p))
        };
      }
      return {
        ...prev,
        emails: prev.emails.map((e) => (e.id === customLabelTarget.id ? { ...e, label: trimmed } : e))
      };
    });

    setCustomLabelTarget(null);
    setCustomLabelDraft('');
  }

  function closeCustomLabel() {
    setCustomLabelTarget(null);
    setCustomLabelDraft('');
  }

  const isListOnly = viewMode === 'list';
  const hasSelection = Boolean(selected);
  const statusLabel =
    viewMode === 'list'
      ? 'List view'
      : viewMode === 'view'
        ? 'Viewing'
        : viewMode === 'edit'
          ? 'Editing'
          : 'New contact';
  const detailTitle = viewMode === 'new' ? 'New Contact' : viewMode === 'edit' ? 'Edit Contact' : 'Contact Details';

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Contacts</h1>
          <p>Local contacts with editable phones, emails, and notes.</p>
        </div>
        <div className="app__status">
          <span className="pill pill--mode">{statusLabel}</span>
          {saving ? <span className="pill">Saving…</span> : null}
          {loading ? <span className="pill">Loading…</span> : <span className="pill pill--ok">Ready</span>}
          {error ? <span className="pill pill--error">{error}</span> : null}
        </div>
      </header>

      <main className={`app__body ${isListOnly ? 'app__body--list' : ''}`}>
        <section className="panel panel--list">
          <div className="panel__header">
            <h2>Contacts</h2>
            <input
              type="search"
              placeholder="Search by name/email/phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="panel__body">
            <ul className="contact-list">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className={c.id === selectedId ? 'active' : ''}
                  onClick={() => handleSelectContact(c.id)}
                >
                  <div className="contact-name">{c.displayName}</div>
                  <div className="contact-meta">{c.note || '—'}</div>
                </li>
              ))}
              {!contacts.length && <li className="empty">No contacts yet.</li>}
            </ul>
          </div>
          <div className="panel__footer">
            <button className="primary" onClick={handleNew}>
              New Contact
            </button>
            <div className="muted">{contacts.length} total</div>
          </div>
        </section>

        {!isListOnly && (
          <section className="panel panel--wide">
            <div className="panel__header">
              <h2>{detailTitle}</h2>
              <div className="panel__actions">
                {viewMode === 'view' && (
                  <>
                    <button className="ghost" onClick={handleBackToList}>
                      Back to List
                    </button>
                    <button className="primary" onClick={handleStartEdit} disabled={!hasSelection}>
                      Edit
                    </button>
                    <button className="danger" onClick={handleDelete} disabled={!hasSelection}>
                      Delete
                    </button>
                  </>
                )}
                {viewMode === 'edit' && (
                  <>
                    <button className="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </>
                )}
                {viewMode === 'new' && (
                  <>
                    <button className="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="panel__body">
              {!hasSelection && viewMode !== 'new' ? (
                <div className="empty-state">
                  <h3>Select a contact</h3>
                  <p>Pick a name from the list to view details, or create a new contact.</p>
                </div>
              ) : viewMode === 'view' ? (
                <ViewContact contact={selected} />
              ) : (
                <EditContact
                  draft={draft}
                  onChange={(next) => {
                    setDraft(next);
                    setDirty(true);
                  }}
                  onCustomLabel={openCustomLabel}
                  onUpdateDraft={applyDraft}
                />
              )}
            </div>

            <div className="panel__footer">
              {viewMode === 'new' ? (
                <button className="primary" onClick={handleCreate} disabled={saving}>
                  Create Contact
                </button>
              ) : viewMode === 'edit' ? (
                <button className="primary" onClick={handleUpdate} disabled={saving}>
                  Save Changes
                </button>
              ) : (
                <div className="muted">{hasSelection ? `Viewing ${selected?.displayName}` : 'No contact selected'}</div>
              )}
              {(viewMode === 'edit' || viewMode === 'new') && (
                <div className="muted">{dirty ? 'Unsaved changes' : 'All changes saved'}</div>
              )}
            </div>
          </section>
        )}
      </main>

      {customLabelTarget && (
        <div className="modal-backdrop" onClick={closeCustomLabel}>
          <div
            className="modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h3>Custom Label</h3>
            <p>Add your own label for this {customLabelTarget.kind}.</p>
            <input
              autoFocus
              placeholder="Label"
              value={customLabelDraft}
              onChange={(event) => setCustomLabelDraft(event.target.value)}
            />
            <div className="modal__actions">
              <button className="ghost" onClick={closeCustomLabel}>
                Cancel
              </button>
              <button className="primary" onClick={saveCustomLabel}>
                Save Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewContact({ contact }: { contact: Contact | null }) {
  if (!contact) return null;
  const phones = contact.phones;
  const emails = contact.emails;

  return (
    <div>
      <div className="detail-grid detail-grid--view">
        <div className="detail-card">
          <label>Display Name</label>
          <div className="detail-value">{contact.displayName}</div>
        </div>
        <div className="detail-card">
          <label>Note</label>
          <div className="detail-value">{contact.note || '—'}</div>
        </div>
      </div>

      <div className="detail-grid detail-grid--view">
        <div className="detail-card">
          <label>Phones</label>
          <ul className="detail-list">
            {phones.length ? (
              phones.map((p) => (
                <li key={p.id}>
                  <span className="chip">{p.label || 'Phone'}</span>
                  <span>{p.phone}</span>
                </li>
              ))
            ) : (
              <li className="muted">No phones yet.</li>
            )}
          </ul>
        </div>
        <div className="detail-card">
          <label>Emails</label>
          <ul className="detail-list">
            {emails.length ? (
              emails.map((e) => (
                <li key={e.id}>
                  <span className="chip">{e.label || 'Email'}</span>
                  <span>{e.email}</span>
                </li>
              ))
            ) : (
              <li className="muted">No emails yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function EditContact({
  draft,
  onChange,
  onCustomLabel,
  onUpdateDraft
}: {
  draft: ContactDraft;
  onChange: (next: ContactDraft) => void;
  onCustomLabel: (kind: FieldKind, id: string, currentLabel: string) => void;
  onUpdateDraft: (updater: (prev: ContactDraft) => ContactDraft) => void;
}) {
  return (
    <div>
      <div className="detail-grid">
        <div>
          <label>Display Name *</label>
          <input
            value={draft.displayName}
            onChange={(e) => onChange({ ...draft, displayName: e.target.value })}
            placeholder="Ada Lovelace"
          />
        </div>
        <div>
          <label>Note</label>
          <textarea
            value={draft.note}
            onChange={(e) => onChange({ ...draft, note: e.target.value })}
            placeholder="Context, tags, or reminders"
          />
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <label>Phones</label>
          <div className="inline-list">
            {draft.phones.map((item, idx) => (
              <div className="inline-row" key={item.id}>
                <LabelSelect
                  value={item.label}
                  options={PHONE_LABELS}
                  placeholder="Label"
                  onChange={(value) => {
                    const next = [...draft.phones];
                    next[idx] = { ...item, label: value };
                    onChange({ ...draft, phones: next });
                  }}
                  onCustom={() => onCustomLabel('phone', item.id, item.label)}
                />
                <input
                  placeholder="Phone"
                  value={item.phone}
                  onChange={(e) => {
                    const next = [...draft.phones];
                    next[idx] = { ...item, phone: e.target.value };
                    onChange({ ...draft, phones: next });
                  }}
                />
                <button
                  className="ghost"
                  onClick={() => {
                    const next = draft.phones.filter((_, i) => i !== idx);
                    onChange({ ...draft, phones: next });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="ghost"
              onClick={() =>
                onUpdateDraft((prev) => ({
                  ...prev,
                  phones: [...prev.phones, { id: cryptoId(), label: '', phone: '' }]
                }))
              }
            >
              Add phone
            </button>
          </div>
        </div>
        <div>
          <label>Emails</label>
          <div className="inline-list">
            {draft.emails.map((item, idx) => (
              <div className="inline-row" key={item.id}>
                <LabelSelect
                  value={item.label}
                  options={EMAIL_LABELS}
                  placeholder="Label"
                  onChange={(value) => {
                    const next = [...draft.emails];
                    next[idx] = { ...item, label: value };
                    onChange({ ...draft, emails: next });
                  }}
                  onCustom={() => onCustomLabel('email', item.id, item.label)}
                />
                <input
                  placeholder="Email"
                  value={item.email}
                  onChange={(e) => {
                    const next = [...draft.emails];
                    next[idx] = { ...item, email: e.target.value };
                    onChange({ ...draft, emails: next });
                  }}
                />
                <button
                  className="ghost"
                  onClick={() => {
                    const next = draft.emails.filter((_, i) => i !== idx);
                    onChange({ ...draft, emails: next });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="ghost"
              onClick={() =>
                onUpdateDraft((prev) => ({
                  ...prev,
                  emails: [...prev.emails, { id: cryptoId(), label: '', email: '' }]
                }))
              }
            >
              Add email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabelSelect({
  value,
  options,
  placeholder,
  onChange,
  onCustom
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  onCustom: () => void;
}) {
  const baseOptions = options;
  const hasCustomValue = value && !baseOptions.includes(value);
  const selectValue = value || '';

  return (
    <select
      value={selectValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (nextValue === CUSTOM_LABEL_VALUE) {
          onCustom();
          return;
        }
        onChange(nextValue);
      }}
    >
      <option value="">{placeholder}</option>
      {baseOptions.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
      {hasCustomValue && (
        <option value={value}>{`Custom: ${value}`}</option>
      )}
      <option value={CUSTOM_LABEL_VALUE}>Custom…</option>
    </select>
  );
}

function draftToPayload(draft: ContactDraft) {
  return {
    displayName: draft.displayName.trim(),
    note: draft.note.trim() ? draft.note.trim() : null,
    phones: draft.phones
      .map((p) => ({ label: p.label.trim() || null, phone: p.phone.trim() }))
      .filter((p) => p.phone),
    emails: draft.emails
      .map((e) => ({ label: e.label.trim() || null, email: e.email.trim() }))
      .filter((e) => e.email)
  };
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export default App;
