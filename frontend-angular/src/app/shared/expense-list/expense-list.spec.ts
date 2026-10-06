import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Expense } from '../api.service';
import { ExpenseList } from './expense-list';

const expense: Expense = {
  id: 1,
  group_id: null,
  paid_by: 1,
  amount_paise: 12000,
  category: 'Food',
  description: 'Dinner at <b>Saravana Bhavan</b>',
  spent_on: '2026-09-01',
  split_type: 'equal',
  splits: [],
};

describe('ExpenseList', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('renders inline formatting in descriptions', () => {
    const fixture = TestBed.createComponent(ExpenseList);
    fixture.componentRef.setInput('expenses', [expense]);
    fixture.detectChanges();
    const cell = fixture.nativeElement.querySelector('tbody td:nth-child(2)') as HTMLElement;
    expect(cell.querySelector('b')?.textContent).toBe('Saravana Bhavan');
    expect(cell.innerHTML).toContain('<b>Saravana Bhavan</b>');
  });

  it('shows the empty state when there are no expenses', () => {
    const fixture = TestBed.createComponent(ExpenseList);
    fixture.componentRef.setInput('expenses', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No expenses yet.');
  });
});
