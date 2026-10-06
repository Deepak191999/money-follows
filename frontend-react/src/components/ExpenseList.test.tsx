import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseList from './ExpenseList'
import { api, type Expense } from '../api'

const expenses: Expense[] = [
  {
    id: 1,
    group_id: 1,
    paid_by: 1,
    amount_paise: 450000,
    category: 'Travel',
    description: 'Flights BLR-GOI',
    spent_on: '2026-08-14',
    split_type: 'equal',
    splits: [],
  },
]

const members = [{ id: 1, name: 'Asha Rao', email: 'asha@example.com' }]

describe('ExpenseList', () => {
  it('renders amounts in INR with description and payer', () => {
    render(
      <ExpenseList expenses={expenses} members={members} currentUserId={1} onDeleted={() => {}} />,
    )
    expect(screen.getByText('₹4,500.00')).toBeInTheDocument()
    expect(screen.getByText('Flights BLR-GOI')).toBeInTheDocument()
    expect(screen.getByText('Asha Rao')).toBeInTheDocument()
  })

  it('only offers Delete on expenses the current user paid', () => {
    render(<ExpenseList expenses={expenses} members={members} currentUserId={2} onDeleted={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('deletes an expense and notifies the parent', async () => {
    const onDeleted = vi.fn()
    vi.spyOn(api, 'deleteExpense').mockResolvedValue(undefined)
    render(<ExpenseList expenses={expenses} currentUserId={1} onDeleted={onDeleted} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(api.deleteExpense).toHaveBeenCalledWith(1)
    expect(onDeleted).toHaveBeenCalled()
  })

  it('shows the API error inline when delete fails', async () => {
    vi.spyOn(api, 'deleteExpense').mockRejectedValue(new Error('not allowed'))
    render(<ExpenseList expenses={expenses} currentUserId={1} onDeleted={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not allowed')
  })
})
