import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Expense, Split, SplitType, User, apiError } from '../api.service';
import { toPaise } from '../money.pipe';

@Component({
  selector: 'app-expense-form',
  imports: [FormsModule],
  templateUrl: './expense-form.html',
})
export class ExpenseForm {
  private api = inject(ApiService);
  groupId = input<number | null>(null);
  members = input<User[]>([]);
  created = output<Expense>();

  amount = '';
  category = '';
  description = '';
  spentOn = new Date().toISOString().slice(0, 10);
  splitType: SplitType = 'equal';
  excluded = new Set<number>();
  shares: Record<number, string> = {};
  busy = signal(false);
  error = signal('');

  isIncluded(userId: number) {
    return !this.excluded.has(userId);
  }

  toggle(userId: number) {
    if (this.excluded.has(userId)) {
      this.excluded.delete(userId);
    } else {
      this.excluded.add(userId);
    }
  }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.api
      .createExpense({
        group_id: this.groupId(),
        amount_paise: toPaise(this.amount),
        category: this.category,
        description: this.description,
        spent_on: this.spentOn,
        split_type: this.splitType,
        splits: this.members().length ? this.buildSplits() : undefined,
      })
      .subscribe({
        next: (expense) => {
          this.busy.set(false);
          this.amount = '';
          this.description = '';
          this.created.emit(expense);
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(apiError(err));
        },
      });
  }

  private buildSplits(): Split[] {
    const members = this.members();
    switch (this.splitType) {
      case 'equal':
        return members
          .filter((m) => this.isIncluded(m.id))
          .map((m) => ({ user_id: m.id, share_paise: 0 }));
      case 'exact':
        return members.map((m) => ({
          user_id: m.id,
          share_paise: toPaise(this.shares[m.id] || 0),
        }));
      case 'percent':
        return members.map((m) => ({ user_id: m.id, share_paise: Number(this.shares[m.id] || 0) }));
    }
  }
}
