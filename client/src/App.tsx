import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiSend, type Contact, type ContactListItem } from './api';
import './App.css';

type ContactDraft = {
  displayName: string;
  note: string;
  phones: Array<{ id: string; label: string; phone: string }>;
  emails: Array<{ id: string; label: string; email: string }>;
};

function emptyContactDraft(): ContactDraft {
  return { displayName: '', note: '', phones: [], emails: [] };
}

function App() {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(emptyContactDraft());

  useEffect(() => {
    void loadContacts();
  }, [query]);

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

      if (selectedId && !stillSelected) {
        setSelectedId(data.contacts[0]?.id ?? null);
      }

      if (!selectedId && data.contacts.length && draftIsEmpty) {
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
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setError(null);
    const payload = draftToPayload(draft);
    if (!payload.displayName) {
      setError('Display name is required.');
      return;
    }

    try {
      const contact = await apiSend<Contact>('/api/contacts', 'POST', payload);
      setDraft(emptyContactDraft());
      await loadContacts();
      setSelectedId(contact.id);
    } catch (err) {
      setError(String(err));
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

    try {
      await apiSend<Contact>(`/api/contacts/${selectedId}`, 'PUT', payload);
      await loadContacts();
      await loadContact(selectedId);
    } catch (err) {
      setError(String(err));
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
      await loadContacts();
    } catch (err) {
      setError(String(err));
    }
  }

  function handleNew() {
    setError(null);
    setSelectedId(null);
    setSelected(null);
    setDraft(emptyContactDraft());
  }

  const isNew = !selectedId;
  const selectedLabel = selected ? selected.displayName : 'New contact';

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Contacts</h1>
          <p>Simple local contact list with notes, phones, and emails.</p>
        </div>
        <div className="app__status">
          {loading ? <span className="pill">Loading…</span> : <span className="pill pill--ok">Ready</span>}
          {error ? <span className="pill pill--error">{error}</span> : null}
        </div>
      </header>

      <main className="app__body">
        <section className="panel">
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
                  onClick={() => setSelectedId(c.id)}
                >
                  <div className="contact-name">{c.displayName}</div>
                  <div className="contact-meta">{c.note || '—'}</div>
                </li>
              ))}
              {!contacts.length && <li className="empty">No contacts yet.</li>}
            </ul>
          </div>
          <div className="panel__footer">
            <button onClick={handleNew}>New Contact</button>
            <div className="muted">{contacts.length} total</div>
          </div>
        </section>

        <section className="panel panel--wide">
          <div className="panel__header">
            <h2>{isNew ? 'New Contact' : 'Contact Details'}</h2>
            <div className="panel__actions">
              {!isNew && (
                <button className="danger" onClick={handleDelete}>
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="panel__body">
            <div className="detail-grid">
              <div>
                <label>Display Name *</label>
                <input
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  placeholder="Ada Lovelace"
                />
              </div>
              <div>
                <label>Note</label>
                <textarea
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="Context, tags, or reminders"
                />
              </div>
            </div>

            <div className="detail-grid">
              <div>
                <label>Phones</label>
                <InlineList
                  items={draft.phones}
                  onAdd={() =>
                    setDraft({
                      ...draft,
                      phones: [...draft.phones, { id: cryptoId(), label: '', phone: '' }]
                    })
                  }
                  renderItem={(item, idx) => (
                    <div className="inline-row" key={item.id}>
                      <input
                        placeholder="Label"
                        value={item.label}
                        onChange={(e) => {
                          const next = [...draft.phones];
                          next[idx] = { ...item, label: e.target.value };
                          setDraft({ ...draft, phones: next });
                        }}
                      />
                      <input
                        placeholder="Phone"
                        value={item.phone}
                        onChange={(e) => {
                          const next = [...draft.phones];
                          next[idx] = { ...item, phone: e.target.value };
                          setDraft({ ...draft, phones: next });
                        }}
                      />
                      <button
                        className="ghost"
                        onClick={() => {
                          const next = draft.phones.filter((_, i) => i !== idx);
                          setDraft({ ...draft, phones: next });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                />
              </div>
              <div>
                <label>Emails</label>
                <InlineList
                  items={draft.emails}
                  onAdd={() =>
                    setDraft({
                      ...draft,
                      emails: [...draft.emails, { id: cryptoId(), label: '', email: '' }]
                    })
                  }
                  renderItem={(item, idx) => (
                    <div className="inline-row" key={item.id}>
                      <input
                        placeholder="Label"
                        value={item.label}
                        onChange={(e) => {
                          const next = [...draft.emails];
                          next[idx] = { ...item, label: e.target.value };
                          setDraft({ ...draft, emails: next });
                        }}
                      />
                      <input
                        placeholder="Email"
                        value={item.email}
                        onChange={(e) => {
                          const next = [...draft.emails];
                          next[idx] = { ...item, email: e.target.value };
                          setDraft({ ...draft, emails: next });
                        }}
                      />
                      <button
                        className="ghost"
                        onClick={() => {
                          const next = draft.emails.filter((_, i) => i !== idx);
                          setDraft({ ...draft, emails: next });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="panel__footer">
            {isNew ? (
              <button onClick={handleCreate}>Create Contact</button>
            ) : (
              <button onClick={handleUpdate}>Save Changes</button>
            )}
            <div className="muted">{isNew ? 'Creating a new contact' : `Viewing ${selectedLabel}`}</div>
          </div>
        </section>
      </main>
    </div>
  );
}

function InlineList<T>({
  items,
  onAdd,
  renderItem
}: {
  items: T[];
  onAdd: () => void;
  renderItem: (item: T, idx: number) => React.ReactNode;
}) {
  return (
    <div className="inline-list">
      {items.map((item, idx) => renderItem(item, idx))}
      <button className="ghost" onClick={onAdd}>
        Add
      </button>
    </div>
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
