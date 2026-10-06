import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Db } from '../db.js';
import { createUser, emailTaken, issueToken, optionalUser } from '../auth.js';
import { HttpError, idParam, parseBody } from '../http.js';
import { appUrl, inviteMessage, inviteTtlDays, sendMail, transportRevealsLink } from '../mail.js';
import { requireMembership } from './groups.js';

type InviteRow = {
  id: number;
  group_id: number;
  email: string;
  invited_by: number;
  created_at: string;
  expires_at: string;
};

const inviteBody = z.object({ email: z.email() });
const acceptBody = z.object({ name: z.string().min(1), password: z.string().min(8) });

/** Max invites a single group may send per hour. An open invite endpoint is a spam relay. */
const INVITE_RATE_LIMIT = 20;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function newToken(): { token: string; token_hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, token_hash: hashToken(token) };
}

const inviteUrl = (token: string) => `${appUrl()}/invite/${token}`;

/**
 * Looks an invite up by its raw token. Unknown, expired and already-accepted
 * tokens all produce the same 404 so this cannot be used to probe for valid
 * tokens or to learn whether an invitation was taken up.
 */
function liveInviteByToken(db: Db, token: string): InviteRow {
  const invite = db
    .prepare(
      `SELECT id, group_id, email, invited_by, created_at, expires_at
         FROM group_invites
        WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?`,
    )
    .get(hashToken(token), new Date().toISOString()) as InviteRow | undefined;
  if (!invite) throw new HttpError(404, 'invitation not found or expired');
  return invite;
}

/** Routes that need a logged-in group member. Mounted behind requireAuth. */
export function invitesRouter(db: Db) {
  const r = Router();

  r.get('/groups/:id/invites', (req, res) => {
    const group = requireMembership(db, idParam(req), req.user.id);
    const rows = db
      .prepare(
        `SELECT i.id, i.email, i.created_at, i.expires_at, u.name AS invited_by_name
           FROM group_invites i JOIN users u ON u.id = i.invited_by
          WHERE i.group_id = ? AND i.accepted_at IS NULL AND i.expires_at > ?
          ORDER BY i.id`,
      )
      .all(group.id, new Date().toISOString());
    res.json(rows);
  });

  r.post('/groups/:id/invites', (req, res) => {
    const group = requireMembership(db, idParam(req), req.user.id);
    const body = parseBody(inviteBody, req.body);
    const email = body.email.toLowerCase();

    // Someone who already has an account does not need an email round-trip.
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (existing) {
      db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, existing.id);
      res.status(200).json({ status: 'added' });
      return;
    }

    const anHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { recent } = db
      .prepare('SELECT COUNT(*) AS recent FROM group_invites WHERE group_id = ? AND created_at > ?')
      .get(group.id, anHourAgo) as { recent: number };
    if (recent >= INVITE_RATE_LIMIT) throw new HttpError(429, 'too many invitations from this group, try again later');

    const { token, token_hash } = newToken();
    const now = new Date();
    const expires_at = new Date(now.getTime() + inviteTtlDays() * 86_400_000).toISOString();

    // Re-inviting the same address replaces the pending row, so the newest link
    // is the only one that works. Enforced by the group_invites_pending index.
    db.prepare(
      `INSERT INTO group_invites (group_id, email, token_hash, invited_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (group_id, email) WHERE accepted_at IS NULL
       DO UPDATE SET token_hash = excluded.token_hash, invited_by = excluded.invited_by,
                     created_at = excluded.created_at, expires_at = excluded.expires_at`,
    ).run(group.id, email, token_hash, req.user.id, now.toISOString(), expires_at);

    sendMail(db, inviteMessage({ to: email, inviterName: req.user.name, groupName: group.name, url: inviteUrl(token) }));

    res.status(201).json({
      status: 'invited',
      email,
      expires_at,
      // Only the dev transports hand the link back; with real mail the address
      // owner is the only one who should ever see it.
      invite_url: transportRevealsLink() ? inviteUrl(token) : undefined,
    });
  });

  r.delete('/groups/:id/invites/:inviteId', (req, res) => {
    const group = requireMembership(db, idParam(req), req.user.id);
    const inviteId = Number(req.params.inviteId);
    if (!Number.isInteger(inviteId) || inviteId < 1) throw new HttpError(400, 'invalid id');
    const result = db
      .prepare('DELETE FROM group_invites WHERE id = ? AND group_id = ? AND accepted_at IS NULL')
      .run(inviteId, group.id);
    if (result.changes === 0) throw new HttpError(404, 'invitation not found');
    res.status(204).end();
  });

  return r;
}

/** Routes reachable without a token, because the invitee may have no account yet. */
export function publicInvitesRouter(db: Db) {
  const r = Router();

  r.get('/invites/:token', (req, res) => {
    const invite = liveInviteByToken(db, req.params.token);
    const row = db
      .prepare(
        `SELECT g.name AS group_name, u.name AS inviter_name
           FROM groups g JOIN users u ON u.id = ?
          WHERE g.id = ?`,
      )
      .get(invite.invited_by, invite.group_id) as { group_name: string; inviter_name: string } | undefined;
    if (!row) throw new HttpError(404, 'invitation not found or expired');
    res.json({
      email: invite.email,
      group_name: row.group_name,
      inviter_name: row.inviter_name,
      expires_at: invite.expires_at,
      // Lets the accept page show a sign-in prompt instead of a signup form.
      has_account: emailTaken(db, invite.email),
    });
  });

  r.post('/invites/:token/accept', (req, res) => {
    const caller = optionalUser(db, req);
    const invite = liveInviteByToken(db, req.params.token);
    const acceptedAt = new Date().toISOString();

    if (caller) {
      // A forwarded link must not let a different account into the group.
      if (caller.email.toLowerCase() !== invite.email) {
        throw new HttpError(403, 'this invitation was sent to a different email address');
      }
      db.transaction(() => {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(invite.group_id, caller.id);
        db.prepare('UPDATE group_invites SET accepted_at = ? WHERE id = ?').run(acceptedAt, invite.id);
      })();
      res.status(200).json({ group_id: invite.group_id });
      return;
    }

    // No caller: create the account the invitation was addressed to. The email
    // comes from the invite row, never from the request, so the token cannot be
    // used to register an arbitrary address.
    const body = parseBody(acceptBody, req.body);
    if (emailTaken(db, invite.email)) throw new HttpError(409, 'email already registered, log in to accept');

    const user = db.transaction(() => {
      const created = createUser(db, { name: body.name, email: invite.email, password: body.password });
      db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(invite.group_id, created.id);
      db.prepare('UPDATE group_invites SET accepted_at = ? WHERE id = ?').run(acceptedAt, invite.id);
      return created;
    })();

    res.status(201).json({ token: issueToken(user), user, group_id: invite.group_id });
  });

  return r;
}

/** Development-only mail sink so the invite flow can be demonstrated without SMTP. */
export function devOutboxRouter(db: Db) {
  const r = Router();
  r.get('/dev/outbox', (_req, res) => {
    res.json(
      db.prepare('SELECT id, to_email, subject, body, created_at FROM dev_outbox ORDER BY id DESC LIMIT 50').all(),
    );
  });
  r.delete('/dev/outbox', (_req, res) => {
    db.prepare('DELETE FROM dev_outbox').run();
    res.status(204).end();
  });
  return r;
}
