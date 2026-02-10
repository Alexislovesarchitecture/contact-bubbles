# Contact Bubbles

Simple local contact manager for names, notes, phones, and emails.

## Prereqs
- Node.js 20+ recommended
- npm 9+

## Install
From repo root:
```
npm install
```

Or run the setup script alias:
```
npm run setup
```

## Installer (optional)
If you prefer a guided setup from repo root:
- macOS/Linux: `./scripts/install.sh`
- Windows (PowerShell): `./scripts/install.ps1`

## Run (dev)
From repo root:
```
npm run dev
```
Then open `http://localhost:5173`.

## Test
```
npm run test
```

## Database
Default SQLite file:
- `server/data/contacts.sqlite`

Override with an absolute or relative path:
```
CONTACTS_DB_PATH=./my-contacts.sqlite npm --workspace server run dev
```

## Features (MVP)
1. Contacts CRUD
- Create contact (display name required; optional: phone, email, note)
- List contacts (search by name/email/phone)
- View contact details
- Edit + delete contact
- Data persists across restarts
