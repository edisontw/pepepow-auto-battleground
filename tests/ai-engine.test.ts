import assert from "node:assert/strict";
import test from "node:test";
import { advanceAICommanders, aiStrategySnapshot, assertAILegal, createAICommanders, ownedBaseCopies, planAI } from "../app/ai-engine";
import { createSeededRandom, mixSeed, OwnedUnit } from "../app/battle-engine";

test("owned-copy reminders count upgraded pieces as base copies", () => {
  const units: OwnedUnit[] = [
    { uid: "a", unitId: "pickaxe-scout", star: 1, position: 32, itemIds: [] },
    { uid: "b", unitId: "pickaxe-scout", star: 2, position: null, itemIds: [] },
    { uid: "c", unitId: "pickaxe-scout", star: 3, position: null, itemIds: [] },
  ];
  assert.equal(ownedBaseCopies(units, "pickaxe-scout"), 13);
});

test("AI starts fairly with two real units and no hidden resources", () => {
  for (const difficulty of ["Easy", "Normal", "Hard"] as const) {
    const ais = createAICommanders(difficulty, createSeededRandom(123));
    assert.equal(ais.length, 7);
    for (const ai of ais) {
      assert.equal(ai.difficulty, difficulty);
      assert.equal(ai.units.filter((unit) => unit.position !== null).length, Math.min(ai.level, ai.units.length));
      assert.ok(ai.gold >= 0 && ai.gold <= 10);
      assert.equal(assertAILegal(ai), true);
    }
  }
});

test("AI planning is deterministic and remains economy/formation legal", () => {
  const base = createAICommanders("Hard", createSeededRandom(904))[0];
  const first = planAI(structuredClone(base), 8, createSeededRandom(77));
  const second = planAI(structuredClone(base), 8, createSeededRandom(77));
  assert.deepEqual(first, second);
  assert.equal(assertAILegal(first), true);
});

test("personalities produce measurably different economy and action profiles", () => {
  const totals = new Map<string, { gold: number; rerolls: number; training: number; synergy: number }>();
  for (let seed = 1; seed <= 120; seed += 1) {
    let ais = createAICommanders("Normal", createSeededRandom(mixSeed(seed, 1)));
    for (let round = 2; round <= 12; round += 1) ais = ais.map((ai, index) => planAI(ai, round, createSeededRandom(mixSeed(seed, round, index))));
    for (const ai of ais) {
      const current = totals.get(ai.personality) ?? { gold: 0, rerolls: 0, training: 0, synergy: 0 };
      const snapshot = aiStrategySnapshot(ai);
      current.gold += snapshot.gold; current.rerolls += snapshot.rerolls; current.training += snapshot.trainingBuys; current.synergy += snapshot.synergyScore;
      totals.set(ai.personality, current);
      assert.equal(assertAILegal(ai), true);
    }
  }
  assert.ok(totals.get("Economist")!.gold > totals.get("Tempo")!.gold, "Economist should retain more gold than Tempo");
  assert.ok(totals.get("Collector")!.rerolls > totals.get("Economist")!.rerolls, "Collector should reroll more than Economist");
  assert.ok(totals.get("Tempo")!.training > totals.get("Collector")!.training, "Tempo should buy more training than Collector");
  assert.ok(new Set([...totals.values()].map((value) => `${value.gold}:${value.rerolls}:${value.training}:${value.synergy}`)).size >= 5);
});

test("difficulty changes evaluation while preserving identical resources and rules", () => {
  const signatures = new Set<string>();
  for (const difficulty of ["Easy", "Normal", "Hard"] as const) {
    let ai = createAICommanders(difficulty, createSeededRandom(444))[2];
    for (let round = 2; round <= 10; round += 1) ai = planAI(ai, round, createSeededRandom(mixSeed(444, round)));
    assert.equal(assertAILegal(ai), true);
    signatures.add(JSON.stringify(aiStrategySnapshot(ai)));
  }
  assert.ok(signatures.size >= 2, "difficulty should affect candidate evaluation or positioning");
});

test("AI begins receiving legal neutral-reward equipment after round 5", () => {
  const base = createAICommanders("Hard", createSeededRandom(1501));
  const beforeReward = advanceAICommanders(structuredClone(base), 5, createSeededRandom(1502));
  const afterReward = advanceAICommanders(structuredClone(base), 6, createSeededRandom(1502));
  const itemCount = (ais: typeof base) => ais.reduce((sum, ai) => sum + ai.units.reduce((unitSum, unit) => unitSum + unit.itemIds.length, 0), 0);
  assert.equal(itemCount(beforeReward), 0);
  assert.ok(itemCount(afterReward) > 0, "surviving AI should equip neutral-cycle rewards after round 5");
  for (const ai of afterReward) {
    assert.equal(assertAILegal(ai), true);
    assert.ok(ai.units.every((unit) => unit.itemIds.length <= 2));
  }
});

test("Hard AI converts the same legal economy into stronger active-synergy planning", () => {
  const totalSynergy = (difficulty: "Normal" | "Hard") => {
    let total = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      let ais = createAICommanders(difficulty, createSeededRandom(mixSeed(seed, 101)));
      for (let round = 2; round <= 14; round += 1) {
        ais = ais.map((ai, index) => planAI(ai, round, createSeededRandom(mixSeed(seed, round, index, 202))));
        for (const ai of ais) assert.equal(assertAILegal(ai), true);
      }
      total += ais.reduce((sum, ai) => sum + ai.behavior.synergyScore, 0);
    }
    return total;
  };

  const normal = totalSynergy("Normal");
  const hard = totalSynergy("Hard");
  assert.ok(hard > normal * 1.05, `Hard synergy planning should materially outperform Normal (${hard} vs ${normal})`);
});
