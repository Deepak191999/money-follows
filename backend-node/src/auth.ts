import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Db } from './db.js';
import { HttpError, parseBody } from './http.js';

export type User = { id: number; name: string; email: string };

declare global {
  namespace Express {
    interface Request {
      user: User;
    }
  }
}

/**
 * docker-compose.yml has always passed JWT_SECRET, but this module used to ignore
 * it and sign with a constant committed to the repository: anyone who could read
 * the source could forge a token for any user. The secret now comes from the
 * environment, and a production process refuses to start without one rather than
 * falling back to a value an attacker already knows.
 */
function resolveSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }
  return 'dev-only-insecure-secret';
}

const SECRET = resolveSecret();

/** Tokens used to be valid forever; a leaked one was a permanent account key. */
const TOKEN_TTL = '7d';

const signupBody = z.object({ name: z.string().min(1), email: z.email(), password: z.string().min(8) });
const loginBody = z.object({ email: z.email(), password: z.string() });

const publicUser = (row: User) => ({ id: row.id, name: row.name, email: row.email });
export const issueToken = (user: User) => jwt.sign({ sub: String(user.id) }, SECRET, { expiresIn: TOKEN_TTL });

export function emailTaken(db: Db, email: string): boolean {
  return !!db.prepare('SELECT id FROM users WHERE email = ?').get(email);
}

/**
 * Shared by POST /auth/signup and the invite-accept path so there is exactly one
 * place that decides how a user row is created and how the password is hashed.
 * Caller is responsible for the uniqueness check and for any surrounding transaction.
 */
export function createUser(db: Db, input: { name: string; email: string; password: string }): User {
  const email = input.email.toLowerCase();
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(input.name, email, bcrypt.hashSync(input.password, 10), new Date().toISOString());
  return { id: Number(result.lastInsertRowid), name: input.name, email };
}

export function authRouter(db: Db) {
  const r = Router();

  r.post('/auth/signup', (req, res) => {
    const body = parseBody(signupBody, req.body);
    const email = body.email.toLowerCase();
    if (emailTaken(db, email)) throw new HttpError(409, 'email already registered');
    const user = createUser(db, { name: body.name, email, password: body.password });
    res.status(201).json({ token: issueToken(user), user });
  });

  r.post('/auth/login', (req, res) => {
    const body = parseBody(loginBody, req.body);
    const row = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(body.email.toLowerCase()) as
      | (User & { password_hash: string })
      | undefined;
    if (!row || !bcrypt.compareSync(body.password, row.password_hash)) throw new HttpError(401, 'invalid email or password');
    res.json({ token: issueToken(row), user: publicUser(row) });
  });

  r.get('/me', requireAuth(db), (req, res) => {
    res.json(req.user);
  });

  return r;
}

/**
 * Resolves the caller from the Authorization header, or null when no bearer token
 * was sent. A malformed or expired token is still a 401: only the *absence* of a
 * token is treated as anonymous. Routes that accept either (invite accept) use
 * this; routes that require a caller use requireAuth below.
 */
export function optionalUser(db: Db, req: Request): User | null {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  if (!token) return null;
  let sub: string | undefined;
  try {
    const payload = jwt.verify(token, SECRET);
    sub = typeof payload === 'object' ? payload.sub : undefined;
  } catch {
    throw new HttpError(401, 'invalid or expired token');
  }
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(Number(sub)) as User | undefined;
  if (!user) throw new HttpError(401, 'unknown user');
  return user;
}

export function requireAuth(db: Db) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = optionalUser(db, req);
    if (!user) throw new HttpError(401, 'missing bearer token');
    req.user = user;
    next();
  };
}
