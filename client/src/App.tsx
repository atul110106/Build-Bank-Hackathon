import { useEffect, useState } from "react";
import {
  Account,
  Transaction,
  User,
  api,
  formatCurrency,
  formatDate,
} from "./api";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    // If we already have a token, try to load accounts to confirm the session.
    if (api.isAuthenticated()) {
      api
        .getAccounts()
        .then(() => setUser({ id: "user-1", name: "Ada Lovelace", email: "demo@securebank.test" }))
        .catch(() => api.logout())
        .finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
  }, []);

  if (!booted) return null;

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => { api.logout(); setUser(null); }} />;
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("demo@securebank.test");
  const [password, setPassword] = useState("hackathon");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const u = await api.login(email, password);
      onLogin(u);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">SecureBank</span>
        </div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your accounts</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn primary block" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="hint">Demo credentials are pre-filled for you.</p>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function refreshAccounts() {
    const { accounts } = await api.getAccounts();
    setAccounts(accounts);
    setSelectedId((prev) => prev ?? accounts[0]?.id ?? null);
    return accounts;
  }

  async function refreshTransactions(accountId: string) {
    const { transactions } = await api.getTransactions(accountId);
    setTransactions(transactions);
  }

  useEffect(() => {
    refreshAccounts().catch((e) => flash("err", (e as Error).message));
  }, []);

  useEffect(() => {
    if (selectedId) refreshTransactions(selectedId).catch((e) => flash("err", (e as Error).message));
  }, [selectedId]);

  function flash(kind: "ok" | "err", text: string) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 4000);
  }

  const selected = accounts.find((a) => a.id === selectedId) || null;
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  async function afterMutation(message: string) {
    const list = await refreshAccounts();
    if (selectedId) await refreshTransactions(selectedId);
    else if (list[0]) await refreshTransactions(list[0].id);
    flash("ok", message);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">SecureBank</span>
        </div>
        <nav>
          <div className="nav-item active">Accounts</div>
          <div className="nav-item">Payments</div>
          <div className="nav-item">Cards</div>
          <div className="nav-item">Settings</div>
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="who">
            <div className="who-name">{user.name}</div>
            <div className="who-email">{user.email}</div>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <div className="muted">Total balance</div>
            <div className="total" data-testid="total-balance">{formatCurrency(total)}</div>
          </div>
          <button className="btn ghost" onClick={onLogout}>Sign out</button>
        </header>

        {banner && (
          <div className={`banner ${banner.kind}`} role="status">{banner.text}</div>
        )}

        <section className="cards">
          {accounts.map((a) => (
            <button
              key={a.id}
              className={`account-card ${a.type} ${selectedId === a.id ? "selected" : ""}`}
              onClick={() => setSelectedId(a.id)}
              data-testid={`account-${a.id}`}
            >
              <div className="account-type">{a.type.toUpperCase()}</div>
              <div className="account-name">{a.name}</div>
              <div className="account-balance">{formatCurrency(a.balance)}</div>
              <div className="account-number">{a.number}</div>
            </button>
          ))}
        </section>

        <div className="panels">
          <section className="panel transactions">
            <h2>{selected ? `${selected.name} · Transactions` : "Transactions"}</h2>
            {transactions.length === 0 ? (
              <p className="muted">No transactions yet.</p>
            ) : (
              <ul className="tx-list">
                {transactions.map((t) => (
                  <li key={t.id} className="tx-row" data-testid="tx-row">
                    <div className={`tx-icon ${t.type}`}>{iconFor(t.type)}</div>
                    <div className="tx-main">
                      <div className="tx-desc">{t.description}</div>
                      <div className="tx-meta">{t.counterparty} · {formatDate(t.createdAt)}</div>
                    </div>
                    <div className={`tx-amount ${isCredit(t.type) ? "credit" : "debit"}`}>
                      {isCredit(t.type) ? "+" : "−"}{formatCurrency(t.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ActionPanel
            accounts={accounts}
            selected={selected}
            onDone={afterMutation}
            onError={(m) => flash("err", m)}
          />
        </div>
      </main>
    </div>
  );
}

function ActionPanel({
  accounts,
  selected,
  onDone,
  onError,
}: {
  accounts: Account[];
  selected: Account | null;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<"deposit" | "withdraw" | "transfer">("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const other = accounts.find((a) => a.id !== selected?.id);
    setToAccountId(other?.id || "");
  }, [accounts, selected?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      onError("Enter a positive amount.");
      return;
    }
    setBusy(true);
    try {
      if (tab === "deposit") {
        await api.deposit(selected.id, value, description || "Deposit");
        onDone(`Deposited ${formatCurrency(value)} to ${selected.name}.`);
      } else if (tab === "withdraw") {
        await api.withdraw(selected.id, value, description || "Withdrawal");
        onDone(`Withdrew ${formatCurrency(value)} from ${selected.name}.`);
      } else {
        if (!toAccountId) return onError("Choose a destination account.");
        await api.transfer(selected.id, toAccountId, value, description || "Transfer");
        const to = accounts.find((a) => a.id === toAccountId);
        onDone(`Transferred ${formatCurrency(value)} to ${to?.name}.`);
      }
      setAmount("");
      setDescription("");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel actions">
      <h2>Move money</h2>
      <div className="tabs">
        {(["deposit", "withdraw", "transfer"] as const).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
            type="button"
            data-testid={`tab-${t}`}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        <label>
          From account
          <input value={selected ? `${selected.name} (${formatCurrency(selected.balance)})` : ""} disabled />
        </label>
        {tab === "transfer" && (
          <label>
            To account
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} data-testid="transfer-to">
              {accounts
                .filter((a) => a.id !== selected?.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Amount
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            data-testid="amount-input"
          />
        </label>
        <label>
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note" />
        </label>
        <button className="btn primary block" disabled={busy || !selected} type="submit" data-testid="submit-action">
          {busy ? "Processing…" : `Confirm ${tab}`}
        </button>
      </form>
    </section>
  );
}

function isCredit(type: Transaction["type"]) {
  return type === "deposit" || type === "transfer-in";
}

function iconFor(type: Transaction["type"]) {
  switch (type) {
    case "deposit":
      return "↓";
    case "withdrawal":
      return "↑";
    case "transfer-in":
      return "→";
    case "transfer-out":
      return "←";
    default:
      return "•";
  }
}
