import { useCallback, useEffect, useState } from 'react'
import { api, type Expense, type MonthlyDashboard, type User } from '../api'
import { currentMonth, formatPaise } from '../money'
import ErrorMessage from '../components/ErrorMessage'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'

export default function MePage() {
  const [me, setMe] = useState<User | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [dashboard, setDashboard] = useState<MonthlyDashboard | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExpenses = useCallback(() => {
    api.listExpenses().then(setExpenses).catch((e) => setError(e.message))
  }, [])

  const loadDashboard = useCallback(() => {
    api.monthly(month).then(setDashboard).catch((e) => setError(e.message))
  }, [month])

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null))
  }, [])
  useEffect(loadExpenses, [loadExpenses])
  useEffect(loadDashboard, [loadDashboard])

  function refresh() {
    loadExpenses()
    loadDashboard()
  }

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    try {
      const blob = await api.exportCsv(month)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expenses-${month}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <h1>My expenses</h1>
      <ErrorMessage message={error} />

      <section className="card">
        <div className="inline">
          <label>
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <button type="button" onClick={handleDownload} disabled={downloading}>
            Download CSV
          </button>
        </div>
        {dashboard && (
          <>
            <p>
              Total for {dashboard.month}: <strong>{formatPaise(dashboard.total_paise)}</strong>
            </p>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.by_category.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td className="num">{formatPaise(c.total_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <ExpenseForm groupId={null} onCreated={refresh} />

      <section className="card">
        <h3>Personal expenses</h3>
        <ExpenseList expenses={expenses} currentUserId={me?.id} onDeleted={refresh} />
      </section>
    </>
  )
}
