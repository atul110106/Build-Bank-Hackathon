import { BankError } from "./store.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_TRANSACTION_AMOUNT = Number(process.env.MAX_TRANSACTION_AMOUNT) || 100_000;
export const MAX_DESCRIPTION_LENGTH = 200;

export function validateLoginBody(body) {
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  if (!email || !EMAIL_RE.test(email)) {
    throw new BankError("A valid email address is required.");
  }
  if (!password || password.length > 128) {
    throw new BankError("Password is required.");
  }
  return { email, password };
}

export function validateDescription(description, fallback) {
  const text = String(description ?? fallback ?? "").trim();
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    throw new BankError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`);
  }
  return text || fallback || "";
}

export function validateAccountId(id) {
  const value = String(id ?? "").trim();
  if (!value || value.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new BankError("Invalid account id.");
  }
  return value;
}
