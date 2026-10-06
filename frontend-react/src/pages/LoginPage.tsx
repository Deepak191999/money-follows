import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api } from '../api'
import { useAuth } from '../auth'
import ErrorMessage from '../components/ErrorMessage'

export default function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (token) return <Navigate to="/groups" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.signup({ name, email, password })
      login(res.token)
      navigate('/groups', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="container narrow">
      <h1>Money Follows</h1>
      <form onSubmit={handleSubmit} className="card">
        <h2>{mode === 'login' ? 'Log in' : 'Sign up'}</h2>
        {mode === 'signup' && (
          <label>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <ErrorMessage message={error} />
        <button type="submit" disabled={submitting}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
          }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </main>
  )
}
