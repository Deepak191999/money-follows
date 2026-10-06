import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, type Group } from '../api'
import ErrorMessage from '../components/ErrorMessage'

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    api.listGroups().then(setGroups).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.createGroup(name)
      setName('')
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1>Groups</h1>
      <ErrorMessage message={error} />
      <form onSubmit={handleCreate} className="card inline">
        <input
          placeholder="New group name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          Create
        </button>
      </form>
      {groups.length === 0 ? (
        <p className="muted">You are not in any groups yet.</p>
      ) : (
        <ul className="list">
          {groups.map((g) => (
            <li key={g.id}>
              <Link to={`/groups/${g.id}`}>{g.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
