import assert from "node:assert/strict";
import test from "node:test";
import { buildCombatSnapshot, chooseCombatTarget, CombatUnit, findPathStep, OwnedUnit, simulateBattle } from "../app/battle-engine";

function combat(uid: string, unitId: string, team: "player" | "enemy", position: number, hp = 500): CombatUnit {
  return { uid, unitId, team, star: 1, position, spawnPosition: position, previousPosition: null, hp, maxHp: hp, mana: 0, attack: 50, armor: 10, range: unitId === "pickaxe-scout" ? 3 : 1, skillPower: 1, itemIds: [], dead: false, action: "idle", shield: 0, stunned: 0, targetUid: null, forcedTargetUid: null, forcedTargetTicks: 0 };
}

test("normal targeting chooses nearest reachable and only uses HP as a tie break", () => {
  const attacker = combat("p", "tunnel-guard", "player", 40);
  const close = combat("e-close", "tunnel-guard", "enemy", 32, 500);
  const lowFar = combat("e-far", "tunnel-guard", "enemy", 16, 1);
  assert.equal(chooseCombatTarget(attacker, [lowFar, close], [attacker, close, lowFar])?.uid, close.uid);
});

test("assassin first acquisition prioritizes enemy backline and remains sticky", () => {
  const assassin = combat("p", "cave-stalker", "player", 40);
  const front = combat("e-front", "tunnel-guard", "enemy", 18);
  const back = combat("e-back", "pickaxe-scout", "enemy", 2);
  assert.equal(chooseCombatTarget(assassin, [front, back], [assassin, front, back])?.uid, back.uid);
  assassin.targetUid = back.uid;
  back.position = 10;
  assert.equal(chooseCombatTarget(assassin, [front, back], [assassin, front, back])?.uid, back.uid);
});

test("assassin opening target prefers a Ranger within the same enemy backline", () => {
  const assassin = combat("p", "cave-stalker", "player", 40);
  const support = combat("e-support", "glow-medic", "enemy", 0, 1);
  const ranger = combat("e-ranger", "pickaxe-scout", "enemy", 7, 500);
  assert.equal(chooseCombatTarget(assassin, [support, ranger], [assassin, support, ranger])?.uid, ranger.uid);
});

test("forced target overrides an existing sticky target", () => {
  const attacker = combat("p", "pickaxe-scout", "player", 40);
  const sticky = combat("e-sticky", "tunnel-guard", "enemy", 32);
  const taunter = combat("e-taunt", "iron-bulwark", "enemy", 33);
  attacker.targetUid = sticky.uid;
  attacker.forcedTargetUid = taunter.uid;
  attacker.forcedTargetTicks = 2;
  assert.equal(chooseCombatTarget(attacker, [sticky, taunter], [attacker, sticky, taunter])?.uid, taunter.uid);
});

test("BFS detours around occupied direct cells and never returns a fake move", () => {
  const occupied = new Set([40, 32, 39, 8]);
  const step = findPathStep(40, 8, 1, occupied);
  assert.notEqual(step, null);
  assert.notEqual(step, 40);
  assert.equal(step, 41);
});

test("four Arcanists receive tier-two starting mana and skill power", () => {
  const army: OwnedUnit[] = [
    { uid: "a", unitId: "glow-medic", star: 1, position: 40, itemIds: [] },
    { uid: "b", unitId: "volt-hacker", star: 1, position: 41, itemIds: [] },
    { uid: "c", unitId: "circuit-sage", star: 1, position: 42, itemIds: [] },
    { uid: "d", unitId: "wild-seer", star: 1, position: 43, itemIds: [] },
  ];
  const snapshot = buildCombatSnapshot(army, "player");
  for (const unit of snapshot) {
    assert.equal(unit.mana, 45);
    assert.equal(unit.skillPower, 1.3);
  }
});

test("three Wild units can now activate the reachable tier-two health bonus", () => {
  const army: OwnedUnit[] = [
    { uid: "a", unitId: "wild-burrower", star: 1, position: 40, itemIds: [] },
    { uid: "b", unitId: "moss-brute", star: 1, position: 41, itemIds: [] },
    { uid: "c", unitId: "wild-seer", star: 1, position: 42, itemIds: [] },
  ];
  const seer = buildCombatSnapshot(army, "player").find((unit) => unit.unitId === "wild-seer");
  assert.equal(seer?.maxHp, Math.round(720 * 1.32));
});

test("identical inputs and seed reproduce the complete battle result", () => {
  const player: OwnedUnit[] = [{ uid: "p1", unitId: "tunnel-guard", star: 1, position: 40, itemIds: [] }, { uid: "p2", unitId: "pickaxe-scout", star: 1, position: 45, itemIds: [] }];
  const enemy: OwnedUnit[] = [{ uid: "e1", unitId: "moss-brute", star: 1, position: 8, itemIds: [] }, { uid: "e2", unitId: "data-slinger", star: 1, position: 5, itemIds: [] }];
  assert.deepEqual(simulateBattle(player, enemy, 123456), simulateBattle(player, enemy, 123456));
});

test("empty-side battles resolve at tick zero", () => {
  const player: OwnedUnit[] = [{ uid: "p1", unitId: "tunnel-guard", star: 1, position: 40, itemIds: [] }];
  assert.equal(simulateBattle(player, [], 1).winner, "player");
  assert.equal(simulateBattle(player, [], 1).durationTicks, 0);
  assert.equal(simulateBattle([], [], 1).winner, "draw");
});