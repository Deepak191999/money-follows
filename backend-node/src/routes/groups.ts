import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import type { User } from '../auth.js';
import { HttpError, idParam, parseBody } from '../http.js';

type Group = { id: number; name: string; created_by: number };

const nameBody = z.object({ name: z.string().min(1) });
const memberBody = z.object({ email: z.email() });
const settleBody = z.object({ from_user: z.number().int(), to_user: z.number().int(), amount_paise: z.number().int().min(1) });

export function isMember(db: Db, groupId: number, userId: number): boolean {
  return !!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
}

export function memberIds(db: Db, groupId: number): number[] {
  return (db.prepare('SELECT user_id FROM group_members WHERE group_id = ? ORDER BY user_id').all(groupId) as { user_id: number }[]).map(
    (r) => r.user_id,
  );
}

export function requireGroup(db: Db, groupId: number): Group {
  const group = db.prepare('SELECT id, name, created_by FROM groups WHERE id = ?').get(groupId) as Group | undefined;
  if (!group) throw new HttpError(404, 'group not found');
  return group;
}

export function requireMembership(db: Db, groupId: number, userId: number): Group {
  const group = requireGroup(db, groupId);
  if (!isMember(db, groupId, userId)) throw new HttpError(404, 'group not found');
  return group;
}

function groupDetail(db: Db, group: Group) {
  const members = db
    .prepare('SELECT u.id, u.name, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? ORDER BY u.id')
    .all(group.id) as User[];
  return { ...group, members };
}

export function groupsRouter(db: Db) {
  const r = Router();

  r.get('/groups', (req, res) => {
    const rows = db
      .prepare('SELECT g.id, g.name, g.created_by FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ? ORDER BY g.id')
      .all(req.user.id);
    res.json(rows);
  });

  r.post('/groups', (req, res) => {
    const body = parseBody(nameBody, req.body);
    const group = db.transaction(() => {
      const result = db
        .prepare('INSERT INTO groups (name, created_by, created_at) VALUES (?, ?, ?)')
        .run(body.name, req.user.id, new Date().toISOString());
      const id = Number(result.lastInsertRowid);
      db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(id, req.user.id);
      return { id, name: body.name, created_by: req.user.id };
    })();
    res.status(201).json(group);
  });

  r.get('/groups/:id', (req, res) => {
    const group = requireGroup(db, idParam(req));
    res.json(groupDetail(db, group));
  });

  r.patch('/groups/:id', (req, res) => {
    const group = requireGroup(db, idParam(req));
    const body = parseBody(nameBody.partial(), req.body);
    if (body.name !== undefined) {
      db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(body.name, group.id);
      group.name = body.name;
    }
    res.json(group);
  });

  r.delete('/groups/:id', (req, res) => {
    const group = requireMembership(db, idParam(req), req.user.id);
    if (group.created_by !== req.user.id) throw new HttpError(403, 'only the group creator can delete it');
    db.prepare('DELETE FROM groups WHERE id = ?').run(group.id);
    res.status(204).end();
  });

  r.post('/groups/:id/members', (req, res) => {
    const group = requireMembership(db, idParam(req), req.user.id);
    const body = parseBody(memberBody, req.body);
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email.toLowerCase()) as { id: number } | undefined;
    if (!user) throw new HttpError(404, 'no user with that email');
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, user.id);
    res.json(groupDetail(db, group));
  });

  r.get('/groups/:id/balances', (req, res) => {
    const group = requireGroup(db, idParam(req));
    const rows = db
      .prepare(
        `SELECT u.id AS user_id, u.name,
           COALESCE((SELECT SUM(amount_paise) FROM expenses WHERE group_id = g.group_id AND paid_by = u.id), 0)
         - COALESCE((SELECT SUM(s.share_paise) FROM expense_splits s JOIN expenses e ON e.id = s.expense_id WHERE e.group_id = g.group_id AND s.user_id = u.id), 0)
         + COALESCE((SELECT SUM(amount_paise) FROM settlements WHERE group_id = g.group_id AND from_user = u.id), 0)
         - COALESCE((SELECT SUM(amount_paise) FROM settlements WHERE group_id = g.group_id AND to_user = u.id), 0) AS net_paise
         FROM group_members g JOIN users u ON u.id = g.user_id
         WHERE g.group_id = ? ORDER BY u.id`,
      )
      .all(group.id);
    res.json(rows);
  });

  r.post('/groups/:id/settle', (req, res) => {
    const group = requireMembership(db, idParam(req), req.user.id);
    const body = parseBody(settleBody, req.body);
    if (body.from_user === body.to_user) throw new HttpError(400, 'from_user and to_user must differ');
    if (!isMember(db, group.id, body.from_user) || !isMember(db, group.id, body.to_user)) {
      throw new HttpError(400, 'both users must be group members');
    }
    const created_at = new Date().toISOString();
    const result = db
      .prepare('INSERT INTO settlements (group_id, from_user, to_user, amount_paise, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(group.id, body.from_user, body.to_user, body.amount_paise, created_at);
    res.status(201).json({ id: Number(result.lastInsertRowid), group_id: group.id, ...body, created_at });
  });

  return r;
}
