export type ContactListItem = {
  id: string;
  displayName: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Contact = ContactListItem & {
  phones: Array<{ id: string; label: string | null; phone: string }>;
  emails: Array<{ id: string; label: string | null; email: string }>;
};

export type Relationship = {
  id: string;
  fromContactId: string;
  toContactId: string;
  fromDisplayName?: string;
  toDisplayName?: string;
  type: string;
  directed: 0 | 1;
  strength: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GraphNode = { id: string; displayName: string };
export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  directed: 0 | 1;
  strength: number | null;
};

export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}
