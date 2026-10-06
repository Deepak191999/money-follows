import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import LoginPage from './LoginPage'
import { AuthProvider } from '../auth'
import { api, TOKEN_KEY } from '../api'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/groups" element={<h1>Groups page</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('logs in, stores the token and redirects to /groups', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({
      token: 'abc123',
      user: { id: 1, name: 'Asha Rao', email: 'asha@example.com' },
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(api.login).toHaveBeenCalledWith({ email: 'asha@example.com', password: 'password123' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc123')
    expect(await screen.findByText('Groups page')).toBeInTheDocument()
  })

  it('shows the API error inline on bad credentials', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new Error('invalid credentials'))
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid credentials')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('toggles to the signup form and calls signup', async () => {
    vi.spyOn(api, 'signup').mockResolvedValue({
      token: 'new',
      user: { id: 9, name: 'Dev', email: 'dev@example.com' },
    })
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Dev')
    await userEvent.type(screen.getByLabelText('Email'), 'dev@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(api.signup).toHaveBeenCalledWith({
      name: 'Dev',
      email: 'dev@example.com',
      password: 'password123',
    })
    expect(await screen.findByText('Groups page')).toBeInTheDocument()
  })
})
