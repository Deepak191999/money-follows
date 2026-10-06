import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Expense, MonthlyDashboard, apiError } from '../shared/api.service';
import { ExpenseForm } from '../shared/expense-form/expense-form';
import { ExpenseList } from '../shared/expense-list/expense-list';
import { MoneyPipe } from '../shared/money.pipe';
import { Nav } from '../shared/nav/nav';

@Component({
  selector: 'app-me',
  imports: [FormsModule, Nav, MoneyPipe, ExpenseForm, ExpenseList],
  templateUrl: './me.html',
})
export class Me {
  private api = inject(ApiService);
  expenses = signal<Expense[]>([]);
  month = new Date().toISOString().slice(0, 7);
  dashboard = signal<MonthlyDashboard | null>(null);
  downloading = signal(false);
  error = signal('');

  constructor() {
    this.loadExpenses();
    this.loadDashboard();
  }

  loadExpenses() {
    this.api.expenses().subscribe({
      next: (e) => this.expenses.set(e),
      error: (err) => this.error.set(apiError(err)),
    });
  }

  loadDashboard() {
    this.api.monthly(this.month).subscribe({
      next: (d) => this.dashboard.set(d),
      error: (err) => this.error.set(apiError(err)),
    });
  }

  download() {
    this.downloading.set(true);
    this.error.set('');
    this.api.exportCsv(this.month).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses-${this.month}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.downloading.set(false);
        this.error.set(apiError(err));
      },
    });
  }

  onExpenseCreated(expense: Expense) {
    this.expenses.update((list) => [expense, ...list]);
    this.loadDashboard();
  }

  onExpenseDeleted(id: number) {
    this.expenses.update((list) => list.filter((e) => e.id !== id));
    this.loadDashboard();
  }
}
