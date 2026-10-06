# backend-node

Money Follows API on Node 22, Express 5, TypeScript and SQLite. Implements `../openapi.yaml` on port 8000.

## Run

    npm install
    npm run seed     # drops and recreates data.db from ../seed/seed.json
    npm run dev      # tsx watch, http://localhost:8000
    npm test         # vitest against a seeded in-memory database
    npm run build && npm start

## Environment

- `PORT` - listen port, default 8000.
