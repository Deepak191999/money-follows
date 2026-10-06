import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, Balance, Expense, GroupDetail, User, apiError } from '../shared/api.service';
import { ExpenseForm } from '../shared/expense-form/expense-form';
import { ExpenseList } from '../shared/expense-list/expense-list';
import { MoneyPipe, toPaise } from '../shared/money.pipe';
import { Nav } from '../shared/nav/nav';

@Component({
  selector: 'app-group',
  imports: [FormsModule, Nav, MoneyPipe, ExpenseForm, ExpenseList],
  templateUrl: './group.html',
})
export class Group {
  private api = inject(ApiService);
  private router = inject(Router);
  id = input.required<string>();
  groupId = computed(() => Number(this.id()));

  me = signal<User | null>(null);
  group = signal<GroupDetail | null>(null);
  balances = signal<Balance[]>([]);
  expenses = signal<Expense[]>([]);
  error = signal('');

  memberEmail = '';
  memberBusy = signal(false);
  memberError = signal('');

  fromUser: number | null = null;
  toUser: number | null = null;
  settleAmount = '';
  settleError = signal('');

  constructor() {
    this.api.me().subscribe((u) => this.me.set(u));
    effect(() => {
      const id = this.groupId();
      this.api.group(id).subscribe({
        next: (g) => this.group.set(g),
        error: (err) => this.error.set(apiError(err)),
      });
      this.loadBalances(id);
      this.loadExpenses(id);
    });
  }

  loadBalances(id = this.groupId()) {
    this.api.balances(id).subscribe((b) => this.balances.set(b));
  }

  loadExpenses(id = this.groupId()) {
    this.api.expenses(id).subscribe((e) => this.expenses.set(e));
  }

  addMember() {
    this.memberBusy.set(true);
    this.memberError.set('');
    this.api.addMember(this.groupId(), this.memberEmail).subscribe({
      next: (g) => {
        this.memberBusy.set(false);
        this.memberEmail = '';
        this.group.set(g);
        this.loadBalances();
      },
      error: (err) => {
        this.memberBusy.set(false);
        this.memberError.set(apiError(err));
      },
    });
  }

  settle() {
    if (this.fromUser === null || this.toUser === null) {
      return;
    }
    this.settleError.set('');
    this.api
      .settle(this.groupId(), {
        from_user: this.fromUser,
        to_user: this.toUser,
        amount_paise: toPaise(this.settleAmount),
      })
      .subscribe({
        next: () => {
          this.settleAmount = '';
          this.loadBalances();
        },
        error: (err) => this.settleError.set(apiError(err)),
      });
  }

  deleteGroup() {
    this.error.set('');
    this.api.deleteGroup(this.groupId()).subscribe({
      next: () => this.router.navigate(['/groups']),
      error: (err) => this.error.set(apiError(err)),
    });
  }

  onExpenseCreated(expense: Expense) {
    this.expenses.update((list) => [expense, ...list]);
    this.loadBalances();
  }

  onExpenseDeleted(id: number) {
    this.expenses.update((list) => list.filter((e) => e.id !== id));
    this.loadBalances();
  }
}
