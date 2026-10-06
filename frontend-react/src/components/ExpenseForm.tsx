import { useState, type FormEvent } from 'react'
import { api, type Split, type SplitType, type User } from '../api'
import { rupeesToPaise, today } from '../money'
import ErrorMessage from './ErrorMessage'

interface Props {
  groupId: number | null
  members?: User[]
  onCreated: () => void
}

export default function ExpenseForm({ groupId, members, onCreated }: Props) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [spentOn, setSpentOn] = useState(today())
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [shares, setShares] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGroup = groupId !== null && members !== undefined

  function buildSplits(): Split[] | undefined {
    if (!isGroup) return undefined
    if (splitType === 'equal') return members.map((m) => ({ user_id: m.id, share_paise: 0 }))
    return members.map((m) => {
      const raw = shares[m.id] ?? ''
      const value = splitType === 'exact' ? rupeesToPaise(raw) : Math.round(Number(raw))
      return { user_id: m.id, share_paise: Number.isFinite(value) ? value : 0 }
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const amountPaise = rupeesToPaise(amount)
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      setError('Amount must be greater than zero')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.createExpense({
        group_id: groupId,
        amount_paise: amountPaise,
        category,
        description,
        spent_on: spentOn,
        split_type: isGroup ? splitType : 'equal',
        splits: buildSplits(),
      })
      setAmount('')
      setCategory('')
      setDescription('')
      setShares({})
      onCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3>Add expense</h3>
      <div className="row">
        <label>
          Amount (INR)
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Category
          <input required value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label>
          Date
          <input type="date" required value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
        </label>
      </div>
      <label>
        Description
        <input required value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {isGroup && (
        <>
          <label>
            Split
            <select value={splitType} onChange={(e) => setSplitType(e.target.value as SplitType)}>
              <option value="equal">Equal</option>
              <option value="exact">Exact amounts</option>
              <option value="percent">Percentages</option>
            </select>
          </label>
          {splitType !== 'equal' && (
            <div className="row">
              {members.map((m) => (
                <label key={m.id}>
                  {m.name} {splitType === 'exact' ? '(INR)' : '(%)'}
                  <input
                    type="number"
                    step={splitType === 'exact' ? '0.01' : '1'}
                    min="0"
                    required
                    value={shares[m.id] ?? ''}
                    onChange={(e) => setShares({ ...shares, [m.id]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          )}
        </>
      )}
      <ErrorMessage message={error} />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : 'Add expense'}
      </button>
    </form>
  )
}
