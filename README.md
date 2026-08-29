# Build-Bank-Hackathon — SecureBank

A full-stack banking demo application built for a hackathon. It ships with a
modern React dashboard and a small Express API so the whole thing runs
end-to-end with zero external infrastructure.

## Features

- Login with pre-filled demo credentials
- View checking & savings accounts with live balances and a total
- Transaction history per account
- Move money: **deposit**, **withdraw**, and **transfer** between accounts
- Server-side validation (positive amounts, insufficient-funds protection, auth guard)

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18 + Vite + TypeScript |
| Backend | Node.js + Express (ESM) |
| Data | In-memory store seeded with demo data (resets on restart) |
| Tooling | npm workspaces, `concurrently`, `node --test` |

## Project layout

```
.
├── client/            # Vite + React + TypeScript SPA (port 3000)
├── server/            # Express JSON API (port 3001)
├── package.json       # npm workspaces + dev/build/test scripts
└── .cursor/           # Cloud Agent environment configuration
```

The Vite dev server proxies `/api/*` to the Express server, so the browser only
talks to a single origin (port 3000).

## Getting started

```bash
npm install        # install all workspace dependencies
npm run dev        # start API (:3001) and web client (:3000) together
```

Then open http://localhost:3000 and sign in with the pre-filled demo
credentials (`demo@securebank.test` / `hackathon`).

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and web client together (development) |
| `npm run dev:server` | Run only the Express API with file watching |
| `npm run dev:client` | Run only the Vite dev server |
| `npm test` | Run the backend unit tests (`node --test`) |
| `npm run build` | Build the production client bundle |

## API overview

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `POST` | `/api/login` | Authenticate and receive a demo token |
| `GET` | `/api/accounts` | List the signed-in user's accounts |
| `GET` | `/api/accounts/:id/transactions` | List transactions for an account |
| `POST` | `/api/accounts/:id/deposit` | Deposit funds |
| `POST` | `/api/accounts/:id/withdraw` | Withdraw funds |
| `POST` | `/api/transfer` | Transfer funds between accounts |

> Note: this demo stores data in memory and uses a simplified auth token for
> illustration only. A production deployment would use a real database and
> proper authentication (see the ephemeral-filesystem note in the deployment
> platform docs).
