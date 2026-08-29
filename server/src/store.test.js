import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deposit,
  getAccount,
  listAccounts,
  listTransactions,
  resetState,
  transfer,
  verifyCredentials,
  withdraw,
} from "./store.js";

test("verifyCredentials accepts demo login and rejects bad password", () => {
  resetState();
  assert.ok(verifyCredentials("demo@securebank.test", "hackathon"));
  assert.equal(verifyCredentials("demo@securebank.test", "wrong"), null);
});

test("deposit increases balance and records a transaction", () => {
  resetState();
  const before = getAccount("acc-checking").balance;
  const { account } = deposit("acc-checking", 100, "Test deposit");
  assert.equal(account.balance, Math.round((before + 100) * 100) / 100);
  const txs = listTransactions("acc-checking");
  assert.equal(txs[0].type, "deposit");
  assert.equal(txs[0].amount, 100);
});

test("withdraw rejects insufficient funds", () => {
  resetState();
  assert.throws(() => withdraw("acc-checking", 1_000_000), /Insufficient funds/);
});

test("withdraw rejects non-positive amounts", () => {
  resetState();
  assert.throws(() => withdraw("acc-checking", -5), /positive number/);
  assert.throws(() => deposit("acc-checking", 0), /positive number/);
});

test("transfer moves funds between accounts and records both legs", () => {
  resetState();
  const fromBefore = getAccount("acc-checking").balance;
  const toBefore = getAccount("acc-savings").balance;
  const result = transfer("acc-checking", "acc-savings", 200, "Move to savings");
  assert.equal(result.from.balance, Math.round((fromBefore - 200) * 100) / 100);
  assert.equal(result.to.balance, Math.round((toBefore + 200) * 100) / 100);

  const outTx = listTransactions("acc-checking")[0];
  const inTx = listTransactions("acc-savings")[0];
  assert.equal(outTx.type, "transfer-out");
  assert.equal(inTx.type, "transfer-in");
});

test("transfer rejects same-account and insufficient funds", () => {
  resetState();
  assert.throws(() => transfer("acc-checking", "acc-checking", 10), /same account/);
  assert.throws(() => transfer("acc-checking", "acc-savings", 1_000_000), /Insufficient funds/);
});

test("listAccounts returns seeded accounts", () => {
  resetState();
  const accounts = listAccounts();
  assert.equal(accounts.length, 2);
  assert.deepEqual(
    accounts.map((a) => a.id).sort(),
    ["acc-checking", "acc-savings"]
  );
});
