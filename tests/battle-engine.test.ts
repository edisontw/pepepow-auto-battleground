import assert from "node:assert/strict";
import test from "node:test";
import { buildCombatSnapshot, chooseCombatTarget, CombatUnit, ENGINE_VERSION, findPathStep, OwnedUnit, simulateBattle } from "../app/battle-engine";
import { UNIT_MAP } from "../app/game-data";

function combat(uid: string, unitId: string, team: "player" | "enemy", position: number, hp = 500): CombatUnit {
  return { uid, unitId, team, star: 1, position, spawnPosition: position, previousPosition: null, hp, maxHp: hp, mana: 0, attack: 50, armor: 10, range: unitId === "pickaxe-scout" ? 3 : 1, skillPower: 1, itemIds: [], dead: false, action: "idle", shield: 0, stunned: 0, targetUid: null, forcedTargetUid: null, forcedTargetTicks: 0, healingReductionTicks: 0, feedbackTicks: 0, feedbackRate: 0, feedbackSourceUid: null };
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

test("v0.9 keeps the original Arcanist identities while extending counterplay", () => {
  assert.equal(ENGINE_VERSION, "combat-balance-0.9.0");
  for (const id of ["arcane-apprentice", "rune-blaster", "chrono-mage"]) {
    assert.equal(UNIT_MAP[id].traits.includes("Arcanist"), true);
    assert.equal(UNIT_MAP[id].traits.includes("Ranger"), false);
    assert.equal(UNIT_MAP[id].traits.includes("Void"), false);
  }
});

test("new counter units emit deterministic control events for their authored mechanics", () => {
  const player: OwnedUnit[] = [
    { uid: "mire", unitId: "mire-chemist", star: 2, position: 40, itemIds: ["data-cell", "data-cell"] },
    { uid: "spark", unitId: "spark-mechanic", star: 2, position: 41, itemIds: [] },
    { uid: "gear", unitId: "gear-smith", star: 2, position: 42, itemIds: [] },
    { uid: "leech", unitId: "signal-leech", star: 2, position: 43, itemIds: [] },
    { uid: "coil", unitId: "coil-ranger", star: 2, position: 47, itemIds: [] },
  ];
  const enemy: OwnedUnit[] = [
    { uid: "guard", unitId: "iron-bulwark", star: 3, position: 8, itemIds: ["aegis-node", "data-cell"] },
    { uid: "ranger", unitId: "prism-gunner", star: 3, position: 0, itemIds: ["aegis-node", "data-cell"] },
  ];
  const result = simulateBattle(player, enemy, 991);
  const events = result.frames.flatMap((frame) => frame.events);
  assert.equal(events.some((entry) => entry.type === "control" && entry.skillId === "mire-chemist"), true);
  assert.equal(events.some((entry) => entry.type === "control" && entry.skillId === "signal-leech"), true);
  assert.equal(events.some((entry) => entry.type === "control" && entry.skillId === "coil-ranger"), true);
});

test("Arcane Apprentice Mana Ward refunds Arcanist-scaled mana after casting", () => {
  const player: OwnedUnit[] = [
    { uid: "apprentice", unitId: "arcane-apprentice", star: 1, position: 40, itemIds: ["data-cell", "data-cell"] },
    { uid: "volt", unitId: "volt-hacker", star: 1, position: 41, itemIds: [] },
    { uid: "rune", unitId: "rune-blaster", star: 1, position: 42, itemIds: [] },
    { uid: "chrono", unitId: "chrono-mage", star: 1, position: 43, itemIds: [] },
  ];
  const enemy: OwnedUnit[] = [{ uid: "enemy", unitId: "tunnel-guard", star: 1, position: 24, itemIds: [] }];
  const result = simulateBattle(player, enemy, 11);
  const apprentice = result.frames[1].units.find((unit) => unit.uid === "apprentice");
  assert.equal(apprentice?.mana, 26);
});

test("Rune Blaster Rune Nova reaches enemies two cells from the locked target", () => {
  const player: OwnedUnit[] = [
    { uid: "rune", unitId: "rune-blaster", star: 1, position: 40, itemIds: ["data-cell", "data-cell"] },
    { uid: "volt", unitId: "volt-hacker", star: 1, position: 41, itemIds: [] },
    { uid: "storm", unitId: "storm-hacker", star: 1, position: 42, itemIds: [] },
    { uid: "chrono", unitId: "chrono-mage", star: 1, position: 43, itemIds: [] },
  ];
  const enemy: OwnedUnit[] = [
    { uid: "primary", unitId: "tunnel-guard", star: 1, position: 24, itemIds: [] },
    { uid: "secondary", unitId: "iron-bulwark", star: 1, position: 26, itemIds: [] },
  ];
  const firstTick = simulateBattle(player, enemy, 12).frames[1];
  assert.equal(firstTick.events.some((entry) => entry.skillId === "rune-blaster" && entry.targetUid === "secondary" && entry.type === "damage"), true);
});

test("Chrono Mage Time Lock applies a one-tick stun to surviving targets", () => {
  const player: OwnedUnit[] = [
    { uid: "chrono", unitId: "chrono-mage", star: 1, position: 40, itemIds: ["data-cell", "data-cell"] },
    { uid: "volt", unitId: "volt-hacker", star: 1, position: 41, itemIds: [] },
    { uid: "storm", unitId: "storm-hacker", star: 1, position: 42, itemIds: [] },
    { uid: "rune", unitId: "rune-blaster", star: 1, position: 43, itemIds: [] },
  ];
  const enemy: OwnedUnit[] = [
    { uid: "primary", unitId: "tunnel-guard", star: 1, position: 24, itemIds: [] },
    { uid: "secondary", unitId: "iron-bulwark", star: 1, position: 25, itemIds: [] },
  ];
  const firstTick = simulateBattle(player, enemy, 13).frames[1];
  assert.equal(firstTick.events.some((entry) => entry.skillId === "chrono-mage" && entry.type === "stun"), true);
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
