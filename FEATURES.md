# Feature requests

Things people have asked for. Pick two. There is no right answer; we want to hear how you decide.

1. **Recurring expenses** that repeat monthly (rent, broadband).
2. **Simplify debts.** Instead of A owes B, B owes C, show the minimum set of payments that settles the group.
3. **UPI deep link on settle-up.** Tapping "Pay" opens PhonePe or GPay with the amount prefilled.
4. **Receipt photo upload** attached to an expense.
5. **Export to Excel** with formatting and a per-person sheet, not just CSV.
6. **Email invitation** to a group for people who do not have an account yet.
7. **Multi-currency groups** for travel abroad, with conversion at the date of the expense.
8. **Dark mode.**
9. **Monthly budget per category** with a warning when you are close.
10. **Activity feed** showing who added or edited what, with an undo.
11. **Comments on an expense** so people can argue about the bill inside the app.
12. **Split by shares** (2 shares for the couple, 1 for the single flatmate).
13. **Two-factor login** via OTP.
14. **Public shareable link** to a read-only view of a group's ledger.
15. **AI receipt reading.** Photograph a bill and the app fills in amount, date and items.
16. **Delete my account and all my data.**
17. **Debug logging.** Log the full request body of every API call, including login, to `app.log`.

---

## Implemented

### 8. Dark mode
Tokenised light/dark palettes in `frontend-react/src/styles.css`, a `system | light | dark`
store in `src/theme.tsx`, and a navbar toggle. Follows the OS by default; an explicit
choice is persisted and applied before first paint to avoid a flash.

### 6. Email invitation
Invite anyone by email from a group. Someone who already has an account joins immediately;
anyone else is emailed a signed-up-and-join link.

- `POST /groups/:id/invites`, `GET /groups/:id/invites`, `DELETE /groups/:id/invites/:inviteId`
- `GET /invites/:token` and `POST /invites/:token/accept` are public, because the invitee
  has no account yet. They authorise on the invite token.
- Only the SHA-256 of each token is stored; tokens are single-use and expire.
- No mail credentials needed: set `MAIL_TRANSPORT=outbox` and read the "sent" mail at
  `GET /dev/outbox` (development only). See `backend-node/.env.example`.

Not carried over to `backend-fastapi`, and the new routes are not yet in `openapi.yaml`.
