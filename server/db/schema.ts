export const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_phones (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  label TEXT,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_emails (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  label TEXT,
  email TEXT NOT NULL,
  FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  from_contact_id TEXT NOT NULL,
  to_contact_id TEXT NOT NULL,
  type TEXT NOT NULL,
  directed INTEGER NOT NULL DEFAULT 0,
  strength INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(from_contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY(to_contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name);
CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_contact_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_contact_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
`;
