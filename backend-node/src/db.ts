import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;

export const defaultDbFile = fileURLToPath(new URL('../data.db', import.meta.url));

// Drop order matters with foreign_keys = ON: children before parents.
const tables = [
  'dev_outbox',
  'group_invites',
  'settlements',
  'expense_splits',
  'expenses',
  'group_members',
  'groups',
  'users',
];

export function openDb(file = defaultDbFile): Db {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  createSchema(db);
  return db;
}

export function resetSchema(db: Db) {
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t}`);
  createSchema(db);
}

export function createSchema(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      paid_by INTEGER NOT NULL REFERENCES users(id),
      amount_paise INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      spent_on TEXT NOT NULL,
      split_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expense_splits (
      expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      share_paise INTEGER NOT NULL,
      PRIMARY KEY (expense_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      from_user INTEGER NOT NULL REFERENCES users(id),
      to_user INTEGER NOT NULL REFERENCES users(id),
      amount_paise INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    -- Only the SHA-256 of the invite token is stored. The raw token exists in the
    -- email and nowhere else, so a dump of this table cannot be used to join groups.
    CREATE TABLE IF NOT EXISTS group_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      invited_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT
    );
    -- One live invite per email per group: re-inviting replaces rather than piles up.
    CREATE UNIQUE INDEX IF NOT EXISTS group_invites_pending
      ON group_invites (group_id, email) WHERE accepted_at IS NULL;
    -- Development mail sink for MAIL_TRANSPORT=outbox. Never served in production.
    CREATE TABLE IF NOT EXISTS dev_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
