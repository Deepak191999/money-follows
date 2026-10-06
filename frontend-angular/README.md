# Money Follows - Angular frontend

Angular 22 client for the Money Follows API (`../openapi.yaml`). Expects a backend on `http://localhost:8000`;
change `src/environments/environment.ts` if yours runs elsewhere.

- Run: `npm install && npm start` then open http://localhost:4200
- Build: `npm run build` (output in `dist/frontend-angular/browser`)
- Test: `npm test` (Vitest, single headless run)
- Docker: `docker build -t money-follows-angular . && docker run -p 4200:80 money-follows-angular`

Pages: `/login`, `/groups`, `/groups/:id`, `/me`. The bearer token lives in `localStorage` and is attached by `src/app/shared/auth.interceptor.ts`.
