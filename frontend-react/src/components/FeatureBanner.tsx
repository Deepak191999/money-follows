import { useState } from 'react'
import { Link } from 'react-router'

const DISMISS_KEY = 'highlights-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Points a first-time reviewer at the two features, then stays out of the way. */
export default function FeatureBanner() {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* dismissal just will not persist */
    }
  }

  return (
    <div className="banner">
      <span>
        This build adds two features from <code>FEATURES.md</code>:{' '}
        <strong>dark mode</strong> and <strong>email invitations</strong>.{' '}
        <Link to="/highlights">See what I built and how to try it</Link>.
      </span>
      <button type="button" className="link" onClick={dismiss} aria-label="Dismiss">
        Dismiss
      </button>
    </div>
  )
}
