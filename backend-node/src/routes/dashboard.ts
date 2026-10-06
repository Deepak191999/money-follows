import { Router, type Request } from 'express';
import type { Db } from '../db.js';
import { HttpError } from '../http.js';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthParam(req: Request): string {
  const month = req.query.month;
  if (typeof month !== 'string' || !monthPattern.test(month)) throw new HttpError(400, 'month must be YYYY-MM');
  return month;
}

function inr(paise: number): string {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function dashboardRouter(db: Db) {
  const r = Router();

  r.get('/dashboard/monthly', (req, res) => {
    const month = monthParam(req);
    const by_category = db
      .prepare(
        `SELECT e.category, SUM(s.share_paise) AS total_paise
         FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
         WHERE s.user_id = ? AND substr(e.spent_on, 1, 7) = ?
         GROUP BY e.category ORDER BY total_paise DESC, e.category`,
      )
      .all(req.user.id, month) as { category: string; total_paise: number }[];
    const total_paise = by_category.reduce((sum, c) => sum + c.total_paise, 0);
    res.json({ month, total_paise, by_category });
  });

  r.get('/export/csv', (req, res) => {
    const month = monthParam(req);
    const rows = db
      .prepare(
        `SELECT e.spent_on, e.description, e.category, COALESCE(g.name, '') AS group_name, u.name AS paid_by, e.amount_paise, s.share_paise
         FROM expense_splits s
         JOIN expenses e ON e.id = s.expense_id
         JOIN users u ON u.id = e.paid_by
         LEFT JOIN groups g ON g.id = e.group_id
         WHERE s.user_id = ? AND substr(e.spent_on, 1, 7) = ?
         ORDER BY e.spent_on, e.id`,
      )
      .all(req.user.id, month) as {
      spent_on: string; description: string; category: string; group_name: string; paid_by: string; amount_paise: number; share_paise: number;
    }[];
    const lines = ['date,description,category,group,paid_by,amount_inr,my_share_inr'];
    for (const row of rows) {
      lines.push(
        [row.spent_on, row.description, row.category, row.group_name, row.paid_by, inr(row.amount_paise), inr(row.share_paise)].map(csvCell).join(','),
      );
    }
    res.type('text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${month}.csv"`);
    res.send(lines.join('\r\n') + '\r\n');
  });

  return r;
}
