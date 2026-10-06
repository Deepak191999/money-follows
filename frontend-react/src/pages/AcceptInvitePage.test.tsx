import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import AcceptInvitePage from './AcceptInvitePage'
import { AuthProvider } from '../auth'
import { api, ApiError, TOKEN_KEY } from '../api'

function renderInvite(token = 'tok123') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route path="/groups/:id" element={<h1>Group page</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const invite = {
  email: 'dia@example.com',
  group_name: 'Goa trip',
  inviter_name: 'Asha Rao',
  expires_at: '2030-01-01T00:00:00.000Z',
  has_account: false,
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('creates the account for the invited address and signs in', async () => {
    vi.spyOn(api, 'getInvite').mockResolvedValue(invite)
    vi.spyOn(api, 'acceptInvite').mockResolvedValue({
      group_id: 7,
      token: 'new-token',
      user: { id: 9, name: 'Dia', email: 'dia@example.com' },
    })

    renderInvite()
    expect(await screen.findByText(/Asha Rao/)).toBeInTheDocument()

    // The invited address is shown but not editable: the server takes the email
    // from the invite row, so the form must not imply it can be changed.
    const email = screen.getByLabelText('Email')
    expect(email).toHaveValue('dia@example.com')
    expect(email).toHaveAttribute('readonly')

    await userEvent.type(screen.getByLabelText('Name'), 'Dia')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account and join' }))

    // No email in the payload at all.
    expect(api.acceptInvite).toHaveBeenCalledWith('tok123', { name: 'Dia', password: 'password123' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token')
    expect(await screen.findByText('Group page')).toBeInTheDocument()
  })

  it('explains an expired or revoked link instead of showing a form', async () => {
    vi.spyOn(api, 'getInvite').mockRejectedValue(new ApiError(404, 'invitation not found or expired'))

    renderInvite('dead')
    expect(await screen.findByText('Invitation unavailable')).toBeInTheDocument()
    expect(screen.getByText('invitation not found or expired')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('asks an existing account to log in rather than signing up again', async () => {
    vi.spyOn(api, 'getInvite').mockResolvedValue({ ...invite, has_account: true })

    renderInvite()
    expect(await screen.findByText(/already have an account/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('offers a one-click join when already signed in', async () => {
    localStorage.setItem(TOKEN_KEY, 'existing-token')
    vi.spyOn(api, 'getInvite').mockResolvedValue(invite)
    vi.spyOn(api, 'acceptInvite').mockResolvedValue({ group_id: 7 })

    renderInvite()
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }))

    expect(api.acceptInvite).toHaveBeenCalledWith('tok123', undefined)
    expect(await screen.findByText('Group page')).toBeInTheDocument()
  })
})
