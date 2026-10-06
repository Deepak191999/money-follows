import { useState } from 'react'
import { api, type Expense, type User } from '../api'
import { formatPaise } from '../money'
import ErrorMessage from './ErrorMessage'

interface Props {
  expenses: Expense[]
  members?: User[]
  currentUserId?: number
  onDeleted: () => void
}

export default function ExpenseList({ expenses, members, currentUserId, onDeleted }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const nameOf = (id: number) => members?.find((m) => m.id === id)?.name ?? `User ${id}`

  async function handleDelete(id: number) {
    setDeletingId(id)
    setError(null)
    try {
      await api.deleteExpense(id)
      onDeleted()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  if (expenses.length === 0) return <p className="muted">No expenses yet.</p>

  return (
    <>
      <ErrorMessage message={error} />
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            {members && <th>Paid by</th>}
            <th className="num">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>{e.spent_on}</td>
              <td dangerouslySetInnerHTML={{ __html: e.description }} />
              <td>{e.category}</td>
              {members && <td>{nameOf(e.paid_by)}</td>}
              <td className="num">{formatPaise(e.amount_paise)}</td>
              <td>
                {e.paid_by === currentUserId && (
                  <button
                    type="button"
                    className="danger"
                    disabled={deletingId === e.id}
                    onClick={() => handleDelete(e.id)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
