import { OwnedUnit, SeededRandom } from "./battle-engine";
import { AI_PROFILES, ITEMS, Trait, TRAIT_DETAILS, UNIT_MAP, UNITS, XP_TO_LEVEL } from "./game-data";
import { applyXp, effectiveShopOdds, GAME_RULES, incomeFor, passiveXpForRound } from "./game-rules";

export type AIPersonality = "Balanced" | "Tempo" | "Economist" | "Collector" | "Synergy Hunter" | "Adaptive";
export type AIDifficulty = "Easy" | "Normal" | "Hard";

export type AIBehavior = {
  bought: number;
  rerolls: number;
  trainingBuys: number;
  interestProtected: number;
  synergyScore: number;
  formationChanges: number;
};

export type AICommander = typeof AI_PROFILES[number] & {
  health: number;
  level: number;
  xp: number;
  gold: number;
  alive: boolean;
  streak: number;
  personality: AIPersonality;
  difficulty: AIDifficulty;
  units: OwnedUnit[];
  shop: string[];
  behavior: AIBehavior;
};

const PERSONALITIES: AIPersonality[] = ["Economist", "Tempo", "Balanced", "Economist", "Collector", "Adaptive", "Synergy Hunter"];
const frontClasses = new Set<Trait>(["Guardian", "Brawler"]);
const backClasses = new Set<Trait>(["Ranger", "Support", "Engineer", "Hacker"]);
const damageClasses = new Set<Trait>(["Ranger", "Assassin", "Hacker", "Brawler"]);
const preferredRoles: Partial<Record<Trait, Trait[]>> = {
  Machine: ["Engineer", "Guardian"],
  Wild: ["Brawler", "Support"],
  Cyber: ["Hacker", "Support"],
  Underground: ["Assassin", "Guardian"],
  Crystal: ["Ranger", "Guardian"],
  Void: ["Assassin", "Hacker"],
  Guardian: ["Guardian", "Support"],
  Arcanist: ["Hacker", "Support"],
  Assassin: ["Assassin", "Guardian"],
  Support: ["Support", "Guardian"],
};

type Weights = {
  power: number;
  upgrade: number;
  synergy: number;
  focus: number;
  economyFloor: number;
  rerollBudget: number;
  levelBias: number;
  noise: number;
  candidates: number;
};

const personalityWeights: Record<AIPersonality, Omit<Weights, "noise" | "candidates">> = {
  Balanced: { power: 1, upgrade: 2.4, synergy: 2, focus: 1.2, economyFloor: 20, rerollBudget: 1, levelBias: 1 },
  Tempo: { power: 1.55, upgrade: 2.1, synergy: 1.25, focus: .7, economyFloor: 0, rerollBudget: 2, levelBias: 1.8 },
  Economist: { power: .72, upgrade: 2.7, synergy: 1.5, focus: 1, economyFloor: 50, rerollBudget: 0, levelBias: .55 },
  Collector: { power: .85, upgrade: 4.2, synergy: 1.2, focus: 1.5, economyFloor: 20, rerollBudget: 4, levelBias: .35 },
  "Synergy Hunter": { power: .8, upgrade: 2, synergy: 4.1, focus: 2.2, economyFloor: 20, rerollBudget: 2, levelBias: .75 },
  Adaptive: { power: 1.1, upgrade: 2.5, synergy: 2.3, focus: 1.2, economyFloor: 30, rerollBudget: 2, levelBias: 1.05 },
};

const difficultyQuality: Record<AIDifficulty, Pick<Weights, "noise" | "candidates">> = {
  Easy: { noise: 4.5, candidates: 3 },
  Normal: { noise: 1.5, candidates: 5 },
  Hard: { noise: .08, candidates: 5 },
};

function starCopies(star: 1 | 2 | 3) { return star === 1 ? 1 : star === 2 ? 3 : 9; }
export function ownedBaseCopies(units: OwnedUnit[], unitId: string) {
  return units.filter((unit) => unit.unitId === unitId).reduce((sum, unit) => sum + starCopies(unit.star), 0);
}

function aiUid(random: SeededRandom) { return `ai-${random.int(0x7fffffff).toString(36)}`; }

