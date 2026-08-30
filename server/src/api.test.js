import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetState } from "./store.js";
import { signToken } from "./auth.js";

let app;
let server;
let baseUrl;

before(async () => {
  process.env.NODE_ENV = "test";
  resetState();
  const mod = await import("./index.js");
  app = mod.default;
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

async function json(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

test("login returns a JWT for valid credentials", async () => {
  resetState();
  const { res, body } = await json("/api/login", {
    method: "POST",
    body: JSON.stringify({ email: "demo@securebank.test", password: "hackathon" }),
  });
  assert.equal(res.status, 200);
  assert.match(body.token, /^eyJ/);
  assert.equal(body.user.email, "demo@securebank.test");
});

test("login rejects invalid credentials", async () => {
  resetState();
  const { res } = await json("/api/login", {
    method: "POST",
    body: JSON.stringify({ email: "demo@securebank.test", password: "wrong" }),
  });
  assert.equal(res.status, 401);
});

test("protected routes reject missing or invalid tokens", async () => {
  resetState();
  const missing = await json("/api/accounts");
  assert.equal(missing.res.status, 401);

  const invalid = await json("/api/accounts", {
    headers: { Authorization: "Bearer not-a-real-jwt" },
  });
  assert.equal(invalid.res.status, 401);
});

test("GET /api/me returns the authenticated user", async () => {
  resetState();
  const login = await json("/api/login", {
    method: "POST",
    body: JSON.stringify({ email: "demo@securebank.test", password: "hackathon" }),
  });
  const { res, body } = await json("/api/me", {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(res.status, 200);
  assert.equal(body.user.id, "user-1");
});

test("accounts and transactions require ownership", async () => {
  resetState();
  const token = signToken({ id: "other-user", email: "x@test.com", name: "Other" });
  const accounts = await json("/api/accounts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(accounts.res.status, 200);
  assert.equal(accounts.body.accounts.length, 0);

  const txs = await json("/api/accounts/acc-checking/transactions", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(txs.res.status, 403);
});

test("deposit succeeds with a valid token", async () => {
  resetState();
  const login = await json("/api/login", {
    method: "POST",
    body: JSON.stringify({ email: "demo@securebank.test", password: "hackathon" }),
  });
  const { res, body } = await json("/api/accounts/acc-checking/deposit", {
    method: "POST",
    headers: { Authorization: `Bearer ${login.body.token}` },
    body: JSON.stringify({ amount: 25, description: "API test deposit" }),
  });
  assert.equal(res.status, 200);
  assert.equal(body.transaction.amount, 25);
});
