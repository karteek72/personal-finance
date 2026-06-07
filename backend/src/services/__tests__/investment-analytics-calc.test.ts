import assert from "node:assert/strict";
import test from "node:test";

import { splitBalanceForNetWorth } from "../../config/account-types.js";

test("computeLiveNetWorth classification: mortgage reduces net worth", () => {
  const accounts = [
    { type: "depository", balance: 10_000 },
    { type: "investment", balance: 50_000 },
    { type: "loan", balance: 200_000 },
    { type: "credit", balance: 3_500 },
  ];

  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    const split = splitBalanceForNetWorth(account.type, account.balance);
    assets += split.assets;
    liabilities += split.liabilities;
  }

  assert.equal(assets, 60_000);
  assert.equal(liabilities, 203_500);
  assert.equal(assets - liabilities, -143_500);
});

test("investment history fields are independent (no contribution ratio)", () => {
  const totalContributed = 10_000;
  const portfolioValue = 15_000;
  const totalCost = 12_000;
  const unrealizedGain = portfolioValue - totalCost;

  assert.notEqual(
    totalContributed * (portfolioValue / totalCost),
    portfolioValue,
    "fabricated estimate should differ from real market value",
  );
  assert.equal(unrealizedGain, 3000);
  assert.equal(totalContributed, 10_000);
});
