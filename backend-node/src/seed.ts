import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { openDb, resetSchema, type Db } from './db.js';

export const defaultSeedFile = fileURLToPath(new URL('../../seed/seed.json', import.meta.url));

type Seed = {
  users: { id: number; name: string; email: string; password: string }[];
  groups: { id: number; name: string; created_by: number; members: number[] }[];
  expenses: {
    id: number; group_id: number | null; paid_by: number; amount_paise: number; category: string;
    description: string; spent_on: string; split_type: string; splits: { user_id: number; share_paise: number }[];
  }[];
  settlements: { id: number; group_id: number; from_user: number; to_user: number; amount_paise: number; created_at: string }[];
};

export function seed(db: Db, file = defaultSeedFile) {
  const data = JSON.parse(readFileSync(file, 'utf8')) as Seed;
  const now = new Date().toISOString();
  resetSchema(db);

  const insertUser = db.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)');
  const insertGroup = db.prepare('INSERT INTO groups (id, name, created_by, created_at) VALUES (?, ?, ?, ?)');
  const insertMember = db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)');
  const insertExpense = db.prepare(
    'INSERT INTO expenses (id, group_id, paid_by, amount_paise, category, description, spent_on, split_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const insertSplit = db.prepare('INSERT INTO expense_splits (expense_id, user_id, share_paise) VALUES (?, ?, ?)');
  const insertSettlement = db.prepare(
    'INSERT INTO settlements (id, group_id, from_user, to_user, amount_paise, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );

  db.transaction(() => {
    for (const u of data.users) insertUser.run(u.id, u.name, u.email, bcrypt.hashSync(u.password, 10), now);
    for (const g of data.groups) {
      insertGroup.run(g.id, g.name, g.created_by, now);
      for (const m of g.members) insertMember.run(g.id, m);
    }
    for (const e of data.expenses) {
      insertExpense.run(e.id, e.group_id, e.paid_by, e.amount_paise, e.category, e.description, e.spent_on, e.split_type, now);
      for (const s of e.splits) insertSplit.run(e.id, s.user_id, s.share_paise);
    }
    for (const s of data.settlements) insertSettlement.run(s.id, s.group_id, s.from_user, s.to_user, s.amount_paise, s.created_at);
  })();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openDb();
  seed(db);
  console.log(`seeded ${db.name}`);
}
