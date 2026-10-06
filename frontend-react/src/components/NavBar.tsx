import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { api, type User } from '../api'
import { useAuth } from '../auth'
import ThemeToggle from './ThemeToggle'

export default function NavBar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null))
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="navbar">
      <Link to="/groups" className="brand">
        Money Follows
      </Link>
      <div className="nav-links">
        <NavLink to="/groups">Groups</NavLink>
        <NavLink to="/me">Me</NavLink>
        <NavLink to="/highlights">What I built</NavLink>
      </div>
      <div className="nav-user">
        <ThemeToggle />
        {user && <span>{user.name}</span>}
        <button type="button" className="secondary" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  )
}
