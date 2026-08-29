import express from "express";
import cors from "cors";
import {
  BankError,
  deposit,
  getAccount,
  listAccounts,
  listTransactions,
  transfer,
  verifyCredentials,
  withdraw,
} from "./store.js";

const app = express();
app.use(cors());
app.use(express.json());

// Extremely simple demo auth: any non-empty bearer token is accepted.
// The login endpoint validates the demo credentials and hands back a token.
function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization token." });
  }
  next();
}

function handle(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof BankError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: "Internal server error." });
    }
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "securebank-api", time: new Date().toISOString() });
});

app.post(
  "/api/login",
  handle((req, res) => {
    const { email, password } = req.body || {};
    const user = verifyCredentials(email, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    res.json({ token: `demo-${user.id}-${Date.now()}`, user });
  })
);

app.get(
  "/api/accounts",
  requireAuth,
  handle((_req, res) => {
    res.json({ accounts: listAccounts() });
  })
);

app.get(
  "/api/accounts/:id/transactions",
  requireAuth,
  handle((req, res) => {
    const account = getAccount(req.params.id);
    if (!account) return res.status(404).json({ error: "Account not found." });
    res.json({ transactions: listTransactions(req.params.id) });
  })
);

app.post(
  "/api/accounts/:id/deposit",
  requireAuth,
  handle((req, res) => {
    const { amount, description } = req.body || {};
    res.json(deposit(req.params.id, amount, description));
  })
);

app.post(
  "/api/accounts/:id/withdraw",
  requireAuth,
  handle((req, res) => {
    const { amount, description } = req.body || {};
    res.json(withdraw(req.params.id, amount, description));
  })
);

app.post(
  "/api/transfer",
  requireAuth,
  handle((req, res) => {
    const { fromAccountId, toAccountId, amount, description } = req.body || {};
    res.json(transfer(fromAccountId, toAccountId, amount, description));
  })
);

const PORT = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    console.log(`[securebank-api] listening on http://${HOST}:${PORT}`);
  });
}

export default app;
