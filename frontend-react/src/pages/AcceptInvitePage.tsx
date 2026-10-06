import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, type InviteInfo } from '../api'
import { useAuth } from '../auth'
import ErrorMessage from '../components/ErrorMessage'

export default function AcceptInvitePage() {
  const token = useParams().token ?? ''
  const navigate = useNavigate()
  const { token: authToken, login } = useAuth()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let active = true
    api
      .getInvite(token)
      .then((info) => {
        if (active) setInvite(info)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  async function accept(credentials?: { name: string; password: string }) {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await api.acceptInvite(token, credentials)
      // Accepting while logged out signs the new account in straight away.
      if (result.token) login(result.token)
      navigate(`/groups/${result.group_id}`, { replace: true })
    } catch (err) {
      setSubmitError((err as Error).message)
      setSubmitting(false)
    }
  }

  const shell = (children: ReactNode) => <main className="container narrow">{children}</main>

  if (loading) return shell(<p className="muted">Loading invitation...</p>)

  if (error || !invite) {
    return shell(
      <>
        <h1>Invitation unavailable</h1>
        <ErrorMessage message={error ?? 'invitation not found or expired'} />
        <p className="muted">
          The link may have expired, been revoked, or already been used. Ask whoever invited you to
          send a new one.
        </p>
        <Link to="/login">Go to log in</Link>
      </>,
    )
  }

  return shell(
    <>
      <h1>Join {invite.group_name}</h1>
      <p>
        <strong>{invite.inviter_name}</strong> invited <strong>{invite.email}</strong> to join this
        group on Money Follows.
      </p>

      {authToken ? (
        // Already signed in: the backend still checks the signed-in address matches
        // the invited one, so a forwarded link cannot pull in the wrong account.
        <section className="card">
          <p>You are signed in. Accept to join the group.</p>
          <ErrorMessage message={submitError} />
          <button type="button" disabled={submitting} onClick={() => accept()}>
            {submitting ? 'Joining...' : 'Accept invitation'}
          </button>
        </section>
      ) : invite.has_account ? (
        <section className="card">
          <p>You already have an account. Log in and open this link again to join.</p>
          <Link to="/login">Go to log in</Link>
        </section>
      ) : (
        <form
          className="card"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void accept({ name, password })
          }}
        >
          <h3>Create your account</h3>
          <label>
            Email
            {/* Fixed: the account is created for the invited address, not a typed one. */}
            <input type="email" value={invite.email} readOnly disabled />
          </label>
          <label>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <ErrorMessage message={submitError} />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account and join'}
          </button>
        </form>
      )}
    </>,
  )
}
