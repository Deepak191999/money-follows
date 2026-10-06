# Money Follows

A shared expense tracker: groups, splits, settle-up, and a personal monthly view. This is the
ShipThis developer assignment template. Read this whole file before you start.

## Pick your stack

One frontend and one backend. Any combination works; both backends implement `openapi.yaml`
and listen on port 8000, and both frontends talk to `http://localhost:8000` by default.

| Folder | Stack | Run |
|---|---|---|
| `backend-node` | Node 22, Express 5, TypeScript, SQLite | `npm install && npm run seed && npm run dev` |
| `backend-fastapi` | Python 3.12, FastAPI, SQLAlchemy 2, SQLite | `uv sync && uv run seed && uv run dev` |
| `frontend-angular` | Angular 22 | `npm install && npm start` (port 4200) |
| `frontend-react` | React 19, Vite | `npm install && npm run dev` (port 5173) |

Node 22.22 or newer is required for the Angular frontend (`nvm use` picks it up from `.nvmrc`).
Python 3.12 and `uv` for the FastAPI backend.

Seed users all have the password `password123`: `asha@example.com`, `bilal@example.com`,
`chetan@example.com`.

## The task

This is a 30-minute live session over screen share. Before the call, get one frontend and one
backend running and log in with a seed user. That is all the preparation we ask for.

On the call:

1. Open `FEATURES.md`. Pick **two** features you would build first. Tell us why those two, and
   why not one or two of the others.
2. Build them. Use any AI tool you like. Think out loud.
3. The code has problems: some bugs, some security issues, some design decisions we would not
   accept in a review. If you run into one while building, fix it or say what you would do.

You are not expected to finish both. A finished first feature and a clear plan for the second is
a good outcome.

## Rules

- Any AI tool is allowed. You drive, it assists. You must be able to explain every line you
  keep.
- Keep the existing tests green. Add a test where one makes sense.
- Fix things in the right place. A frontend change is not a fix for a backend problem.
- Do not deploy anything anywhere.

## How we grade

Five headings, equally weighted:

- **Choice** - why these two features, and what you said no to.
- **Method** - you understood the code before changing it, and worked in small verified steps.
- **Code quality** - changes are minimal and in the right layer; no drive-by rewrites.
- **AI steering** - you drove, the tool assisted, and you caught at least one thing it got wrong.
- **Explanation** - you can defend every line you kept.

Finishing both features is not one of the headings.
