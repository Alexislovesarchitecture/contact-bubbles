import { useEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import {
  apiDelete,
  apiGet,
  apiSend,
  type Contact,
  type ContactListItem,
  type GraphResponse,
  type Relationship
} from './api';
import './App.css';

type ContactDraft = {
  displayName: string;
  note: string;
  phones: Array<{ id: string; label: string; phone: string }>;
  emails: Array<{ id: string; label: string; email: string }>;
};

type RelationshipDraft = {
  toContactId: string;
  type: string;
  customType: string;
  directed: boolean;
  strength: string;
  note: string;
};

const REL_TYPES = ['friend', 'family', 'coworker', 'custom'];

function emptyContactDraft(): ContactDraft {
  return { displayName: '', note: '', phones: [], emails: [] };
}

function App() {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(emptyContactDraft());
  const [editMode, setEditMode] = useState(false);
  const [relDraft, setRelDraft] = useState<RelationshipDraft>({
    toContactId: '',
    type: 'friend',
    customType: '',
    directed: false,
    strength: '',
    note: ''
  });
  const [graphDepth, setGraphDepth] = useState(1);
  const [graphTypes, setGraphTypes] = useState<string[]>(['friend', 'family', 'coworker', 'custom']);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);

  useEffect(() => {
    void loadContacts();
  }, [query]);

  useEffect(() => {
    if (!selectedId) return;
    void loadContact(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    void loadRelationships(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    void loadGraph(selectedId, graphDepth, graphTypes);
  }, [selectedId, graphDepth, graphTypes]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ contacts: ContactListItem[] }>(`/api/contacts?query=${encodeURIComponent(query)}`);
      setContacts(data.contacts);
      if (!selectedId && data.contacts.length) setSelectedId(data.contacts[0].id);
      if (selectedId && !data.contacts.find((c) => c.id === selectedId)) {
        setSelectedId(data.contacts[0]?.id ?? null);
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

  async function loadRelationships(id: string) {
    setError(null);
    try {
      const data = await apiGet<{ relationships: Relationship[] }>(`/api/contacts/${id}/relationships`);
      setRelationships(data.relationships);
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadGraph(id: string, depth: number, types: string[]) {
    setError(null);
    try {
      const typesParam = types.length ? `&types=${encodeURIComponent(types.join(','))}` : '';
      const data = await apiGet<GraphResponse>(
        `/api/graph/local?contactId=${encodeURIComponent(id)}&depth=${depth}${typesParam}`
      );
      setGraphData(data);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleCreate() {
    setError(null);
    try {
      const payload = draftToPayload(draft);
      const contact = await apiSend<Contact>('/api/contacts', 'POST', payload);
      setDraft(emptyContactDraft());
      setEditMode(false);
      await loadContacts();
      setSelectedId(contact.id);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUpdate() {
    if (!selectedId) return;
    setError(null);
    try {
      const payload = draftToPayload(draft);
      await apiSend<Contact>(`/api/contacts/${selectedId}`, 'PUT', payload);
      setEditMode(false);
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
      setRelationships([]);
      setGraphData(null);
      await loadContacts();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleAddRelationship() {
    if (!selectedId) return;
    if (!relDraft.toContactId) {
      setError('Select a contact to link.');
      return;
    }
    setError(null);
    try {
      const type = relDraft.type === 'custom' ? relDraft.customType.trim() || 'custom' : relDraft.type;
      await apiSend('/api/relationships', 'POST', {
        fromContactId: selectedId,
        toContactId: relDraft.toContactId,
        type,
        directed: relDraft.directed,
        strength: relDraft.strength ? Number(relDraft.strength) : null,
        note: relDraft.note || null
      });
      setRelDraft({
        toContactId: '',
        type: 'friend',
        customType: '',
        directed: false,
        strength: '',
        note: ''
      });
      await loadRelationships(selectedId);
      await loadGraph(selectedId, graphDepth, graphTypes);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteRelationship(id: string) {
    if (!confirm('Remove this link?')) return;
    setError(null);
    try {
      await apiDelete(`/api/relationships/${id}`);
      if (selectedId) {
        await loadRelationships(selectedId);
        await loadGraph(selectedId, graphDepth, graphTypes);
      }
    } catch (err) {
      setError(String(err));
    }
  }

  const selectedLabel = selected ? selected.displayName : 'No contact selected';

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Contact Bubbles</h1>
          <p>Local-first contacts + relationships + graph view.</p>
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
            <button onClick={() => {
              setEditMode(false);
              setDraft(emptyContactDraft());
            }}>
              New Contact
            </button>
          </div>
        </section>

        <section className="panel panel--wide">
          <div className="panel__header">
            <h2>{editMode ? 'Edit Contact' : 'Contact Detail'}</h2>
            <div className="panel__actions">
              {selectedId && !editMode && (
                <button onClick={() => setEditMode(true)}>Edit</button>
              )}
              {selectedId && (
                <button className="danger" onClick={handleDelete}>Delete</button>
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
            {!selectedId && (
              <button onClick={handleCreate}>Create Contact</button>
            )}
            {selectedId && editMode && (
              <button onClick={handleUpdate}>Save Changes</button>
            )}
            {selectedId && !editMode && (
              <div className="muted">Viewing {selectedLabel}</div>
            )}
          </div>
        </section>
      </main>

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Links + Graph</h2>
        </div>
        <div className="panel__body grid-two">
          <div>
            <h3>Links for {selectedLabel}</h3>
            {!selectedId ? (
              <div className="empty">Select a contact to manage links.</div>
            ) : (
              <>
                <div className="link-form">
                  <select
                    value={relDraft.toContactId}
                    onChange={(e) => setRelDraft({ ...relDraft, toContactId: e.target.value })}
                  >
                    <option value="">Choose contact</option>
                    {contacts
                      .filter((c) => c.id !== selectedId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.displayName}
                        </option>
                      ))}
                  </select>
                  <select
                    value={relDraft.type}
                    onChange={(e) => setRelDraft({ ...relDraft, type: e.target.value })}
                  >
                    {REL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {relDraft.type === 'custom' && (
                    <input
                      placeholder="Custom type"
                      value={relDraft.customType}
                      onChange={(e) => setRelDraft({ ...relDraft, customType: e.target.value })}
                    />
                  )}
                  <select
                    value={relDraft.strength}
                    onChange={(e) => setRelDraft({ ...relDraft, strength: e.target.value })}
                  >
                    <option value="">Strength</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={relDraft.directed}
                      onChange={(e) => setRelDraft({ ...relDraft, directed: e.target.checked })}
                    />
                    Directed
                  </label>
                  <input
                    placeholder="Why linked?"
                    value={relDraft.note}
                    onChange={(e) => setRelDraft({ ...relDraft, note: e.target.value })}
                  />
                  <button onClick={handleAddRelationship}>Add Link</button>
                </div>

                <ul className="relationship-list">
                  {relationships.map((r) => (
                    <li key={r.id}>
                      <div>
                        <strong>{r.fromDisplayName}</strong> → <strong>{r.toDisplayName}</strong>
                        <div className="meta">
                          {r.type} · {r.directed ? 'directed' : 'undirected'}
                          {r.strength ? ` · strength ${r.strength}` : ''}
                        </div>
                        {r.note ? <div className="note">“{r.note}”</div> : null}
                      </div>
                      <button className="ghost" onClick={() => handleDeleteRelationship(r.id)}>
                        Remove
                      </button>
                    </li>
                  ))}
                  {!relationships.length && <li className="empty">No links yet.</li>}
                </ul>
              </>
            )}
          </div>
          <div>
            <GraphControls
              depth={graphDepth}
              setDepth={setGraphDepth}
              types={graphTypes}
              setTypes={setGraphTypes}
            />
            <GraphView
              data={graphData}
              onNodeClick={(id) => setSelectedId(id)}
              activeId={selectedId}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function GraphControls({
  depth,
  setDepth,
  types,
  setTypes
}: {
  depth: number;
  setDepth: (n: number) => void;
  types: string[];
  setTypes: (t: string[]) => void;
}) {
  return (
    <div className="graph-controls">
      <div>
        <label>Depth</label>
        <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
          {[1, 2, 3].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="type-toggles">
        {REL_TYPES.map((t) => (
          <label key={t} className="checkbox">
            <input
              type="checkbox"
              checked={types.includes(t)}
              onChange={(e) => {
                if (e.target.checked) setTypes([...types, t]);
                else setTypes(types.filter((x) => x !== t));
              }}
            />
            {t}
          </label>
        ))}
      </div>
    </div>
  );
}

function GraphView({
  data,
  onNodeClick,
  activeId
}: {
  data: GraphResponse | null;
  onNodeClick: (id: string) => void;
  activeId: string | null;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);

  const prepared = useMemo(() => {
    if (!data) return null;
    const nodes = data.nodes.map((n) => ({ ...n }));
    const degree = new Map<string, number>();
    for (const e of data.edges) {
      degree.set(e.from, (degree.get(e.from) || 0) + 1);
      degree.set(e.to, (degree.get(e.to) || 0) + 1);
    }
    return { nodes, edges: data.edges, degree };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = select(svgRef.current);
    const g = select(gRef.current);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setTransform(event.transform);
      });
    svg.call(z as any);
    svg.call(z.transform as any, zoomIdentity);
  }, []);

  useEffect(() => {
    if (!prepared || !svgRef.current) return;
    const { nodes, edges } = prepared;
    const svgEl = svgRef.current;
    const width = svgEl.clientWidth || 640;
    const height = svgEl.clientHeight || 420;

    const sim = forceSimulation(nodes as any)
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'link',
        forceLink(edges as any)
          .id((d: any) => d.id)
          .distance(120)
          .strength(0.7)
      )
      .force('collide', forceCollide().radius(38));

    const tick = () => {
      if (!gRef.current) return;
      const g = gRef.current;
      const nodeEls = g.querySelectorAll<SVGGElement>('g.node');
      nodeEls.forEach((el) => {
        const id = el.getAttribute('data-id');
        const n = nodes.find((x) => x.id === id);
        if (n) {
          el.setAttribute('transform', `translate(${n.x ?? 0}, ${n.y ?? 0})`);
        }
      });
      const edgeEls = g.querySelectorAll<SVGLineElement>('line.edge');
      edgeEls.forEach((el) => {
        const from = el.getAttribute('data-from');
        const to = el.getAttribute('data-to');
        const n1 = nodes.find((x) => x.id === from);
        const n2 = nodes.find((x) => x.id === to);
        if (n1 && n2) {
          el.setAttribute('x1', String(n1.x ?? 0));
          el.setAttribute('y1', String(n1.y ?? 0));
          el.setAttribute('x2', String(n2.x ?? 0));
          el.setAttribute('y2', String(n2.y ?? 0));
        }
      });
    };

    sim.on('tick', tick);

    return () => {
      sim.stop();
    };
  }, [prepared]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = event.target as HTMLElement;
    const nodeGroup = target.closest('g.node') as SVGGElement | null;
    if (!nodeGroup || !prepared) return;
    const nodeId = nodeGroup.getAttribute('data-id');
    if (!nodeId) return;
    const node = prepared.nodes.find((n) => n.id === nodeId) as any;
    if (!node) return;
    node.fx = node.x;
    node.fy = node.y;
    nodeGroup.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => {
      const point = screenToSvg(svgRef.current!, e.clientX, e.clientY, transform);
      node.fx = point.x;
      node.fy = point.y;
    };

    const up = () => {
      node.fx = null;
      node.fy = null;
      nodeGroup.removeEventListener('pointermove', move);
      nodeGroup.removeEventListener('pointerup', up);
      nodeGroup.removeEventListener('pointercancel', up);
    };

    nodeGroup.addEventListener('pointermove', move);
    nodeGroup.addEventListener('pointerup', up);
    nodeGroup.addEventListener('pointercancel', up);
  };

  if (!prepared) {
    return <div className="graph-empty">Select a contact to view graph.</div>;
  }

  return (
    <div className="graph-shell">
      <svg ref={svgRef} onPointerDown={handlePointerDown}>
        <g ref={gRef}>
          {prepared.edges.map((e) => (
            <line
              key={e.id}
              className={`edge ${e.directed ? 'directed' : ''}`}
              data-from={e.from}
              data-to={e.to}
            />
          ))}
          {prepared.nodes.map((n) => {
            const degree = prepared.degree.get(n.id) || 0;
            const radius = 18 + Math.min(10, degree * 2);
            return (
              <g
                key={n.id}
                className={`node ${n.id === activeId ? 'active' : ''}`}
                data-id={n.id}
                onClick={() => onNodeClick(n.id)}
              >
                <circle r={radius} />
                <text textAnchor="middle" dy="0.35em">
                  {n.displayName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
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

function screenToSvg(svg: SVGSVGElement, x: number, y: number, transform: ZoomTransform) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const global = pt.matrixTransform(svg.getScreenCTM()!.inverse());
  return {
    x: (global.x - transform.x) / transform.k,
    y: (global.y - transform.y) / transform.k
  };
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export default App;
