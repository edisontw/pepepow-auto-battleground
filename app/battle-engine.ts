import { ITEMS, Trait, TRAIT_DETAILS, UNIT_MAP } from "./game-data";

export const REPLAY_FORMAT = "pepepow.auto-battleground.replay" as const;
export const REPLAY_VERSION = 3 as const;
export const ENGINE_VERSION = "combat-evolution-0.3.0";

export type OwnedUnit = {
  uid: string;
  unitId: string;
  star: 1 | 2 | 3;
  position: number | null;
  itemIds: string[];
};

export type CombatAction = "idle" | "move" | "attack" | "cast" | "hit" | "death";
export type CombatUnit = {
  uid: string;
  unitId: string;
  team: "player" | "enemy";
  star: 1 | 2 | 3;
  position: number;
  spawnPosition: number;
  previousPosition: number | null;
  hp: number;
  maxHp: number;
  mana: number;
  attack: number;
  armor: number;
  range: number;
  itemIds: string[];
  dead: boolean;
  action: CombatAction;
  shield: number;
  stunned: number;
  targetUid: string | null;
  forcedTargetUid: string | null;
  forcedTargetTicks: number;
};

export type BattleEventType = "move" | "attack" | "cast" | "projectile" | "damage" | "critical" | "heal" | "shield" | "stun" | "death";
export type BattleEvent = {
  id: string;
  tick: number;
  type: BattleEventType;
  sourceUid: string;
  targetUid?: string;
  from?: number;
  to?: number;
  amount?: number;
  skillId?: string;
};

export type BattleFrame = { tick: number; units: CombatUnit[]; message: string; events: BattleEvent[] };
export type UnitBattleStats = {
  uid: string;
  unitId: string;
  team: "player" | "enemy";
  star: 1 | 2 | 3;
  damageDealt: number;
  damageTaken: number;
  healing: number;
  shielding: number;
  kills: number;
  casts: number;
  criticals: number;
  survived: boolean;
};
export type BattleResult = {
  format: typeof REPLAY_FORMAT;
  version: typeof REPLAY_VERSION;
  engineVersion: string;
  seed: number;
  winner: "player" | "enemy" | "draw";
  frames: BattleFrame[];
  survivors: number;
  durationTicks: number;
  stats: UnitBattleStats[];
};

export type SeededRandom = { next: () => number; int: (max: number) => number };

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (max: number) => Math.floor(next() * Math.max(1, max)) };
}

export function mixSeed(...values: number[]) {
  let hash = 2166136261 >>> 0;
  for (const value of values) {
    hash ^= value >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 1;
}

const COLS = 8;
const ROWS = 6;
export const gridDistance = (a: number, b: number) => Math.abs((a % COLS) - (b % COLS)) + Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS));
const cloneUnits = (units: CombatUnit[]) => units.map((unit) => ({ ...unit, itemIds: [...unit.itemIds] }));
const compareUid = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function traitCounts(units: OwnedUnit[]) {
  const counts = {} as Record<Trait, number>;
  const uniqueUnits = [...new Map(units.map((unit) => [unit.unitId, unit])).values()];
  for (const unit of uniqueUnits) for (const trait of UNIT_MAP[unit.unitId].traits) counts[trait] = (counts[trait] ?? 0) + 1;
  return counts;
}

function tier(counts: Record<Trait, number>, trait: Trait) {
  const count = counts[trait] ?? 0;
  const [first, second] = TRAIT_DETAILS[trait].thresholds;
  return count >= second ? 2 : count >= first ? 1 : 0;
}

