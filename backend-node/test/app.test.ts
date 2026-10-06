import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { seed } from '../src/seed.js';

const db = openDb(':memory:');
seed(db);
const app = createApp(db);

async function login(email: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password: 'password123' });
  expect(res.status).toBe(200);
  return res.body.token;
}

let asha: string;
let chetan: string;

beforeAll(async () => {
  asha = await login('asha@example.com');
  chetan = await login('chetan@example.com');
});

describe('auth', () => {
  it('login returns a token and the user', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'bilal@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toEqual({ id: 2, name: 'Bilal Khan', email: 'bilal@example.com' });
  });

  it('rejects a token signed with the wrong secret', async () => {
    // docker-compose.yml passed JWT_SECRET while auth.ts signed with a constant
    // committed to the repo. Anyone reading the source could mint this token.
    const forged = jwt.sign({ sub: '1' }, 'moneyfollows-2026');
    const res = await request(app).get('/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('issues tokens that expire', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'asha@example.com', password: 'password123' });
    const payload = jwt.decode(res.body.token) as { exp?: number; iat?: number };
    expect(payload.exp).toBeTypeOf('number');
    expect(payload.exp! - payload.iat!).toBeGreaterThan(0);
  });

  it('me returns the caller', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, name: 'Asha Rao', email: 'asha@example.com' });
  });
});

describe('groups', () => {
  it('lists only groups the caller belongs to', async () => {
    const res = await request(app).get('/groups').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.map((g: { id: number }) => g.id)).toEqual([1, 2]);
  });

  it('returns group detail with members', async () => {
    const res = await request(app).get('/groups/1').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Goa trip');
    expect(res.body.members).toHaveLength(3);
  });

  it('gives 404 for an unknown group', async () => {
    const res = await request(app).get('/groups/99').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'group not found' });
  });

  it('balances sum to zero', async () => {
    const res = await request(app).get('/groups/1/balances').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.reduce((sum: number, b: { net_paise: number }) => sum + b.net_paise, 0)).toBe(0);
  });

  it('settling reduces what the payer owes', async () => {
    const before = await request(app).get('/groups/1/balances').set('Authorization', `Bearer ${asha}`);
    const chetanBefore = before.body.find((b: { user_id: number }) => b.user_id === 3).net_paise;
    const settle = await request(app)
      .post('/groups/1/settle')
      .set('Authorization', `Bearer ${chetan}`)
      .send({ from_user: 3, to_user: 1, amount_paise: 50000 });
    expect(settle.status).toBe(201);
    expect(settle.body.group_id).toBe(1);
    const after = await request(app).get('/groups/1/balances').set('Authorization', `Bearer ${asha}`);
    expect(after.body.find((b: { user_id: number }) => b.user_id === 3).net_paise).toBe(chetanBefore + 50000);
    expect(after.body.reduce((sum: number, b: { net_paise: number }) => sum + b.net_paise, 0)).toBe(0);
  });
});

