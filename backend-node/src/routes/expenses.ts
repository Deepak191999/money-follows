import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { HttpError, idParam, parseBody } from '../http.js';
import { computeSplits, type Split } from '../money.js';
import { memberIds, requireGroup, requireMembership } from './groups.js';

type ExpenseRow = {
  id: number;
  group_id: number | null;
  paid_by: number;
  amount_paise: number;
  category: string;
  description: string;
  spent_on: string;
  split_type: 'equal' | 'exact' | 'percent';
};

const expenseBody = z.object({
  group_id: z.number().int().nullable().optional(),
  paid_by: z.number().int().optional(),
  amount_paise: z.number().int().min(1),
  category: z.string().min(1),
  description: z.string(),
  spent_on: z.iso.date(),
  split_type: z.enum(['equal', 'exact', 'percent']),
  splits: z.array(z.object({ user_id: z.number().int(), share_paise: z.number().int().min(0) })).optional(),
});
type ExpenseBody = z.infer<typeof expenseBody>;

const selectExpense = 'SELECT id, group_id, paid_by, amount_paise, category, description, spent_on, split_type FROM expenses';
const visibleWhere = '(e.group_id IS NULL AND e.paid_by = ?) OR e.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)';

function withSplits(db: Db, rows: ExpenseRow[]) {
  const splitsFor = db.prepare('SELECT user_id, share_paise FROM expense_splits WHERE expense_id = ? ORDER BY user_id');
  return rows.map((e) => ({ ...e, splits: splitsFor.all(e.id) as Split[] }));
}

function requireExpense(db: Db, id: number): ExpenseRow {
  const row = db.prepare(`${selectExpense} WHERE id = ?`).get(id) as ExpenseRow | undefined;
  if (!row) throw new HttpError(404, 'expense not found');
  return row;
}

function resolve(db: Db, body: ExpenseBody, callerId: number) {
  const groupId = body.group_id ?? null;
  const paidBy = body.paid_by ?? callerId;
  const allowed = groupId === null ? [callerId] : (requireMembership(db, groupId, callerId), memberIds(db, groupId));
  if (!allowed.includes(paidBy)) throw new HttpError(400, 'paid_by must be a group member');
  for (const s of body.splits ?? []) {
    if (!allowed.includes(s.user_id)) throw new HttpError(400, `user ${s.user_id} is not a group member`);
  }
  if (new Set((body.splits ?? []).map((s) => s.user_id)).size !== (body.splits ?? []).length) {
    throw new HttpError(400, 'duplicate user in splits');
  }
  return { groupId, paidBy, splits: computeSplits(body.amount_paise, body.split_type, body.splits, allowed) };
}

export function expensesRouter(db: Db) {
  const r = Router();
  const insertSplit = db.prepare('INSERT INTO expense_splits (expense_id, user_id, share_paise) VALUES (?, ?, ?)');

  r.get('/expenses', (req, res) => {
    let rows: ExpenseRow[];
    if (req.query.group_id !== undefined) {
      const groupId = Number(req.query.group_id);
      if (!Number.isInteger(groupId)) throw new HttpError(400, 'group_id must be an integer');
      requireGroup(db, groupId);
      rows = db.prepare(`${selectExpense} WHERE group_id = ? ORDER BY spent_on, id`).all(groupId) as ExpenseRow[];
    } else {
      rows = db.prepare(`${selectExpense} WHERE group_id IS NULL AND paid_by = ? ORDER BY spent_on, id`).all(req.user.id) as ExpenseRow[];
    }
    res.json(withSplits(db, rows));
  });

  r.post('/expenses', (req, res) => {
    const body = parseBody(expenseBody, req.body);
    const { groupId, paidBy, splits } = resolve(db, body, req.user.id);
    const id = db.transaction(() => {
      const result = db
        .prepare(
          'INSERT INTO expenses (group_id, paid_by, amount_paise, category, description, spent_on, split_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(groupId, paidBy, body.amount_paise, body.category, body.description, body.spent_on, body.split_type, new Date().toISOString());
      const id = Number(result.lastInsertRowid);
      for (const s of splits) insertSplit.run(id, s.user_id, s.share_paise);
      return id;
    })();
    res.status(201).json(withSplits(db, [requireExpense(db, id)])[0]);
  });

  r.get('/expenses/search', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) throw new HttpError(400, 'q is required');
    const rows = db
      .prepare(`${selectExpense} e WHERE (${visibleWhere}) AND (e.description LIKE '%${q}%' OR e.category LIKE '%${q}%') ORDER BY e.spent_on, e.id`)
      .all(req.user.id, req.user.id) as ExpenseRow[];
    res.json(withSplits(db, rows));
  });

  r.get('/expenses/:id', (req, res) => {
    res.json(withSplits(db, [requireExpense(db, idParam(req))])[0]);
  });

  r.patch('/expenses/:id', (req, res) => {
    const existing = requireExpense(db, idParam(req));
    const body = parseBody(expenseBody, req.body);
    const { groupId, paidBy, splits } = resolve(db, body, req.user.id);
    db.transaction(() => {
      db.prepare(
        'UPDATE expenses SET group_id = ?, paid_by = ?, amount_paise = ?, category = ?, description = ?, spent_on = ?, split_type = ? WHERE id = ?',
      ).run(groupId, paidBy, body.amount_paise, body.category, body.description, body.spent_on, body.split_type, existing.id);
      db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(existing.id);
      for (const s of splits) insertSplit.run(existing.id, s.user_id, s.share_paise);
    })();
    res.json(withSplits(db, [requireExpense(db, existing.id)])[0]);
  });

  r.delete('/expenses/:id', (req, res) => {
    const existing = requireExpense(db, idParam(req));
    db.prepare('DELETE FROM expenses WHERE id = ?').run(existing.id);
    res.status(204).end();
  });

  return r;
}