function makeCombatUnit(unit: OwnedUnit, team: "player" | "enemy", counts: Record<Trait, number>): CombatUnit {
  const def = UNIT_MAP[unit.unitId];
  const starScale = unit.star === 1 ? 1 : unit.star === 2 ? 1.75 : 3.05;
  const itemStats = unit.itemIds.map((id) => ITEMS.find((item) => item.id === id)).filter(Boolean);
  let hp = def.hp * starScale + itemStats.reduce((sum, item) => sum + (item?.hp ?? 0), 0);
  let attack = def.attack * starScale * (1 + itemStats.reduce((sum, item) => sum + (item?.attack ?? 0), 0));
  let armor = def.armor + itemStats.reduce((sum, item) => sum + (item?.armor ?? 0), 0);
  let mana = itemStats.reduce((sum, item) => sum + (item?.mana ?? 0), 0);
  const role = def.traits[1];
  const crystal = tier(counts, "Crystal");
  const machine = tier(counts, "Machine");
  const wild = tier(counts, "Wild");
  if (crystal) armor += crystal === 2 ? 26 : 12;
  if (machine) attack *= machine === 2 ? 1.25 : 1.1;
  if (wild) hp *= wild === 2 ? 1.28 : 1.12;
  if (role === "Guardian" && tier(counts, "Guardian")) armor += tier(counts, "Guardian") === 2 ? 34 : 18;
  if (role === "Ranger" && tier(counts, "Ranger")) attack *= tier(counts, "Ranger") === 2 ? 1.3 : 1.15;
  if (role === "Engineer" && tier(counts, "Engineer")) mana += tier(counts, "Engineer") === 2 ? 55 : 30;
  if (role === "Brawler" && tier(counts, "Brawler")) hp *= tier(counts, "Brawler") === 2 ? 1.35 : 1.18;
  const maxHp = Math.round(hp);
  const position = unit.position ?? 0;
  return { uid: unit.uid, unitId: unit.unitId, team, star: unit.star, position, spawnPosition: position, previousPosition: null, hp: maxHp, maxHp, mana, attack: Math.round(attack), armor: Math.round(armor), range: def.range, itemIds: [...unit.itemIds], dead: false, action: "idle", shield: 0, stunned: 0, targetUid: null, forcedTargetUid: null, forcedTargetTicks: 0 };
}

export function buildCombatSnapshot(army: OwnedUnit[], team: "player" | "enemy") {
  const counts = traitCounts(army);
  return army.map((unit) => makeCombatUnit(unit, team, counts));
}

function neighbors(position: number) {
  const x = position % COLS;
  const result: number[] = [];
  if (x > 0) result.push(position - 1);
  if (x < COLS - 1) result.push(position + 1);
  if (position >= COLS) result.push(position - COLS);
  if (position < COLS * (ROWS - 1)) result.push(position + COLS);
  return result;
}

export function findPathStep(from: number, target: number, range: number, occupied: Set<number>, avoidFirst: number | null = null) {
  if (gridDistance(from, target) <= range) return from;
  const blocked = new Set(occupied);
  blocked.delete(from);
  const search = (avoid: number | null) => {
    const queue: Array<{ position: number; first: number }> = [{ position: from, first: from }];
    const visited = new Set([from]);
    while (queue.length) {
      const current = queue.shift()!;
      const ordered = neighbors(current.position).sort((a, b) => gridDistance(a, target) - gridDistance(b, target) || a - b);
      for (const position of ordered) {
        if (visited.has(position) || blocked.has(position) || (current.position === from && position === avoid)) continue;
        const first = current.position === from ? position : current.first;
        if (gridDistance(position, target) <= range) return first;
        visited.add(position);
        queue.push({ position, first });
      }
    }
    return null;
  };
  return search(avoidFirst) ?? search(null);
}

function canReach(attacker: CombatUnit, target: CombatUnit, units: CombatUnit[]) {
  if (gridDistance(attacker.position, target.position) <= attacker.range) return true;
  return findPathStep(attacker.position, target.position, attacker.range, new Set(units.filter((unit) => !unit.dead).map((unit) => unit.position))) !== null;
}

export function chooseCombatTarget(attacker: CombatUnit, enemies: CombatUnit[], units: CombatUnit[]) {
  const forced = attacker.forcedTargetUid ? enemies.find((enemy) => enemy.uid === attacker.forcedTargetUid) : undefined;
  if (forced && canReach(attacker, forced, units)) return forced;

  const sticky = attacker.targetUid ? enemies.find((enemy) => enemy.uid === attacker.targetUid) : undefined;
  if (sticky && canReach(attacker, sticky, units)) return sticky;

  const reachable = enemies.filter((enemy) => canReach(attacker, enemy, units));
  if (!reachable.length) return null;
  const inRange = reachable.filter((enemy) => gridDistance(attacker.position, enemy.position) <= attacker.range);
  const candidates = attacker.range > 1 && inRange.length ? inRange : reachable;
  const role = UNIT_MAP[attacker.unitId].traits[1];
  const firstAssassinTarget = role === "Assassin" && !sticky;
  return [...candidates].sort((a, b) => {
    const backlineDelta = firstAssassinTarget
      ? attacker.team === "player"
        ? Math.floor(a.spawnPosition / COLS) - Math.floor(b.spawnPosition / COLS)
        : Math.floor(b.spawnPosition / COLS) - Math.floor(a.spawnPosition / COLS)
      : 0;
    const distanceDelta = gridDistance(attacker.position, a.position) - gridDistance(attacker.position, b.position);
    return backlineDelta || distanceDelta || a.hp - b.hp || compareUid(a.uid, b.uid);
  })[0] ?? null;
}

