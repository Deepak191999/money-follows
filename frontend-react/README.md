# Money Follows - React frontend

React 19 + Vite + TypeScript + react-router. Talks to the backend on `http://localhost:8000`.

    npm install && npm run dev      # http://localhost:5173
    npm test -- --run               # vitest + testing-library
    npm run build                   # static bundle in dist/

Copy `.env.example` to `.env` to point at a different API (`VITE_API_BASE`).

Docker: `docker build -t money-follows-react .` serves `dist/` via nginx on port 80.