function combineAIUnits(input: OwnedUnit[], random: SeededRandom) {
  let units = [...input];
  let upgraded = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of UNITS) for (const star of [1, 2] as const) {
      const matches = units.filter((unit) => unit.unitId === def.id && unit.star === star);
      if (matches.length < 3) continue;
      const group = matches.slice(0, 3);
      const consumed = new Set(group.map((unit) => unit.uid));
      units = units.filter((unit) => !consumed.has(unit.uid));
      units.push({ ...group[0], uid: aiUid(random), star: (star + 1) as 2 | 3, position: null, itemIds: group.flatMap((unit) => unit.itemIds).slice(0, 2) });
      upgraded += 1;
      changed = true;
      break;
    }
    if (changed) continue;
  }
  return { units, upgraded };
}

function weightedUnit(level: number, units: OwnedUnit[], random: SeededRandom) {
  const excluded = new Set(units.filter((unit) => unit.star === 3).map((unit) => unit.unitId));
  const odds = effectiveShopOdds(level, excluded);
  let roll = random.next() * 100;
  let cost = 1;
  for (let index = 0; index < odds.length; index += 1) { roll -= odds[index]; if (roll <= 0) { cost = index + 1; break; } }
  const pool = UNITS.filter((unit) => unit.cost === cost && !excluded.has(unit.id));
  return pool[random.int(pool.length)]?.id ?? "";
}

export function rollAIShop(level: number, units: OwnedUnit[], random: SeededRandom) {
  return Array.from({ length: GAME_RULES.shopSize }, () => weightedUnit(level, units, random));
}

function uniqueTraitCounts(units: OwnedUnit[]) {
  const unique = new Map(units.map((unit) => [unit.unitId, unit]));
  const counts = new Map<Trait, number>();
  for (const unit of unique.values()) for (const trait of UNIT_MAP[unit.unitId].traits) counts.set(trait, (counts.get(trait) ?? 0) + 1);
  return counts;
}

function activeTier(trait: Trait, count: number) {
  const [first, second] = TRAIT_DETAILS[trait].thresholds;
  return count >= second ? 2 : count >= first ? 1 : 0;
}

function traitProgressValue(trait: Trait, count: number) {
  if (!count) return 0;
  const [first, second] = TRAIT_DETAILS[trait].thresholds;
  if (count >= second) return 58 + Math.min(4, count - second) * 3;
  if (count >= first) return 28 + Math.min(3, count - first) * 3;
  if (count === first - 1) return 7;
  return count * 1.5;
}

function synergyValue(units: OwnedUnit[]) {
  const counts = uniqueTraitCounts(units);
  let total = 0;
  for (const [trait, count] of counts) total += traitProgressValue(trait, count);
  return Math.round(total);
}

function equipmentPower(unit: OwnedUnit) {
  const def = UNIT_MAP[unit.unitId];
  const role = def.traits[1];
  const frontline = frontClasses.has(role);
  const caster = role === "Support" || role === "Engineer" || role === "Hacker" || def.traits.includes("Arcanist");
  return unit.itemIds.reduce((sum, id) => {
    const item = ITEMS.find((entry) => entry.id === id);
    if (!item) return sum;
    const attack = (item.attack ?? 0) * def.attack * (damageClasses.has(role) ? 1.2 : .85);
    const hp = (item.hp ?? 0) / 28 * (frontline ? 1.25 : .8);
    const armor = (item.armor ?? 0) * .7 * (frontline ? 1.3 : .8);
    const mana = (item.mana ?? 0) * .3 * (caster ? 1.3 : .7);
    return sum + attack + hp + armor + mana;
  }, 0);
}

function unitPower(unit: OwnedUnit) { return UNIT_MAP[unit.unitId].cost * (unit.star === 1 ? 9 : unit.star === 2 ? 28 : 85) + equipmentPower(unit); }
function unitRefund(unit: OwnedUnit) { return UNIT_MAP[unit.unitId].cost * starCopies(unit.star); }

