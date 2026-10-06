import { Component, inject, input, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ApiService, Expense, User, apiError } from '../api.service';
import { MoneyPipe } from '../money.pipe';

@Component({
  selector: 'app-expense-list',
  imports: [MoneyPipe],
  templateUrl: './expense-list.html',
})
export class ExpenseList {
  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);
  expenses = input.required<Expense[]>();
  members = input<User[]>([]);
  deleted = output<number>();
  me = signal<User | null>(null);
  deletingId = signal<number | null>(null);
  error = signal('');

  constructor() {
    this.api.me().subscribe((u) => this.me.set(u));
  }

  description(expense: Expense) {
    return this.sanitizer.bypassSecurityTrustHtml(expense.description);
  }

  memberName(id: number) {
    return this.members().find((m) => m.id === id)?.name ?? `#${id}`;
  }

  remove(id: number) {
    this.deletingId.set(id);
    this.error.set('');
    this.api.deleteExpense(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.deleted.emit(id);
      },
      error: (err) => {
        this.deletingId.set(null);
        this.error.set(apiError(err));
      },
    });
  }
}