function damageAmount(attacker: CombatUnit, target: CombatUnit, armorReduction: number, crit: boolean, random: SeededRandom) {
  const armor = Math.max(0, target.armor - armorReduction);
  const mitigated = attacker.attack * (100 / (100 + armor));
  return Math.max(1, Math.round(mitigated * (crit ? 1.75 : 1) * (0.9 + random.next() * 0.2)));
}

function event(tick: number, type: BattleEventType, sourceUid: string, suffix: string, rest: Omit<BattleEvent, "id" | "tick" | "type" | "sourceUid"> = {}): BattleEvent {
  return { id: `${tick}-${sourceUid}-${type}-${suffix}`, tick, type, sourceUid, ...rest };
}

export function simulateBattle(playerArmy: OwnedUnit[], enemyArmy: OwnedUnit[], seed = 1): BattleResult {
  const random = createSeededRandom(seed);
  const playerCounts = traitCounts(playerArmy), enemyCounts = traitCounts(enemyArmy);
  const units = [...buildCombatSnapshot(playerArmy, "player"), ...buildCombatSnapshot(enemyArmy, "enemy")];
  const stats = new Map<string, UnitBattleStats>(units.map((unit) => [unit.uid, { uid: unit.uid, unitId: unit.unitId, team: unit.team, star: unit.star, damageDealt: 0, damageTaken: 0, healing: 0, shielding: 0, kills: 0, casts: 0, criticals: 0, survived: true }]));
  const frames: BattleFrame[] = [{ tick: 0, units: cloneUnits(units), message: "Armies enter the grid.", events: [] }];

  const playerAtStart = units.some((unit) => unit.team === "player"), enemyAtStart = units.some((unit) => unit.team === "enemy");
  if (!playerAtStart || !enemyAtStart) {
    const winner = playerAtStart ? "player" : enemyAtStart ? "enemy" : "draw";
    return { format: REPLAY_FORMAT, version: REPLAY_VERSION, engineVersion: ENGINE_VERSION, seed, winner, frames, survivors: units.filter((unit) => unit.team === winner).length, durationTicks: 0, stats: [...stats.values()] };
  }

  const applyDamage = (tick: number, attacker: CombatUnit, target: CombatUnit, rawDamage: number, events: BattleEvent[], critical = false, skillId?: string) => {
    const absorbed = Math.min(target.shield, rawDamage);
    if (absorbed) target.shield -= absorbed;
    const damage = Math.max(0, rawDamage - absorbed);
    target.hp = Math.max(0, target.hp - damage);
    target.action = "hit";
    stats.get(attacker.uid)!.damageDealt += damage;
    stats.get(target.uid)!.damageTaken += damage;
    events.push(event(tick, critical ? "critical" : "damage", attacker.uid, `${target.uid}-${events.length}`, { targetUid: target.uid, to: target.position, amount: damage, skillId }));
    if (target.hp <= 0 && !target.dead) {
      target.dead = true; target.action = "death";
      stats.get(attacker.uid)!.kills += 1; stats.get(target.uid)!.survived = false;
      for (const unit of units) {
        if (unit.targetUid === target.uid) unit.targetUid = null;
        if (unit.forcedTargetUid === target.uid) { unit.forcedTargetUid = null; unit.forcedTargetTicks = 0; }
      }
      events.push(event(tick, "death", attacker.uid, target.uid, { targetUid: target.uid, to: target.position, skillId }));
    }
    return damage;
  };

  for (let tick = 1; tick <= 70; tick += 1) {
    for (const unit of units) {
      if (!unit.dead) unit.action = "idle";
    }
    const living = units.filter((unit) => !unit.dead).sort((a, b) => (b.mana + b.attack) - (a.mana + a.attack) || compareUid(a.uid, b.uid));
    let message = "Both formations advance.";
    const events: BattleEvent[] = [];

    for (const attacker of living) {
      if (attacker.dead) continue;
      if (attacker.stunned > 0) { attacker.stunned -= 1; message = `${UNIT_MAP[attacker.unitId].name} is stunned.`; continue; }
      const consumeForcedTarget = () => {
        if (attacker.forcedTargetTicks > 0) attacker.forcedTargetTicks -= 1;
        if (attacker.forcedTargetTicks <= 0) { attacker.forcedTargetUid = null; attacker.forcedTargetTicks = 0; }
      };
      const enemies = units.filter((unit) => !unit.dead && unit.team !== attacker.team);
      if (!enemies.length) break;
      const def = UNIT_MAP[attacker.unitId], ownCounts = attacker.team === "player" ? playerCounts : enemyCounts;
      const target = chooseCombatTarget(attacker, enemies, units);
      if (!target) { attacker.targetUid = null; consumeForcedTarget(); continue; }
      attacker.targetUid = target.uid;

      if (gridDistance(attacker.position, target.position) > attacker.range) {
        const from = attacker.position;
        const step = findPathStep(attacker.position, target.position, attacker.range, new Set(units.filter((unit) => !unit.dead).map((unit) => unit.position)), attacker.previousPosition);
        if (step === null || step === from) { attacker.targetUid = null; consumeForcedTarget(); continue; }
        attacker.previousPosition = from;
        attacker.position = step;
        attacker.action = "move";
        events.push(event(tick, "move", attacker.uid, String(events.length), { from, to: attacker.position }));
        consumeForcedTarget();
        continue;
      }

      const role = def.traits[1], ready = attacker.mana >= 100;
      if (ready) {
        attacker.mana = 0; attacker.action = "cast"; stats.get(attacker.uid)!.casts += 1;
        events.push(event(tick, "cast", attacker.uid, String(events.length), { from: attacker.position, to: target.position, targetUid: target.uid, skillId: def.id }));
        if (["tunnel-guard", "iron-bulwark", "quartz-knight"].includes(def.id)) {
          const amount = Math.round(attacker.maxHp * (def.id === "iron-bulwark" ? 0.34 : 0.24));
          attacker.shield += amount; stats.get(attacker.uid)!.shielding += amount;
          events.push(event(tick, "shield", attacker.uid, String(events.length), { targetUid: attacker.uid, to: attacker.position, amount, skillId: def.id }));
          if (role === "Guardian") for (const enemy of enemies.filter((entry) => gridDistance(entry.position, attacker.position) <= 2)) { enemy.forcedTargetUid = attacker.uid; enemy.forcedTargetTicks = 2; }
        } else if (role === "Support" || role === "Engineer") {
          const allies = units.filter((unit) => !unit.dead && unit.team === attacker.team).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
          const healBoost = tier(ownCounts, "Support") === 2 ? 1.7 : tier(ownCounts, "Support") === 1 ? 1.35 : 1;
          const global = def.id === "wild-seer";
          const chosen = global ? allies : allies.slice(0, role === "Support" ? 2 : 1);
          for (const ally of chosen) {
            const requested = Math.round(attacker.attack * (role === "Support" ? 2.1 : 1.4) * healBoost);
            const healed = Math.min(requested, ally.maxHp - ally.hp);
            ally.hp += healed; ally.action = "hit"; stats.get(attacker.uid)!.healing += healed;
            events.push(event(tick, "heal", attacker.uid, `${ally.uid}-${events.length}`, { targetUid: ally.uid, to: ally.position, amount: healed, skillId: def.id }));
          }
        } else {
          const isGlobal = def.id === "aurora-titan" || def.id === "null-sovereign";
          const isArea = role === "Hacker" || role === "Brawler" || def.id === "volt-hacker";
          const targets = isGlobal ? enemies : isArea ? enemies.filter((enemy) => gridDistance(enemy.position, target.position) <= 1) : [target];
          for (const victim of targets.length ? targets : [target]) {
            events.push(event(tick, "projectile", attacker.uid, `${victim.uid}-${events.length}`, { targetUid: victim.uid, from: attacker.position, to: victim.position, skillId: def.id }));
            const skillDamage = Math.round(damageAmount(attacker, victim, tier(ownCounts, "Void") ? 18 : 0, false, random) * (role === "Assassin" ? 2.25 : isGlobal ? 1.25 : 1.65));
            applyDamage(tick, attacker, victim, skillDamage, events, false, def.id);
            if (["deep-warden", "storm-hacker", "null-sovereign"].includes(def.id) && !victim.dead) {
              victim.stunned = Math.max(victim.stunned, def.id === "null-sovereign" ? 3 : 2);
              events.push(event(tick, "stun", attacker.uid, `${victim.uid}-${events.length}`, { targetUid: victim.uid, to: victim.position, skillId: def.id }));
            }
          }
        }
        message = `${def.name} unleashes ${def.skill}!`;
      } else {
        attacker.action = "attack";
        const assassinCrit = role === "Assassin" && tier(ownCounts, "Assassin") > 0 && random.next() < (tier(ownCounts, "Assassin") === 2 ? 0.42 : 0.25);
        if (assassinCrit) stats.get(attacker.uid)!.criticals += 1;
        events.push(event(tick, "attack", attacker.uid, String(events.length), { targetUid: target.uid, from: attacker.position, to: target.position }));
        if (attacker.range > 1) events.push(event(tick, "projectile", attacker.uid, String(events.length), { targetUid: target.uid, from: attacker.position, to: target.position }));
        const damage = damageAmount(attacker, target, tier(ownCounts, "Void") ? (tier(ownCounts, "Void") === 2 ? 30 : 15) : 0, assassinCrit, random);
        const dealt = applyDamage(tick, attacker, target, damage, events, assassinCrit);
        const cyberTier = tier(ownCounts, "Cyber");
        attacker.mana = Math.min(100, attacker.mana + (cyberTier === 2 ? 42 : cyberTier === 1 ? 32 : 24));
        target.mana = Math.min(100, target.mana + 12);
        if (tier(ownCounts, "Underground")) {
          const healed = Math.min(attacker.maxHp - attacker.hp, dealt * (tier(ownCounts, "Underground") === 2 ? 0.18 : 0.08));
          attacker.hp += healed; stats.get(attacker.uid)!.healing += healed;
          if (healed >= 1) events.push(event(tick, "heal", attacker.uid, String(events.length), { targetUid: attacker.uid, to: attacker.position, amount: Math.round(healed) }));
        }
        if (role === "Hacker" && tier(ownCounts, "Hacker")) {
          const splash = enemies.find((enemy) => enemy.uid !== target.uid && gridDistance(enemy.position, target.position) <= 1);
          if (splash) applyDamage(tick, attacker, splash, Math.round(dealt * (tier(ownCounts, "Hacker") === 2 ? 0.6 : 0.35)), events);
        }
        message = target.dead ? `${def.name}${assassinCrit ? " critically" : ""} eliminates ${UNIT_MAP[target.unitId].name}.` : `${def.name} attacks ${UNIT_MAP[target.unitId].name}.`;
      }
      consumeForcedTarget();
    }

    frames.push({ tick, units: cloneUnits(units), message, events });
    const playerAlive = units.some((unit) => !unit.dead && unit.team === "player"), enemyAlive = units.some((unit) => !unit.dead && unit.team === "enemy");
    if (!playerAlive || !enemyAlive) {
      const winner = playerAlive ? "player" : enemyAlive ? "enemy" : "draw";
      const survivors = units.filter((unit) => !unit.dead && unit.team === winner).length;
      return { format: REPLAY_FORMAT, version: REPLAY_VERSION, engineVersion: ENGINE_VERSION, seed, winner, frames, survivors, durationTicks: tick, stats: [...stats.values()] };
    }
  }

  const playerMax = units.filter((unit) => unit.team === "player").reduce((sum, unit) => sum + unit.maxHp, 0);
  const enemyMax = units.filter((unit) => unit.team === "enemy").reduce((sum, unit) => sum + unit.maxHp, 0);
  const playerHp = units.filter((unit) => !unit.dead && unit.team === "player").reduce((sum, unit) => sum + unit.hp, 0) / Math.max(1, playerMax);
  const enemyHp = units.filter((unit) => !unit.dead && unit.team === "enemy").reduce((sum, unit) => sum + unit.hp, 0) / Math.max(1, enemyMax);
  const winner = Math.abs(playerHp - enemyHp) < 0.001 ? "draw" : playerHp > enemyHp ? "player" : "enemy";
  return { format: REPLAY_FORMAT, version: REPLAY_VERSION, engineVersion: ENGINE_VERSION, seed, winner, frames, survivors: units.filter((unit) => !unit.dead && unit.team === winner).length, durationTicks: 70, stats: [...stats.values()] };
}

export const BOARD_COLS = COLS;
export const BOARD_ROWS = ROWS;
