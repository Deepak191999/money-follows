import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Group {
  id: number;
  name: string;
  created_by: number;
}

export interface GroupDetail extends Group {
  members: User[];
}

export interface Balance {
  user_id: number;
  name: string;
  net_paise: number;
}

export interface Settlement {
  id: number;
  group_id: number;
  from_user: number;
  to_user: number;
  amount_paise: number;
  created_at: string;
}

export type SplitType = 'equal' | 'exact' | 'percent';

export interface Split {
  user_id: number;
  share_paise: number;
}

export interface ExpenseCreate {
  group_id: number | null;
  amount_paise: number;
  category: string;
  description: string;
  spent_on: string;
  split_type: SplitType;
  splits?: Split[];
}

export interface Expense extends ExpenseCreate {
  id: number;
  paid_by: number;
  splits: Split[];
}

export interface MonthlyDashboard {
  month: string;
  total_paise: number;
  by_category: { category: string; total_paise: number }[];
}

export function apiError(err: unknown): string {
  if (err instanceof HttpErrorResponse && typeof err.error?.error === 'string') {
    return err.error.error;
  }
  return 'Something went wrong';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  signup(body: { name: string; email: string; password: string }) {
    return this.http.post<AuthResponse>(`${this.base}/auth/signup`, body);
  }

  login(body: { email: string; password: string }) {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, body);
  }

  me() {
    return this.http.get<User>(`${this.base}/me`);
  }

  groups() {
    return this.http.get<Group[]>(`${this.base}/groups`);
  }

  createGroup(name: string) {
    return this.http.post<Group>(`${this.base}/groups`, { name });
  }

  group(id: number) {
    return this.http.get<GroupDetail>(`${this.base}/groups/${id}`);
  }

  deleteGroup(id: number) {
    return this.http.delete<void>(`${this.base}/groups/${id}`);
  }

  addMember(groupId: number, email: string) {
    return this.http.post<GroupDetail>(`${this.base}/groups/${groupId}/members`, { email });
  }

  balances(groupId: number) {
    return this.http.get<Balance[]>(`${this.base}/groups/${groupId}/balances`);
  }

  settle(groupId: number, body: { from_user: number; to_user: number; amount_paise: number }) {
    return this.http.post<Settlement>(`${this.base}/groups/${groupId}/settle`, body);
  }

  expenses(groupId?: number) {
    const params: Record<string, number> = groupId === undefined ? {} : { group_id: groupId };
    return this.http.get<Expense[]>(`${this.base}/expenses`, { params });
  }

  createExpense(body: ExpenseCreate) {
    return this.http.post<Expense>(`${this.base}/expenses`, body);
  }

  deleteExpense(id: number) {
    return this.http.delete<void>(`${this.base}/expenses/${id}`);
  }

  monthly(month: string) {
    return this.http.get<MonthlyDashboard>(`${this.base}/dashboard/monthly`, { params: { month } });
  }

  exportCsv(month: string) {
    return this.http.get(`${this.base}/export/csv`, { params: { month }, responseType: 'blob' });
  }
}
