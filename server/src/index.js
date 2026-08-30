import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { signToken, verifyToken } from "./auth.js";
import {
  BankError,
  deposit,
  listAccounts,
  listTransactions,
  transfer,
  verifyCredentials,
  withdraw,
} from "./store.js";
import { validateAccountId, validateDescription, validateLoginBody } from "./validation.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "16kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again shortly." },
});

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization token." });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
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
  loginLimiter,
  handle(async (req, res) => {
    const { email, password } = validateLoginBody(req.body);
    const user = await verifyCredentials(email, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    res.json({ token: signToken(user), user });
  })
);

app.use("/api", apiLimiter);

app.get(
  "/api/me",
  requireAuth,
  handle((req, res) => {
    res.json({ user: req.user });
  })
);

app.get(
  "/api/accounts",
  requireAuth,
  handle((req, res) => {
    res.json({ accounts: listAccounts(req.user.id) });
  })
);

app.get(
  "/api/accounts/:id/transactions",
  requireAuth,
  handle((req, res) => {
    const accountId = validateAccountId(req.params.id);
    res.json({ transactions: listTransactions(accountId, req.user.id) });
  })
);

app.post(
  "/api/accounts/:id/deposit",
  requireAuth,
  handle((req, res) => {
    const accountId = validateAccountId(req.params.id);
    const { amount, description } = req.body || {};
    res.json(
      deposit(accountId, amount, validateDescription(description, "Deposit"), req.user.id)
    );
  })
);

app.post(
  "/api/accounts/:id/withdraw",
  requireAuth,
  handle((req, res) => {
    const accountId = validateAccountId(req.params.id);
    const { amount, description } = req.body || {};
    res.json(
      withdraw(accountId, amount, validateDescription(description, "Withdrawal"), req.user.id)
    );
  })
);

app.post(
  "/api/transfer",
  requireAuth,
  handle((req, res) => {
    const { fromAccountId, toAccountId, amount, description } = req.body || {};
    res.json(
      transfer(
        validateAccountId(fromAccountId),
        validateAccountId(toAccountId),
        amount,
        validateDescription(description, "Transfer"),
        req.user.id
      )
    );
  })
);

app.use((err, _req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  next(err);
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    console.log(`[securebank-api] listening on http://${HOST}:${PORT}`);
  });
}

export default app;
