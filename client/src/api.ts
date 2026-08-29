export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings";
  number: string;
  balance: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: "deposit" | "withdrawal" | "transfer-in" | "transfer-out";
  amount: number;
  description: string;
  counterparty: string;
  balanceAfter: number;
  createdAt: string;
}

let token: string | null = sessionStorage.getItem("sb_token");

function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  isAuthenticated(): boolean {
    return Boolean(token);
  },
  async login(email: string, password: string): Promise<User> {
    const data = await request<{ token: string; user: User }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    token = data.token;
    sessionStorage.setItem("sb_token", data.token);
    return data.user;
  },
  logout() {
    token = null;
    sessionStorage.removeItem("sb_token");
  },
  getMe() {
    return request<{ user: User }>("/me");
  },
  getAccounts() {
    return request<{ accounts: Account[] }>("/accounts");
  },
  getTransactions(accountId: string) {
    return request<{ transactions: Transaction[] }>(`/accounts/${accountId}/transactions`);
  },
  deposit(accountId: string, amount: number, description: string) {
    return request(`/accounts/${accountId}/deposit`, {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    });
  },
  withdraw(accountId: string, amount: number, description: string) {
    return request(`/accounts/${accountId}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    });
  },
  transfer(fromAccountId: string, toAccountId: string, amount: number, description: string) {
    return request("/transfer", {
      method: "POST",
      body: JSON.stringify({ fromAccountId, toAccountId, amount, description }),
    });
  },
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
