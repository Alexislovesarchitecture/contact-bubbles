import { createApp } from './app.js';
import { getDbPath } from '../db/db.js';

const { app } = createApp();

const port = Number(process.env.PORT || 5174);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`SQLite DB: ${getDbPath()}`);
});