describe('expenses', () => {
  it('equal split divides the amount across the members', async () => {
    const res = await request(app).post('/expenses').set('Authorization', `Bearer ${asha}`).send({
      group_id: 1,
      amount_paise: 90000,
      category: 'Food',
      description: 'Snacks',
      spent_on: '2026-08-16',
      split_type: 'equal',
    });
    expect(res.status).toBe(201);
    expect(res.body.splits.map((s: { share_paise: number }) => s.share_paise)).toEqual([30000, 30000, 30000]);
  });

  it('rejects exact splits that do not sum to the amount', async () => {
    const res = await request(app).post('/expenses').set('Authorization', `Bearer ${asha}`).send({
      group_id: 1,
      amount_paise: 100000,
      category: 'Food',
      description: 'Snacks',
      spent_on: '2026-08-16',
      split_type: 'exact',
      splits: [{ user_id: 1, share_paise: 50000 }, { user_id: 2, share_paise: 40000 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exact splits sum to 90000/);
  });

  it('lists the caller personal expenses', async () => {
    const res = await request(app).get('/expenses').set('Authorization', `Bearer ${chetan}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe('Headphones');
    const one = await request(app).get('/expenses/20').set('Authorization', `Bearer ${chetan}`);
    expect(one.status).toBe(200);
    expect(one.body.splits).toEqual([{ user_id: 3, share_paise: 249900 }]);
  });

  it('search matches description across visible expenses', async () => {
    const res = await request(app).get('/expenses/search').query({ q: 'bigbasket' }).set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: number }) => e.id)).toEqual([11, 13]);
  });
});

describe('dashboard', () => {
  it('monthly totals the caller share by category', async () => {
    const res = await request(app).get('/dashboard/monthly').query({ month: '2026-09' }).set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-09');
    expect(res.body.total_paise).toBe(2709250);
    expect(res.body.by_category[0]).toEqual({ category: 'Rent', total_paise: 1800000 });
    expect(res.body.by_category.find((c: { category: string }) => c.category === 'Utilities').total_paise).toBe(169950);
  });

  it('csv export has the contract header and INR amounts', async () => {
    const res = await request(app).get('/export/csv').query({ month: '2026-09' }).set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('date,description,category,group,paid_by,amount_inr,my_share_inr');
    expect(lines[1]).toBe('2026-09-01,September rent,Rent,Flat 4B,Bilal Khan,36000.00,18000.00');
  });
});

describe('group invitations', () => {
  // Route mail into the dev_outbox table so the tests can read what was "sent".
  beforeAll(() => {
    process.env.MAIL_TRANSPORT = 'outbox';
  });

  const invite = (token: string, groupId: number, email: string) =>
    request(app).post(`/groups/${groupId}/invites`).set('Authorization', `Bearer ${token}`).send({ email });

  it('adds an existing user straight away instead of emailing them', async () => {
    const res = await invite(asha, 2, 'chetan@example.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'added' });
    const detail = await request(app).get('/groups/2').set('Authorization', `Bearer ${asha}`);
    expect(detail.body.members.map((m: { id: number }) => m.id)).toContain(3);
  });

  it('emails a stranger a link and creates no user yet', async () => {
    const res = await invite(asha, 1, 'Dia@Example.com');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('invited');
    expect(res.body.email).toBe('dia@example.com');
    expect(res.body.invite_url).toContain('/invite/');

    const outbox = await request(app).get('/dev/outbox');
    expect(outbox.body[0].to_email).toBe('dia@example.com');
    expect(outbox.body[0].body).toContain(res.body.invite_url);

    const login = await request(app).post('/auth/login').send({ email: 'dia@example.com', password: 'whatever1' });
    expect(login.status).toBe(401);
  });

  it('re-inviting the same address replaces the pending invite', async () => {
    const first = await invite(asha, 1, 'eve@example.com');
    const second = await invite(asha, 1, 'eve@example.com');
    expect(second.status).toBe(201);
    expect(second.body.invite_url).not.toBe(first.body.invite_url);

    const stale = first.body.invite_url.split('/invite/')[1];
    expect((await request(app).get(`/invites/${stale}`)).status).toBe(404);
    const fresh = second.body.invite_url.split('/invite/')[1];
    expect((await request(app).get(`/invites/${fresh}`)).status).toBe(200);

    const pending = await request(app).get('/groups/1/invites').set('Authorization', `Bearer ${asha}`);
    expect(pending.body.filter((i: { email: string }) => i.email === 'eve@example.com')).toHaveLength(1);
  });

  it('describes an invitation without a token', async () => {
    const created = await invite(asha, 1, 'frank@example.com');
    const token = created.body.invite_url.split('/invite/')[1];
    const res = await request(app).get(`/invites/${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'frank@example.com',
      group_name: 'Goa trip',
      inviter_name: 'Asha Rao',
      has_account: false,
    });
  });

  it('accepting anonymously creates the account and joins the group', async () => {
    const created = await invite(asha, 1, 'gita@example.com');
    const token = created.body.invite_url.split('/invite/')[1];

    const res = await request(app).post(`/invites/${token}/accept`).send({ name: 'Gita Rao', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('gita@example.com');
    expect(res.body.group_id).toBe(1);
    expect(res.body.token).toBeTypeOf('string');

    const mine = await request(app).get('/groups').set('Authorization', `Bearer ${res.body.token}`);
    expect(mine.body.map((g: { id: number }) => g.id)).toContain(1);
  });

  it('ignores an email in the accept body and uses the invited address', async () => {
    const created = await invite(asha, 1, 'hari@example.com');
    const token = created.body.invite_url.split('/invite/')[1];
    const res = await request(app)
      .post(`/invites/${token}/accept`)
      .send({ name: 'Hari', password: 'password123', email: 'attacker@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('hari@example.com');
  });

  it('burns the token: a second accept fails', async () => {
    const created = await invite(asha, 1, 'ila@example.com');
    const token = created.body.invite_url.split('/invite/')[1];
    expect((await request(app).post(`/invites/${token}/accept`).send({ name: 'Ila', password: 'password123' })).status).toBe(201);
    const again = await request(app).post(`/invites/${token}/accept`).send({ name: 'Ila', password: 'password123' });
    expect(again.status).toBe(404);
  });

  it('refuses an invitation forwarded to a different account', async () => {
    const created = await invite(asha, 1, 'jay@example.com');
    const token = created.body.invite_url.split('/invite/')[1];
    const res = await request(app).post(`/invites/${token}/accept`).set('Authorization', `Bearer ${chetan}`).send({});
    expect(res.status).toBe(403);
  });

  it('rejects an unknown token and a weak password identically to a missing one', async () => {
    expect((await request(app).get('/invites/not-a-real-token')).status).toBe(404);
    const created = await invite(asha, 1, 'kiran@example.com');
    const token = created.body.invite_url.split('/invite/')[1];
    const weak = await request(app).post(`/invites/${token}/accept`).send({ name: 'Kiran', password: 'short' });
    expect(weak.status).toBe(400);
  });

  it('does not let a non-member invite to a group', async () => {
    // A group that really exists and that chetan is not in, so the 404 is about
    // membership rather than about a missing row.
    const created = await request(app).post('/groups').set('Authorization', `Bearer ${asha}`).send({ name: 'Asha only' });
    expect(created.status).toBe(201);

    const res = await invite(chetan, created.body.id, 'mallory@example.com');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'group not found' });

    // ...and nothing was recorded against that group.
    const pending = await request(app).get(`/groups/${created.body.id}/invites`).set('Authorization', `Bearer ${asha}`);
    expect(pending.body).toEqual([]);
  });

  it('revokes a pending invitation', async () => {
    const created = await invite(asha, 1, 'nina@example.com');
    const token = created.body.invite_url.split('/invite/')[1];
    const pending = await request(app).get('/groups/1/invites').set('Authorization', `Bearer ${asha}`);
    const row = pending.body.find((i: { email: string }) => i.email === 'nina@example.com');

    const del = await request(app).delete(`/groups/1/invites/${row.id}`).set('Authorization', `Bearer ${asha}`);
    expect(del.status).toBe(204);
    expect((await request(app).get(`/invites/${token}`)).status).toBe(404);
  });
});
