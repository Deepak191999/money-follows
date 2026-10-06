import type { Db } from './db.js';

export type Message = { to: string; subject: string; body: string };

/**
 * Transports, in order of how much setup they need:
 *
 *  log     - prints to the server console. The zero-config default.
 *  outbox  - stores messages in the dev_outbox table, served by GET /dev/outbox
 *            (development only). Use this to demo the full invite flow without
 *            any mail credentials.
 *  smtp    - a real SMTP server. Requires SMTP_* env vars and a mail library;
 *            deliberately left unimplemented rather than half-implemented, so it
 *            fails loudly at startup instead of silently dropping invitations.
 */
export type Transport = 'log' | 'outbox' | 'smtp';

const transports: Transport[] = ['log', 'outbox', 'smtp'];

export function configuredTransport(): Transport {
  const value = process.env.MAIL_TRANSPORT ?? 'log';
  if (!(transports as string[]).includes(value)) {
    throw new Error(`MAIL_TRANSPORT must be one of ${transports.join(', ')}, got "${value}"`);
  }
  return value as Transport;
}

/** The dev transports let the inviter see the link in the UI; smtp does not. */
export function transportRevealsLink(): boolean {
  return configuredTransport() !== 'smtp';
}

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
}

export function inviteTtlDays(): number {
  const days = Number(process.env.INVITE_TTL_DAYS ?? 7);
  if (!Number.isFinite(days) || days <= 0) throw new Error('INVITE_TTL_DAYS must be a positive number');
  return days;
}

export function sendMail(db: Db, message: Message): void {
  switch (configuredTransport()) {
    case 'log':
      console.log(`\n--- mail to ${message.to} ---\n${message.subject}\n\n${message.body}\n---\n`);
      return;
    case 'outbox':
      db.prepare('INSERT INTO dev_outbox (to_email, subject, body, created_at) VALUES (?, ?, ?, ?)').run(
        message.to,
        message.subject,
        message.body,
        new Date().toISOString(),
      );
      return;
    case 'smtp':
      throw new Error('MAIL_TRANSPORT=smtp is not implemented; configure a mail provider first');
  }
}

export function inviteMessage(opts: { to: string; inviterName: string; groupName: string; url: string }): Message {
  return {
    to: opts.to,
    subject: `${opts.inviterName} invited you to "${opts.groupName}" on Money Follows`,
    body: [
      `${opts.inviterName} has invited you to join the group "${opts.groupName}" on Money Follows.`,
      '',
      `Accept the invitation: ${opts.url}`,
      '',
      `The link expires in ${inviteTtlDays()} days. If you were not expecting this, ignore this email.`,
    ].join('\n'),
  };
}
