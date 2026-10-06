import { Link } from 'react-router'
import { API_BASE } from '../api'

/**
 * A reviewer-facing summary of the two features built from FEATURES.md.
 * Deliberately a normal page using the shared tokens, so it also demonstrates
 * the dark mode it describes.
 */
export default function HighlightsPage() {
  return (
    <>
      <h1>What I built</h1>
      <p className="muted">
        Two feature requests from <code>FEATURES.md</code>. Everything else on this site is the
        unmodified assignment template.
      </p>

      <section className="card">
        <span className="badge">Feature 8</span>
        <h3>Dark mode</h3>
        <p>
          Three modes — follow the operating system, or pin light or dark. The choice is remembered
          and applied before the first paint, so there is no flash of the wrong theme on reload.
        </p>
        <h4>Try it</h4>
        <ol>
          <li>
            Use the <strong>theme button</strong> in the top right. It cycles System → Light → Dark.
          </li>
          <li>Reload the page — the choice survives.</li>
          <li>Set it to System and change your OS appearance setting; the app follows.</li>
        </ol>
        <p className="muted">
          Every colour is a CSS custom property, so one token block drives the whole app. All
          fourteen foreground/background pairs pass WCAG AA contrast in both themes.
        </p>
      </section>

      <section className="card">
        <span className="badge">Feature 6</span>
        <h3>Email invitation for people without an account</h3>
        <p>
          Previously you could only add someone to a group if they had already signed up; any other
          address was rejected with <code>no user with that email</code>. Now you invite anyone by
          email and they can create their account from the invitation link.
        </p>
        <h4>Try it</h4>
        <ol>
          <li>
            Open a group, for example <Link to="/groups/1">Goa trip</Link>.
          </li>
          <li>
            In <strong>Members</strong>, invite <code>bilal@example.com</code> — he already has an
            account, so he joins immediately and no email is sent.
          </li>
          <li>
            Now invite an address with no account, such as <code>priya@example.com</code>. A{' '}
            <strong>Pending invitation</strong> appears and a development link is shown.
          </li>
          <li>
            Open that link in a <strong>private window</strong>. You will see the signup form with
            the invited address fixed. Create the account — it lands straight inside the group.
          </li>
          <li>
            Opening the same link twice, or after <strong>Revoke</strong>, correctly fails: tokens
            are single-use and expire.
          </li>
        </ol>
        <h4>Seeing the email</h4>
        <p>
          There is no mail provider wired up, so mail goes to a development sink instead. The
          messages, including the invitation link, are readable at{' '}
          <a href={`${API_BASE}/dev/outbox`} target="_blank" rel="noreferrer">
            {API_BASE}/dev/outbox
          </a>
          . That route is disabled in production builds.
        </p>
        <h4>Notes worth reading</h4>
        <ul>
          <li>Only the SHA-256 of each token is stored, so a database dump cannot join groups.</li>
          <li>
            Accepting takes the email from the invitation, never from the request body — a leaked
            token cannot be used to register a different address.
          </li>
          <li>
            A link forwarded to someone else is refused: the signed-in address must match the
            invited one.
          </li>
          <li>Unknown, expired, revoked and already-used tokens all return the same 404.</li>
        </ul>
      </section>

      <section className="card">
        <h3>Signing in</h3>
        <p>
          Seed accounts all use the password <code>password123</code>:
        </p>
        <ul className="list">
          <li>
            <code>asha@example.com</code> — in both groups, created them
          </li>
          <li>
            <code>bilal@example.com</code> — in both groups
          </li>
          <li>
            <code>chetan@example.com</code> — in Goa trip only
          </li>
        </ul>
      </section>

      <p>
        <Link to="/groups">Go to groups</Link>
      </p>
    </>
  )
}
