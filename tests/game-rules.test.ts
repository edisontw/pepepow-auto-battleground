import assert from "node:assert/strict";
import test from "node:test";
import { applyXp, effectiveShopOdds, incomeFor, oddsForLevel, oddsTotal, passiveXpForRound, resolveDropTarget } from "../app/game-rules";

test("passive XP follows the tuned two-round curve and caps at eight", () => {
  assert.deepEqual(Array.from({ length: 16 }, (_, index) => passiveXpForRound(index + 1)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]);
});

test("XP carry supports level boundaries and max level", () => {
  assert.deepEqual(applyXp(2, 1, 1), { level: 3, xp: 0, levelsGained: 1 });
  assert.deepEqual(applyXp(2, 0, 20), { level: 5, xp: 2, levelsGained: 3 });
  assert.deepEqual(applyXp(9, 70, 10), { level: 10, xp: 0, levelsGained: 1 });
});

test("income thresholds and symmetric streak bonuses use one rule source", () => {
  assert.deepEqual(incomeFor(9, 1), { base: 5, interest: 0, streakBonus: 0, total: 5 });
  assert.deepEqual(incomeFor(50, 5), { base: 5, interest: 5, streakBonus: 3, total: 13 });
  assert.deepEqual(incomeFor(50, -5), { base: 5, interest: 5, streakBonus: 3, total: 13 });
});

test("every displayed shop odds row totals 100 percent", () => {
  for (let level = 2; level <= 10; level += 1) {
    assert.equal(oddsTotal(level), 100);
    assert.equal(oddsForLevel(level).length, 5);
  }
  const withoutOneCost = effectiveShopOdds(4, new Set(["pickaxe-scout", "tunnel-guard", "spark-mechanic", "wild-burrower", "data-slinger", "glow-medic"]));
  assert.equal(withoutOneCost[0], 0);
  assert.equal(withoutOneCost.reduce((sum, value) => sum + value, 0), 100);
});

test("drop resolution prioritizes Board, then Bench, then explicit Sell", () => {
  assert.equal(resolveDropTarget(["sell", "bench:7"]), "bench:7");
  assert.equal(resolveDropTarget(["sell", "bench:2", "board:40"]), "board:40");
  assert.equal(resolveDropTarget(["sell"]), "sell");
  assert.equal(resolveDropTarget([]), null);
});
