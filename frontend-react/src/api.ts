export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export const TOKEN_KEY = 'token'

export interface User {
  id: number
  name: string
  email: string
}

export interface Group {
  id: number
  name: string
  created_by: number
}

export interface GroupDetail extends Group {
  members: User[]
}

export interface Balance {
  user_id: number
  name: string
  net_paise: number
}

export type SplitType = 'equal' | 'exact' | 'percent'

export interface Split {
  user_id: number
  share_paise: number
}

export interface Expense {
  id: number
  group_id: number | null
  paid_by: number
  amount_paise: number
  category: string
  description: string
  spent_on: string
  split_type: SplitType
  splits: Split[]
}

export interface ExpenseCreate {
  group_id: number | null
  paid_by?: number
  amount_paise: number
  category: string
  description: string
  spent_on: string
  split_type: SplitType
  splits?: Split[]
}

export interface MonthlyDashboard {
  month: string
  total_paise: number
  by_category: { category: string; total_paise: number }[]
}

export interface PendingInvite {
  id: number
  email: string
  created_at: string
  expires_at: string
  invited_by_name: string
}

/** POST /groups/:id/invites either adds an existing user or emails a new one. */
export type InviteResult =
  | { status: 'added' }
  | { status: 'invited'; email: string; expires_at: string; invite_url?: string }

export interface InviteInfo {
  email: string
  group_name: string
  inviter_name: string
  expires_at: string
  has_account: boolean
}

/** Accepting while logged out also signs you up, so it returns a token. */
export interface AcceptResult {
  group_id: number
  token?: string
  user?: User
}

export interface OutboxMessage {
  id: number
  to_email: string
  subject: string
  body: string
  created_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${res.status}`
    throw new ApiError(res.status, message)
  }
  return data as T
}

export async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) message = String(data.error)
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message)
  }
  return res.blob()
}

export const api = {
  signup: (body: { name: string; email: string; password: string }) =>
    request<AuthResponse>('POST', '/auth/signup', body),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('POST', '/auth/login', body),
  me: () => request<User>('GET', '/me'),

  listGroups: () => request<Group[]>('GET', '/groups'),
  createGroup: (name: string) => request<Group>('POST', '/groups', { name }),
  getGroup: (id: number) => request<GroupDetail>('GET', `/groups/${id}`),
  deleteGroup: (id: number) => request<void>('DELETE', `/groups/${id}`),
  addMember: (id: number, email: string) =>
    request<GroupDetail>('POST', `/groups/${id}/members`, { email }),

  inviteToGroup: (id: number, email: string) =>
    request<InviteResult>('POST', `/groups/${id}/invites`, { email }),
  listInvites: (id: number) => request<PendingInvite[]>('GET', `/groups/${id}/invites`),
  revokeInvite: (id: number, inviteId: number) =>
    request<void>('DELETE', `/groups/${id}/invites/${inviteId}`),
  getInvite: (token: string) => request<InviteInfo>('GET', `/invites/${encodeURIComponent(token)}`),
  // With a stored auth token this joins the current user; without one it also
  // creates the account, which is why name/password are optional here.
  acceptInvite: (token: string, body?: { name: string; password: string }) =>
    request<AcceptResult>('POST', `/invites/${encodeURIComponent(token)}/accept`, body ?? {}),
  devOutbox: () => request<OutboxMessage[]>('GET', '/dev/outbox'),
  getBalances: (id: number) => request<Balance[]>('GET', `/groups/${id}/balances`),
  settle: (id: number, body: { from_user: number; to_user: number; amount_paise: number }) =>
    request<unknown>('POST', `/groups/${id}/settle`, body),

  listExpenses: (groupId?: number) =>
    request<Expense[]>('GET', groupId === undefined ? '/expenses' : `/expenses?group_id=${groupId}`),
  createExpense: (body: ExpenseCreate) => request<Expense>('POST', '/expenses', body),
  deleteExpense: (id: number) => request<void>('DELETE', `/expenses/${id}`),

  monthly: (month: string) =>
    request<MonthlyDashboard>('GET', `/dashboard/monthly?month=${encodeURIComponent(month)}`),
  exportCsv: (month: string) => fetchBlob(`/export/csv?month=${encodeURIComponent(month)}`),
}
