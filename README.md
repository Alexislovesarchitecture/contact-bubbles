# Contact Bubbles

Local-first contacts + relationship linking + bubble/graph view.

## Prereqs
- Node.js 20+ recommended
- npm 9+

## Install
From repo root:
```
npm install
```

### Installer scripts
- macOS/Linux: `./scripts/install.sh`
- Windows (PowerShell): `./scripts/install.ps1`

## Run (dev)
```
npm run dev
```

## Test
```
npm run test
```

## Database
SQLite file location:
- `server/data/contacts.sqlite`

## Features (MVP)
1) Contacts CRUD
- Create contact (display name required; optional: phone, email, note)
- List contacts (sorted A–Z), search by name/email/phone
- View contact details
- Edit + delete contact
- Data persists across restarts

2) Linking / relationships between contacts (zettelkasten-ish)
- On a contact detail page: section “Links” listing related contacts
- Add link: choose another contact, choose relationship type (friend/family/coworker/custom), optional note (“why linked”), optional strength (1–5), optional directed/undirected
- Remove link

3) “Contact bubble” relationship view (local graph)
- A bubble/graph view that shows the selected contact as the center node and linked contacts around it
- Depth control: 1–3 (depth=1 shows direct neighbors)
- Filters: toggle relationship types
- Interactions: pan/zoom, drag nodes, click node to navigate