function itemFitValue(unit: OwnedUnit, item: (typeof ITEMS)[number]) {
  const def = UNIT_MAP[unit.unitId];
  const role = def.traits[1];
  const frontline = frontClasses.has(role);
  const damage = damageClasses.has(role);
  const caster = role === "Support" || role === "Engineer" || role === "Hacker" || def.traits.includes("Arcanist");
  let score = unitPower(unit) + (unit.position !== null ? 36 : 0) + (unit.star - 1) * 34 - unit.itemIds.length * 10;
  if (item.attack) score += item.attack * 100 * (damage ? 1.7 : .8);
  if (item.hp) score += item.hp / 18 * (frontline ? 1.8 : .8);
  if (item.armor) score += item.armor * (frontline ? 2.2 : .7);
  if (item.mana) score += item.mana * (caster ? 1.6 : .45);
  return score;
}

/* The player earns gear from neutral victories while AI commanders previously had no equipment path at all.
   Starting after the first neutral cycle, every surviving AI receives the same one-item-per-5-round cadence.
   Drops are deterministic and equipment placement is a decision-quality feature, not a hidden stat multiplier. */
function equipNeutralReward(ai: AICommander, completedRound: number) {
  if (!ai.alive) return ai;
  const eligible = ai.units.filter((unit) => unit.itemIds.length < 2);
  if (!eligible.length) return ai;
  const deployed = eligible.filter((unit) => unit.position !== null);
  const candidates = deployed.length ? deployed : eligible;
  const nameSeed = [...ai.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const item = ITEMS[(Math.floor(completedRound / 5) + nameSeed) % ITEMS.length];
  const target = [...candidates].sort((a, b) => itemFitValue(b, item) - itemFitValue(a, item) || (a.uid < b.uid ? -1 : 1))[0];
  if (!target) return ai;
  return { ...ai, units: ai.units.map((unit) => unit.uid === target.uid ? { ...unit, itemIds: [...unit.itemIds, item.id] } : unit) };
}

/* Late-game decisions should be based on the formation that is actually fighting, not every spare
   unit on the Bench. This prevents phantom Bench synergies from pulling Hard AI away from a strong core. */
function strategicBoardUnits(ai: AICommander) {
  const deployed = ai.units.filter((unit) => unit.position !== null);
  if (deployed.length) return deployed;
  return [...ai.units].sort((a, b) => unitPower(b) - unitPower(a) || (a.uid < b.uid ? -1 : 1)).slice(0, Math.min(ai.level, ai.units.length));
}

function strategicTraitCounts(ai: AICommander) {
  return uniqueTraitCounts(strategicBoardUnits(ai));
}

function completesStrategicBreakpoint(ai: AICommander, unitId: string) {
  if (ownedBaseCopies(ai.units, unitId) > 0) return false;
  const counts = strategicTraitCounts(ai);
  return UNIT_MAP[unitId].traits.some((trait) => {
    const before = counts.get(trait) ?? 0;
    return activeTier(trait, before + 1) > activeTier(trait, before);
  });
}

function isLateStrategicPurchase(ai: AICommander, unitId: string) {
  if (ai.difficulty !== "Hard" || ai.level < 7) return true;
  const def = UNIT_MAP[unitId];
  const copies = ownedBaseCopies(ai.units, unitId);
  const onCore = ai.units.some((unit) => unit.unitId === unitId && unit.position !== null);
  const upgraded = ai.units.some((unit) => unit.unitId === unitId && unit.star > 1);
  const upgradeNear = copies > 0 && (copies % 3 === 2 || copies % 9 === 8);
  const breakpoint = completesStrategicBreakpoint(ai, unitId);
  const focus = def.traits.includes(ai.focus);
  const preferred = (preferredRoles[ai.focus] ?? []).includes(def.traits[1]);
  return def.cost >= 4 || breakpoint || upgradeNear || upgraded || onCore || (def.cost >= 3 && (focus || preferred));
}

function compositionValue(ai: AICommander, units: OwnedUnit[]) {
  const counts = uniqueTraitCounts(units);
  let score = units.reduce((sum, unit) => sum + unitPower(unit), 0);
  for (const [trait, count] of counts) {
    score += traitProgressValue(trait, count);
    if (trait === ai.focus) score += count * 5 + activeTier(trait, count) * 10;
  }
  const roles = units.map((unit) => UNIT_MAP[unit.unitId].traits[1]);
  const frontline = roles.filter((role) => frontClasses.has(role)).length;
  const damage = roles.filter((role) => damageClasses.has(role)).length;
  if (frontline) score += 10 + Math.min(frontline, 3) * 2;
  if (damage >= 2) score += 8;
  for (const role of preferredRoles[ai.focus] ?? []) score += (counts.get(role) ?? 0) * (ai.difficulty === "Hard" ? 5 : 2);
  if (ai.difficulty === "Hard") {
    const assassin = counts.get("Assassin") ?? 0;
    const wild = counts.get("Wild") ?? 0;
    const support = counts.get("Support") ?? 0;
    const guardian = counts.get("Guardian") ?? 0;
    const arcanist = counts.get("Arcanist") ?? 0;
    if (!frontline) score -= 44;
    else if (frontline >= 2) score += 14;
    if (damage < 2) score -= 22;
    else if (damage >= 3) score += 9;
    if (assassin >= 2) score += 24 + (assassin >= 3 ? 22 : 0);
    if (wild >= 2) score += 14 + (wild >= 3 ? 16 : 0);
    if (support >= 2) score += 14 + (support >= 3 ? 14 : 0);
    if (guardian >= 2) score += 12;
    if (arcanist >= 2) score += 15 + (arcanist >= 4 ? 20 : 0);
    if (frontline >= 2 && support >= 2) score += 12;
    if (assassin >= 2 && frontline >= 1) score += 8;
    if (arcanist >= 2 && support >= 1) score += 7;
    if (ai.level >= 7) {
      score += units.reduce((sum, unit) => {
        const cost = UNIT_MAP[unit.unitId].cost;
        return sum + (cost >= 4 ? cost * (unit.star === 1 ? 7 : unit.star === 2 ? 15 : 24) : 0);
      }, 0);
    }
  }
  return score;
}

function candidateValue(ai: AICommander, unitId: string, weights: Weights, random: SeededRandom) {
  const def = UNIT_MAP[unitId];
  const copies = ownedBaseCopies(ai.units, unitId);
  const upgrade = copies % 3 === 2 || copies % 9 === 8 ? 12 : copies ? 4 : 0;
  const counts = ai.difficulty === "Hard" && ai.level >= 7 ? strategicTraitCounts(ai) : uniqueTraitCounts(ai.units);
  const isNew = copies === 0;
  let breakpoint = 0;
  const synergy = def.traits.reduce((sum, trait) => {
    const before = counts.get(trait) ?? 0;
    const after = before + (isNew ? 1 : 0);
    if (activeTier(trait, after) > activeTier(trait, before)) breakpoint += ai.difficulty === "Hard" ? 12 : 4;
    return sum + Math.max(0, traitProgressValue(trait, after) - traitProgressValue(trait, before));
  }, 0);
  const focus = def.traits.includes(ai.focus) ? 8 : 0;
  const preferred = (preferredRoles[ai.focus] ?? []).includes(def.traits[1]) ? 5 : 0;
  const hardCounter = ai.difficulty === "Hard" && def.traits[1] === "Assassin" ? 7 : 0;
  const sustain = ai.difficulty === "Hard" && (def.traits.includes("Wild") || def.traits[1] === "Support" || def.traits[1] === "Guardian") ? 4 : 0;
  const magicPressure = ai.difficulty === "Hard" && def.traits.includes("Arcanist") ? 5 : 0;
  const lateGame = ai.difficulty === "Hard" && ai.level >= 7 && def.cost >= 4 ? 11 : 0;
  const lateNoveltyPenalty = ai.difficulty === "Hard" && ai.level >= 7 && isNew && def.cost <= 2 && breakpoint === 0 ? 24 : 0;
  return def.cost * weights.power + upgrade * weights.upgrade + synergy * weights.synergy + (focus + preferred + hardCounter + sustain + magicPressure + breakpoint + lateGame) * weights.focus - lateNoveltyPenalty + (random.next() - .5) * weights.noise;
}

function effectiveWeights(ai: AICommander): Weights {
  const base = personalityWeights[ai.personality];
  const quality = difficultyQuality[ai.difficulty];
  const hard = ai.difficulty === "Hard";
  const pressure = hard && (ai.health < 65 || ai.streak <= -2);
  if (ai.personality !== "Adaptive") return {
    ...base,
    ...quality,
    economyFloor: pressure ? 0 : hard ? Math.min(30, Math.max(0, base.economyFloor - 15)) : base.economyFloor,
    rerollBudget: base.rerollBudget + (hard ? (pressure ? 4 : 2) : 0),
    levelBias: base.levelBias + (hard ? (pressure ? .5 : .35) : 0),
  };
  const adaptivePressure = ai.health < 55 || ai.streak <= -2;
  return {
    ...base,
    ...quality,
    power: adaptivePressure ? 1.75 : hard ? 1.05 : .85,
    economyFloor: adaptivePressure ? 0 : hard ? 25 : 40,
    rerollBudget: adaptivePressure ? (hard ? 6 : 3) : hard ? 4 : 1,
    levelBias: adaptivePressure ? 1.85 : hard ? 1.15 : .7,
  };
}

function nextInterestFloor(gold: number, target: number) {
  return Math.min(target, Math.floor(Math.max(0, gold) / 10) * 10);
}

function selectBoard(ai: AICommander, units: OwnedUnit[], level: number) {
  const count = Math.min(level, units.length);
  if (count >= units.length) return [...units];
  if (ai.difficulty === "Easy") return [...units].sort((a, b) => unitPower(b) - unitPower(a) || (a.uid < b.uid ? -1 : 1)).slice(0, count);

  const ordered = [...units].sort((a, b) => unitPower(b) - unitPower(a) || (a.uid < b.uid ? -1 : 1));
  if (ai.difficulty === "Normal") {
    const selected: OwnedUnit[] = [];
    const remaining = [...ordered];
    while (selected.length < count && remaining.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      for (let index = 0; index < remaining.length; index += 1) {
        const score = compositionValue(ai, [...selected, remaining[index]]);
        if (score > bestScore) { bestScore = score; bestIndex = index; }
      }
      selected.push(remaining.splice(bestIndex, 1)[0]);
    }
    return selected;
  }

  let best: OwnedUnit[] = ordered.slice(0, count);
  let bestScore = compositionValue(ai, best);
  const picked: OwnedUnit[] = [];
  const visit = (start: number) => {
    if (picked.length === count) {
      const score = compositionValue(ai, picked);
      if (score > bestScore) { bestScore = score; best = [...picked]; }
      return;
    }
    const needed = count - picked.length;
    for (let index = start; index <= ordered.length - needed; index += 1) {
      picked.push(ordered[index]);
      visit(index + 1);
      picked.pop();
    }
  };
  visit(0);

  /* Hysteresis: a mature Hard formation is retained unless the replacement is materially stronger.
     This stops tiny score differences from causing a different late-game army every round. */
  const current = units.filter((unit) => unit.position !== null);
  if (current.length === count) {
    const currentScore = compositionValue(ai, current);
    const late = level >= 7;
    const margin = late ? Math.max(24, currentScore * .05) : 6;
    const currentIds = new Set(current.map((unit) => unit.uid));
    const replacements = best.filter((unit) => !currentIds.has(unit.uid)).length;
    if (bestScore < currentScore + margin) return current;
    if (late && replacements >= 2 && bestScore < currentScore * 1.1) return current;
  }
  return best;
}

function positionBoard(ai: AICommander, units: OwnedUnit[], level: number) {
  const selected = selectBoard(ai, units, level);
  const selectedIds = new Set(selected.map((unit) => unit.uid));
  const front = ai.difficulty === "Hard" ? [19, 20, 18, 21, 17, 22, 16, 23] : [16, 18, 21, 23, 17, 22, 19, 20];
  const back = ai.difficulty === "Hard" ? [0, 7, 2, 5, 1, 6, 3, 4, 8, 15] : [0, 7, 2, 5, 1, 6, 3, 4, 8, 15];
  const middle = [9, 14, 10, 13, 11, 12];
  const supportLane = ai.difficulty === "Hard" ? [9, 14, 10, 13, 2, 5, 1, 6, 11, 12] : back.concat(middle);
  const assassinLane = ai.difficulty === "Hard" ? [16, 23, 17, 22, 8, 15, 18, 21, ...middle] : [7, 0, 15, 8, ...middle, ...front];
  const occupied = new Set<number>();
  const retainedPositions = new Map<string, number>();

  if (ai.difficulty === "Hard" && level >= 7) {
    for (const unit of selected) {
      if (unit.position === null || unit.position < 0 || unit.position >= 24 || occupied.has(unit.position)) continue;
      occupied.add(unit.position);
      retainedPositions.set(unit.uid, unit.position);
    }
  }

  const place = (unit: OwnedUnit) => {
    const retained = retainedPositions.get(unit.uid);
    if (retained !== undefined) return { ...unit, position: retained };
    const cls = UNIT_MAP[unit.unitId].traits[1];
    let lane = ai.difficulty === "Easy"
      ? middle.concat(front, back)
      : frontClasses.has(cls)
        ? front.concat(middle, back)
        : cls === "Support"
          ? supportLane.concat(back, front)
          : backClasses.has(cls)
            ? back.concat(middle, front)
            : cls === "Assassin"
              ? assassinLane.concat(front)
              : middle.concat(front, back);
    if (ai.difficulty === "Normal" && cls === "Assassin") lane = [7, 0, 15, 8, ...middle, ...front];
    const position = lane.find((cell) => !occupied.has(cell)) ?? [...Array(24).keys()].find((cell) => !occupied.has(cell)) ?? 0;
    occupied.add(position);
    return { ...unit, position };
  };
  return units.map((unit) => selectedIds.has(unit.uid) ? place(unit) : { ...unit, position: null });
}

function benchKeepValue(ai: AICommander, unit: OwnedUnit) {
  const def = UNIT_MAP[unit.unitId];
  const copies = ownedBaseCopies(ai.units, unit.unitId);
  const counts = ai.difficulty === "Hard" && ai.level >= 7 ? strategicTraitCounts(ai) : uniqueTraitCounts(ai.units);
  let score = unitPower(unit);
  if (unit.star > 1) score += unit.star === 2 ? 40 : 120;
  if (copies % 3 === 2 || copies % 9 === 8) score += 42;
  if (def.traits.includes(ai.focus)) score += 14;
  for (const trait of def.traits) {
    const count = counts.get(trait) ?? 0;
    const [first, second] = TRAIT_DETAILS[trait].thresholds;
    if (count === first - 1 || count === second - 1) score += 12;
    if (activeTier(trait, count)) score += 5;
  }
  return score;
}

function makeHardBenchRoom(ai: AICommander, incomingUnitId: string) {
  if (ai.difficulty !== "Hard") return ai;
  const bench = ai.units.filter((unit) => unit.position === null);
  if (bench.length < GAME_RULES.benchSize) return ai;
  if (!isLateStrategicPurchase(ai, incomingUnitId)) return ai;
  const sellable = bench.filter((unit) => unit.star === 1 && unit.itemIds.length === 0)
    .sort((a, b) => benchKeepValue(ai, a) - benchKeepValue(ai, b) || UNIT_MAP[a.unitId].cost - UNIT_MAP[b.unitId].cost || (a.uid < b.uid ? -1 : 1));
  const worst = sellable[0];
  if (!worst) return ai;
  return { ...ai, gold: ai.gold + unitRefund(worst), units: ai.units.filter((unit) => unit.uid !== worst.uid) };
}

function maybeBuy(ai: AICommander, weights: Weights, random: SeededRandom) {
  const choices = ai.shop.map((unitId, index) => ({ unitId, index, score: unitId ? candidateValue(ai, unitId, weights, random) : -Infinity })).sort((a, b) => b.score - a.score).slice(0, weights.candidates);
  for (const choice of choices) {
    if (!choice.unitId || !isLateStrategicPurchase(ai, choice.unitId)) continue;
    const def = UNIT_MAP[choice.unitId];
    const protectedGold = nextInterestFloor(ai.gold, weights.economyFloor);
    const copies = ownedBaseCopies(ai.units, choice.unitId);
    const urgent = copies % 3 === 2 || copies % 9 === 8;
    if (ai.gold < def.cost || (!urgent && ai.gold - def.cost < protectedGold)) continue;

    let shopper = ai;
    let combined = combineAIUnits([...shopper.units, { uid: aiUid(random), unitId: choice.unitId, star: 1, position: null, itemIds: [] }], random);
    let benchCount = Math.max(0, combined.units.length - shopper.level);
    if (benchCount > GAME_RULES.benchSize) {
      shopper = makeHardBenchRoom(ai, choice.unitId);
      if (shopper === ai) continue;
      combined = combineAIUnits([...shopper.units, { uid: aiUid(random), unitId: choice.unitId, star: 1, position: null, itemIds: [] }], random);
      benchCount = Math.max(0, combined.units.length - shopper.level);
    }
    if (benchCount > GAME_RULES.benchSize || shopper.gold < def.cost) continue;
    return { ...shopper, gold: shopper.gold - def.cost, units: combined.units, shop: shopper.shop.map((entry, index) => index === choice.index ? "" : entry), behavior: { ...shopper.behavior, bought: shopper.behavior.bought + 1 } };
  }
  return ai;
}

function shouldChaseSynergy(ai: AICommander) {
  const counts = ai.difficulty === "Hard" && ai.level >= 7 ? strategicTraitCounts(ai) : uniqueTraitCounts(ai.units);
  for (const [trait, count] of counts) {
    const [first, second] = TRAIT_DETAILS[trait].thresholds;
    if (count === first - 1 || count === second - 1) return true;
  }
  return false;
}

export function planAI(ai: AICommander, round: number, random: SeededRandom, receiveIncome = true): AICommander {
  if (!ai.alive) return ai;
  let next: AICommander = { ...ai, units: ai.units.map((unit) => ({ ...unit })), shop: [...ai.shop], behavior: { ...ai.behavior } };
  if (receiveIncome) {
    const income = incomeFor(next.gold, next.streak);
    const progression = applyXp(next.level, next.xp, passiveXpForRound(Math.max(1, round - 1)));
    next.gold += income.total; next.level = progression.level; next.xp = progression.xp;
    next.shop = rollAIShop(next.level, next.units, random);
    next.behavior.interestProtected += income.interest;
  }
  const weights = effectiveWeights(next);
  const oldLevel = next.level;
  const maxTraining = next.difficulty === "Hard" ? (next.health < 55 || next.streak <= -2 ? 3 : 2) : 1;
  for (let training = 0; training < maxTraining; training += 1) {
    const needed = XP_TO_LEVEL[next.level] ?? Infinity;
    const tempoWindow = round >= next.level * (next.difficulty === "Hard" ? 1.35 : 2);
    const benchPressure = next.difficulty === "Hard" && next.units.length > next.level && round >= 5;
    const shouldLevel = next.level < GAME_RULES.maxLevel && next.gold >= GAME_RULES.trainingCost && (next.xp + GAME_RULES.trainingXp >= needed || (tempoWindow && weights.levelBias > 1) || (benchPressure && weights.levelBias >= .9));
    if (!shouldLevel) break;
    const allowedDip = next.personality === "Tempo" || (next.personality === "Adaptive" && next.health < 45) || next.difficulty === "Hard" ? 10 : 0;
    if (next.gold - GAME_RULES.trainingCost < Math.max(0, nextInterestFloor(next.gold, weights.economyFloor) - allowedDip)) break;
    const progression = applyXp(next.level, next.xp, GAME_RULES.trainingXp);
    next = { ...next, gold: next.gold - GAME_RULES.trainingCost, level: progression.level, xp: progression.xp, behavior: { ...next.behavior, trainingBuys: next.behavior.trainingBuys + 1 } };
  }
  for (let purchase = 0; purchase < GAME_RULES.shopSize; purchase += 1) {
    const bought = maybeBuy(next, weights, random);
    if (bought === next) break;
    next = bought;
  }
  let rerolls = 0;
  while (rerolls < weights.rerollBudget && next.gold >= GAME_RULES.rerollCost) {
    const floor = nextInterestFloor(next.gold, weights.economyFloor);
    if (next.gold - GAME_RULES.rerollCost < floor && next.personality !== "Collector" && !(next.difficulty === "Hard" && next.health < 65)) break;
    const upgradeChance = next.units.some((unit) => ownedBaseCopies(next.units, unit.unitId) % 3 === 2);
    const synergyChase = shouldChaseSynergy(next);
    const lateHard = next.difficulty === "Hard" && next.level >= 7;
    const pressure = next.health < 55 || next.streak <= -2;
    const lateCarryChase = lateHard && strategicBoardUnits(next).some((unit) => UNIT_MAP[unit.unitId].cost >= 4 && unit.star === 1 && ownedBaseCopies(next.units, unit.unitId) < 3);
    if (!upgradeChance && !synergyChase && !lateCarryChase) {
      if (lateHard) {
        if (random.next() > (pressure ? .25 : .08)) break;
      } else if (next.personality !== "Collector" && next.personality !== "Synergy Hunter" && random.next() > (next.difficulty === "Hard" ? .42 : .4)) break;
    }
    next = { ...next, gold: next.gold - GAME_RULES.rerollCost, shop: rollAIShop(next.level, next.units, random), behavior: { ...next.behavior, rerolls: next.behavior.rerolls + 1 } };
    for (let purchase = 0; purchase < GAME_RULES.shopSize; purchase += 1) {
      const bought = maybeBuy(next, weights, random); if (bought === next) break; next = bought;
    }
    rerolls += 1;
  }
  next.units = positionBoard(next, next.units, next.level);
  const before = ai.units.filter((unit) => unit.position !== null).map((unit) => `${unit.uid}:${unit.position}`).join("|");
  const after = next.units.filter((unit) => unit.position !== null).map((unit) => `${unit.uid}:${unit.position}`).join("|");
  next.behavior.formationChanges += before === after ? 0 : 1;
  next.behavior.synergyScore += synergyValue(next.units.filter((unit) => unit.position !== null));
  if (oldLevel !== next.level) next.shop = next.shop.length ? next.shop : rollAIShop(next.level, next.units, random);
  return next;
}

export function advanceAICommanders(commanders: AICommander[], round: number, random: SeededRandom) {
  const completedRound = Math.max(0, round - 1);
  const neutralReward = completedRound >= 5 && completedRound % 5 === 0;
  return commanders.map((ai) => planAI(neutralReward ? equipNeutralReward(ai, completedRound) : ai, round, random, true));
}

export function createAICommanders(difficulty: AIDifficulty, random: SeededRandom): AICommander[] {
  return AI_PROFILES.map((profile, index) => {
    const starters: OwnedUnit[] = [
      { uid: aiUid(random), unitId: index % 2 ? "wild-burrower" : "tunnel-guard", star: 1, position: null, itemIds: [] },
      { uid: aiUid(random), unitId: index % 3 ? "pickaxe-scout" : "glow-medic", star: 1, position: null, itemIds: [] },
    ];
    const base: AICommander = { ...profile, health: 100, level: 2, xp: 0, gold: 10, alive: true, streak: 0, personality: PERSONALITIES[index % PERSONALITIES.length], difficulty, units: starters, shop: [], behavior: { bought: 0, rerolls: 0, trainingBuys: 0, interestProtected: 0, synergyScore: 0, formationChanges: 0 } };
    base.shop = rollAIShop(base.level, base.units, random);
    return planAI(base, 1, random, false);
  });
}

export function aiBoard(ai: AICommander) {
  return ai.units.filter((unit) => unit.position !== null).map((unit) => ({ ...unit, itemIds: [...unit.itemIds] }));
}

export function migrateAICommanders(input: unknown, difficulty: AIDifficulty, random: SeededRandom) {
  if (!Array.isArray(input) || !input.length || !input.every((entry) => entry && typeof entry === "object" && "units" in entry && "gold" in entry)) return createAICommanders(difficulty, random);
  return (input as AICommander[]).map((ai) => ({ ...ai, difficulty, behavior: ai.behavior ?? { bought: 0, rerolls: 0, trainingBuys: 0, interestProtected: 0, synergyScore: 0, formationChanges: 0 } }));
}

export function assertAILegal(ai: AICommander) {
  const deployed = ai.units.filter((unit) => unit.position !== null);
  const bench = ai.units.filter((unit) => unit.position === null);
  return ai.gold >= 0 && deployed.length <= ai.level && bench.length <= GAME_RULES.benchSize && new Set(deployed.map((unit) => unit.position)).size === deployed.length && deployed.length === Math.min(ai.level, ai.units.length);
}

export function aiStrategySnapshot(ai: AICommander) {
  return { personality: ai.personality, difficulty: ai.difficulty, gold: ai.gold, level: ai.level, deployed: ai.units.filter((unit) => unit.position !== null).length, bench: ai.units.filter((unit) => unit.position === null).length, ...ai.behavior };
}
