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

const USER_ID = "user-1";

test("verifyCredentials accepts demo login and rejects bad password", async () => {
  resetState();
  assert.ok(await verifyCredentials("demo@securebank.test", "hackathon"));
  assert.equal(await verifyCredentials("demo@securebank.test", "wrong"), null);
});

test("deposit increases balance and records a transaction", () => {
  resetState();
  const before = getAccount("acc-checking").balance;
  const { account } = deposit("acc-checking", 100, "Test deposit", USER_ID);
  assert.equal(account.balance, Math.round((before + 100) * 100) / 100);
  const txs = listTransactions("acc-checking", USER_ID);
  assert.equal(txs[0].type, "deposit");
  assert.equal(txs[0].amount, 100);
});

test("withdraw rejects insufficient funds", () => {
  resetState();
  assert.throws(() => withdraw("acc-checking", 50_000, "Too much", USER_ID), /Insufficient funds/);
});

test("withdraw rejects non-positive amounts", () => {
  resetState();
  assert.throws(() => withdraw("acc-checking", -5, "Bad", USER_ID), /positive number/);
  assert.throws(() => deposit("acc-checking", 0, "Bad", USER_ID), /positive number/);
});

test("withdraw rejects amounts above the configured cap", () => {
  resetState();
  assert.throws(() => withdraw("acc-checking", 100_001, "Too big", USER_ID), /cannot exceed/);
});

test("transfer moves funds between accounts and records both legs", () => {
  resetState();
  const fromBefore = getAccount("acc-checking").balance;
  const toBefore = getAccount("acc-savings").balance;
  const result = transfer("acc-checking", "acc-savings", 200, "Move to savings", USER_ID);
  assert.equal(result.from.balance, Math.round((fromBefore - 200) * 100) / 100);
  assert.equal(result.to.balance, Math.round((toBefore + 200) * 100) / 100);

  const outTx = listTransactions("acc-checking", USER_ID)[0];
  const inTx = listTransactions("acc-savings", USER_ID)[0];
  assert.equal(outTx.type, "transfer-out");
  assert.equal(inTx.type, "transfer-in");
});

test("transfer rejects same-account and insufficient funds", () => {
  resetState();
  assert.throws(() => transfer("acc-checking", "acc-checking", 10, "Same", USER_ID), /same account/);
  assert.throws(
    () => transfer("acc-checking", "acc-savings", 50_000, "Too much", USER_ID),
    /Insufficient funds/
  );
});

test("listAccounts returns only accounts owned by the user", () => {
  resetState();
  const accounts = listAccounts(USER_ID);
  assert.equal(accounts.length, 2);
  assert.deepEqual(
    accounts.map((a) => a.id).sort(),
    ["acc-checking", "acc-savings"]
  );
  assert.equal(listAccounts("other-user").length, 0);
});

test("access to another user's account is denied", () => {
  resetState();
  assert.throws(() => deposit("acc-checking", 10, "Hack", "other-user"), /Access denied/);
  assert.throws(() => listTransactions("acc-checking", "other-user"), /Access denied/);
});
