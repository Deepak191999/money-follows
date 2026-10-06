import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  api,
  type Balance,
  type Expense,
  type GroupDetail,
  type InviteResult,
  type PendingInvite,
  type User,
} from '../api'
import { formatPaise, rupeesToPaise } from '../money'
import ErrorMessage from '../components/ErrorMessage'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'

export default function GroupPage() {
  const groupId = Number(useParams().id)
  const navigate = useNavigate()
  const [me, setMe] = useState<User | null>(null)
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [balances, setBalances] = useState<Balance[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [lastInvite, setLastInvite] = useState<Extract<InviteResult, { status: 'invited' }> | null>(null)

  const [fromUser, setFromUser] = useState('')
  const [toUser, setToUser] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleError, setSettleError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadMoney = useCallback(() => {
    api.getBalances(groupId).then(setBalances).catch((e) => setError(e.message))
    api.listExpenses(groupId).then(setExpenses).catch((e) => setError(e.message))
  }, [groupId])

  const loadInvites = useCallback(() => {
    api.listInvites(groupId).then(setInvites).catch(() => setInvites([]))
  }, [groupId])

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null))
    api.getGroup(groupId).then(setGroup).catch((e) => setError(e.message))
    loadMoney()
    loadInvites()
  }, [groupId, loadMoney, loadInvites])

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    setLastInvite(null)
    try {
      const result = await api.inviteToGroup(groupId, inviteEmail)
      setInviteEmail('')
      if (result.status === 'added') {
        // Already had an account, so they are a member now; no email involved.
        setGroup(await api.getGroup(groupId))
        loadMoney()
      } else {
        setLastInvite(result)
      }
      loadInvites()
    } catch (err) {
      setInviteError((err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(inviteId: number) {
    setInviteError(null)
    try {
      await api.revokeInvite(groupId, inviteId)
      setLastInvite(null)
      loadInvites()
    } catch (err) {
      setInviteError((err as Error).message)
    }
  }

  async function handleSettle(e: FormEvent) {
    e.preventDefault()
    const amountPaise = rupeesToPaise(settleAmount)
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      setSettleError('Amount must be greater than zero')
      return
    }
    if (fromUser === toUser) {
      setSettleError('Payer and payee must be different')
      return
    }
    setSettleError(null)
    try {
      await api.settle(groupId, {
        from_user: Number(fromUser),
        to_user: Number(toUser),
        amount_paise: amountPaise,
      })
      setSettleAmount('')
      loadMoney()
    } catch (err) {
      setSettleError((err as Error).message)
    }
  }

  async function handleDeleteGroup() {
    if (!window.confirm('Delete this group and all its expenses?')) return
    setDeleting(true)
    setError(null)
    try {
      await api.deleteGroup(groupId)
      navigate('/groups', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setDeleting(false)
    }
  }

  if (error && !group) return <ErrorMessage message={error} />
  if (!group) return <p className="muted">Loading...</p>

  return (
    <>
      <h1>{group.name}</h1>
      <ErrorMessage message={error} />

      <section className="card">
        <h3>Members</h3>
        <ul className="list">
          {group.members.map((m) => (
            <li key={m.id}>
              {m.name} <span className="muted">({m.email})</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleInvite} className="inline">
          <input
            type="email"
            placeholder="Invite by email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button type="submit" disabled={inviting}>
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </form>
        <p className="muted">
          Someone with an account joins immediately. Anyone else is emailed a link to sign up.
        </p>
        <ErrorMessage message={inviteError} />

        {lastInvite && (
          <p className="muted">
            Invitation emailed to <strong>{lastInvite.email}</strong>.
            {lastInvite.invite_url && (
              <>
                {' '}
                Development link: <a href={lastInvite.invite_url}>{lastInvite.invite_url}</a>
              </>
            )}
          </p>
        )}

        {invites.length > 0 && (
          <>
            <h3>Pending invitations</h3>
            <ul className="list">
              {invites.map((i) => (
                <li key={i.id} className="inline">
                  <span style={{ flex: 1 }}>
                    {i.email}{' '}
                    <span className="muted">
                      (invited by {i.invited_by_name}, expires{' '}
                      {new Date(i.expires_at).toLocaleDateString()})
                    </span>
                  </span>
                  <button type="button" className="danger" onClick={() => handleRevoke(i.id)}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h3>Balances</h3>
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.user_id}>
                <td>{b.name}</td>
                <td className={`num ${b.net_paise >= 0 ? 'positive' : 'negative'}`}>
                  {formatPaise(b.net_paise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Positive means the member is owed money.</p>
      </section>

      <form onSubmit={handleSettle} className="card">
        <h3>Settle up</h3>
        <div className="row">
          <label>
            From
            <select required value={fromUser} onChange={(e) => setFromUser(e.target.value)}>
              <option value="">Select</option>
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select required value={toUser} onChange={(e) => setToUser(e.target.value)}>
              <option value="">Select</option>
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (INR)
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
            />
          </label>
        </div>
        <ErrorMessage message={settleError} />
        <button type="submit">Record settlement</button>
      </form>

      <ExpenseForm groupId={groupId} members={group.members} onCreated={loadMoney} />

      <section className="card">
        <h3>Expenses</h3>
        <ExpenseList
          expenses={expenses}
          members={group.members}
          currentUserId={me?.id}
          onDeleted={loadMoney}
        />
      </section>

      {me?.id === group.created_by && (
        <section className="card">
          <h3>Danger zone</h3>
          <button type="button" className="danger" disabled={deleting} onClick={handleDeleteGroup}>
            Delete group
          </button>
        </section>
      )}
    </>
  )
}
