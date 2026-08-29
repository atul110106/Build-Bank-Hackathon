import { randomUUID } from "node:crypto";

/**
 * In-memory data store for the SecureBank demo.
 *
 * This is intentionally simple (no external database) so the app runs
 * end-to-end with zero infrastructure. State resets when the server restarts,
 * which is fine for a hackathon demo. For a production deployment this would be
 * backed by a real database (see the Render platform notes about the ephemeral
 * filesystem).
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function accountNumber() {
  return `**** ${Math.floor(1000 + Math.random() * 9000)}`;
}

function createInitialState() {
  const user = {
    id: "user-1",
    name: "Ada Lovelace",
    email: "demo@securebank.test",
    password: "hackathon",
  };

  const checking = {
    id: "acc-checking",
    userId: user.id,
    name: "Everyday Checking",
    type: "checking",
    number: accountNumber(),
    balance: 4820.55,
  };

  const savings = {
    id: "acc-savings",
    userId: user.id,
    name: "Rainy Day Savings",
    type: "savings",
    number: accountNumber(),
    balance: 15250.0,
  };

  const now = Date.now();
  const transactions = [
    {
      id: randomUUID(),
      accountId: checking.id,
      type: "deposit",
      amount: 3200.0,
      description: "Payroll deposit",
      counterparty: "Acme Corp",
      balanceAfter: 4820.55,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: randomUUID(),
      accountId: checking.id,
      type: "withdrawal",
      amount: 84.2,
      description: "Groceries",
      counterparty: "Fresh Market",
      balanceAfter: 4736.35,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
    {
      id: randomUUID(),
      accountId: savings.id,
      type: "deposit",
      amount: 500.0,
      description: "Monthly savings",
      counterparty: "Auto-transfer",
      balanceAfter: 15250.0,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 1).toISOString(),
    },
  ];

  return { user, accounts: [checking, savings], transactions };
}

let state = createInitialState();

export function resetState() {
  state = createInitialState();
  return state;
}

export function getUser() {
  return state.user;
}

export function verifyCredentials(email, password) {
  const u = state.user;
  if (u.email.toLowerCase() === String(email).toLowerCase() && u.password === password) {
    return { id: u.id, name: u.name, email: u.email };
  }
  return null;
}

export function listAccounts() {
  return state.accounts.map((a) => ({ ...a }));
}

export function getAccount(id) {
  return state.accounts.find((a) => a.id === id);
}

export function listTransactions(accountId) {
  return state.transactions
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((t) => ({ ...t }));
}

function recordTransaction(account, { type, amount, description, counterparty }) {
  const tx = {
    id: randomUUID(),
    accountId: account.id,
    type,
    amount: round2(amount),
    description: description || "",
    counterparty: counterparty || "",
    balanceAfter: account.balance,
    createdAt: new Date().toISOString(),
  };
  state.transactions.push(tx);
  return tx;
}

class BankError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function validateAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new BankError("Amount must be a positive number.");
  }
  return round2(value);
}

export function deposit(accountId, amount, description) {
  const account = getAccount(accountId);
  if (!account) throw new BankError("Account not found.", 404);
  const value = validateAmount(amount);
  account.balance = round2(account.balance + value);
  const tx = recordTransaction(account, {
    type: "deposit",
    amount: value,
    description: description || "Deposit",
    counterparty: "Cash / external",
  });
  return { account: { ...account }, transaction: tx };
}

export function withdraw(accountId, amount, description) {
  const account = getAccount(accountId);
  if (!account) throw new BankError("Account not found.", 404);
  const value = validateAmount(amount);
  if (value > account.balance) {
    throw new BankError("Insufficient funds for this withdrawal.");
  }
  account.balance = round2(account.balance - value);
  const tx = recordTransaction(account, {
    type: "withdrawal",
    amount: value,
    description: description || "Withdrawal",
    counterparty: "Cash / external",
  });
  return { account: { ...account }, transaction: tx };
}

export function transfer(fromAccountId, toAccountId, amount, description) {
  if (fromAccountId === toAccountId) {
    throw new BankError("Cannot transfer to the same account.");
  }
  const from = getAccount(fromAccountId);
  const to = getAccount(toAccountId);
  if (!from || !to) throw new BankError("Account not found.", 404);
  const value = validateAmount(amount);
  if (value > from.balance) {
    throw new BankError("Insufficient funds for this transfer.");
  }

  from.balance = round2(from.balance - value);
  to.balance = round2(to.balance + value);

  const outTx = recordTransaction(from, {
    type: "transfer-out",
    amount: value,
    description: description || `Transfer to ${to.name}`,
    counterparty: to.name,
  });
  const inTx = recordTransaction(to, {
    type: "transfer-in",
    amount: value,
    description: description || `Transfer from ${from.name}`,
    counterparty: from.name,
  });

  return {
    from: { ...from },
    to: { ...to },
    transactions: [outTx, inTx],
  };
}

export { BankError };
