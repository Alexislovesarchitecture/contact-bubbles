export type Contact = {
  id: string;
  displayName: string;
  note: string | null;
  phones: Array<{ id: string; label: string | null; phone: string }>;
  emails: Array<{ id: string; label: string | null; email: string }>;
  createdAt: string;
  updatedAt: string;
};

export type Relationship = {
  id: string;
  fromContactId: string;
  toContactId: string;
  type: string;
  directed: 0 | 1;
  strength: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};
