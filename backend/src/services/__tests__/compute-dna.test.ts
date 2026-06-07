import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDnaNarrative,
  pickArchetype,
  savingsAxisScore,
  spendAxisScore,
} from "../compute-dna.js";

test("spendAxisScore matches peer baseline when share equals peer median", () => {
  assert.equal(spendAxisScore(12, 12, 48), 48);
});

test("spendAxisScore scales up when user share exceeds peer median", () => {
  assert.equal(spendAxisScore(24, 12, 48), 96);
});

test("savingsAxisScore scores savings relative to peer savings rate", () => {
  assert.equal(savingsAxisScore(15), 50);
  assert.equal(savingsAxisScore(30), 100);
});

test("pickArchetype uses strongest positive deviation", () => {
  const axes = [
    { label: "Dining", you: 90, peers: 48 },
    { label: "Travel", you: 30, peers: 39 },
    { label: "Savings", you: 50, peers: 50 },
  ];
  assert.deepEqual(pickArchetype(axes), {
    archetype: "The Experience Seeker",
    leadAxis: "Dining",
  });
});

test("buildDnaNarrative references lead axis and savings", () => {
  const text = buildDnaNarrative(
    "The Experience Seeker",
    "Dining",
    70,
    50,
  );
  assert.match(text, /dining/i);
  assert.match(text, /saving/i);
});
