import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from './ThemeToggle'
import { ThemeProvider, THEME_KEY } from '../theme'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

const button = () => screen.getByRole('button')

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('starts on system, which leaves the OS preference in charge', () => {
    renderToggle()
    expect(button()).toHaveTextContent('System')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('cycles system -> light -> dark -> system and pins data-theme', async () => {
    renderToggle()

    await userEvent.click(button())
    expect(button()).toHaveTextContent('Light')
    expect(document.documentElement.dataset.theme).toBe('light')

    await userEvent.click(button())
    expect(button()).toHaveTextContent('Dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    await userEvent.click(button())
    expect(button()).toHaveTextContent('System')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('persists the choice and restores it on remount', async () => {
    const { unmount } = renderToggle()
    await userEvent.click(button())
    await userEvent.click(button())
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')

    unmount()
    document.documentElement.removeAttribute('data-theme')
    renderToggle()

    expect(button()).toHaveTextContent('Dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('falls back to system when the stored value is junk', () => {
    localStorage.setItem(THEME_KEY, 'chartreuse')
    renderToggle()
    expect(button()).toHaveTextContent('System')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
