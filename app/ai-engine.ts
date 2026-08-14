import { OwnedUnit, SeededRandom } from "./battle-engine";
import { AI_PROFILES, Trait, UNIT_MAP, UNITS, XP_TO_LEVEL } from "./game-data";
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
const frontClasses = new Set(["Guardian", "Brawler"]);
const backClasses = new Set(["Ranger", "Support", "Engineer"]);

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
  Hard: { noise: .25, candidates: 8 },
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

function synergyValue(units: OwnedUnit[]) {
  const counts = uniqueTraitCounts(units);
  return [...counts.values()].reduce((sum, count) => sum + count * count, 0);
}

function unitPower(unit: OwnedUnit) { return UNIT_MAP[unit.unitId].cost * (unit.star === 1 ? 9 : unit.star === 2 ? 28 : 85); }

function candidateValue(ai: AICommander, unitId: string, weights: Weights, random: SeededRandom) {
  const def = UNIT_MAP[unitId];
  const copies = ownedBaseCopies(ai.units, unitId);
  const upgrade = copies % 3 === 2 || copies % 9 === 8 ? 12 : copies ? 4 : 0;
  const counts = uniqueTraitCounts(ai.units);
  const synergy = def.traits.reduce((sum, trait) => sum + (counts.get(trait) ?? 0) * 3, 0);
  const focus = def.traits.includes(ai.focus) ? 6 : 0;
  return def.cost * weights.power + upgrade * weights.upgrade + synergy * weights.synergy + focus * weights.focus + (random.next() - .5) * weights.noise;
}

function effectiveWeights(ai: AICommander): Weights {
  const base = personalityWeights[ai.personality];
  const quality = difficultyQuality[ai.difficulty];
  if (ai.personality !== "Adaptive") return { ...base, ...quality };
  const pressure = ai.health < 45 || ai.streak <= -2;
  return { ...base, ...quality, power: pressure ? 1.65 : .85, economyFloor: pressure ? 0 : 40, rerollBudget: pressure ? 3 : 1, levelBias: pressure ? 1.7 : .7 };
}

function nextInterestFloor(gold: number, target: number) {
  return Math.min(target, Math.floor(Math.max(0, gold) / 10) * 10);
}

function positionBoard(units: OwnedUnit[], level: number, difficulty: AIDifficulty) {
  const ranked = [...units].sort((a, b) => unitPower(b) - unitPower(a) || (a.uid < b.uid ? -1 : 1));
  const selected = ranked.slice(0, Math.min(level, ranked.length));
  const selectedIds = new Set(selected.map((unit) => unit.uid));
  const front = [16, 18, 21, 23, 17, 22, 19, 20];
  const back = [0, 7, 2, 5, 1, 6, 3, 4, 8, 15];
  const middle = [9, 14, 10, 13, 11, 12];
  const occupied = new Set<number>();
  const place = (unit: OwnedUnit) => {
    const cls = UNIT_MAP[unit.unitId].traits[1];
    let lane = difficulty === "Easy" ? middle.concat(front, back) : frontClasses.has(cls) ? front.concat(middle, back) : backClasses.has(cls) ? back.concat(middle, front) : cls === "Assassin" ? [7, 0, 15, 8, ...middle, ...front] : middle.concat(front, back);
    if (difficulty === "Normal" && cls === "Assassin") lane = [7, 0, 15, 8, ...middle, ...front];
    const position = lane.find((cell) => !occupied.has(cell)) ?? [...Array(24).keys()].find((cell) => !occupied.has(cell)) ?? 0;
    occupied.add(position);
    return { ...unit, position };
  };
  return units.map((unit) => selectedIds.has(unit.uid) ? place(unit) : { ...unit, position: null });
}

function maybeBuy(ai: AICommander, weights: Weights, random: SeededRandom) {
  const choices = ai.shop.map((unitId, index) => ({ unitId, index, score: unitId ? candidateValue(ai, unitId, weights, random) : -Infinity })).sort((a, b) => b.score - a.score).slice(0, weights.candidates);
  for (const choice of choices) {
    if (!choice.unitId) continue;
    const def = UNIT_MAP[choice.unitId];
    const protectedGold = nextInterestFloor(ai.gold, weights.economyFloor);
    const copies = ownedBaseCopies(ai.units, choice.unitId);
    const urgent = copies % 3 === 2 || copies % 9 === 8;
    if (ai.gold < def.cost || (!urgent && ai.gold - def.cost < protectedGold)) continue;
    const combined = combineAIUnits([...ai.units, { uid: aiUid(random), unitId: choice.unitId, star: 1, position: null, itemIds: [] }], random);
    const benchCount = Math.max(0, combined.units.length - ai.level);
    if (benchCount > GAME_RULES.benchSize) continue;
    return { ...ai, gold: ai.gold - def.cost, units: combined.units, shop: ai.shop.map((entry, index) => index === choice.index ? "" : entry), behavior: { ...ai.behavior, bought: ai.behavior.bought + 1 } };
  }
  return ai;
}

export function planAI(ai: AICommander, round: number, random: SeededRandom, receiveIncome = true): AICommander {
  if (!ai.alive) return ai;
  let next: AICommander = { ...ai, units: ai.units.map((unit) => ({ ...unit, position: null })), shop: [...ai.shop], behavior: { ...ai.behavior } };
  if (receiveIncome) {
    const income = incomeFor(next.gold, next.streak);
    const progression = applyXp(next.level, next.xp, passiveXpForRound(Math.max(1, round - 1)));
    next.gold += income.total; next.level = progression.level; next.xp = progression.xp;
    next.shop = rollAIShop(next.level, next.units, random);
    next.behavior.interestProtected += income.interest;
  }
  const weights = effectiveWeights(next);
  const oldLevel = next.level;
  const needed = XP_TO_LEVEL[next.level] ?? Infinity;
  const shouldLevel = next.level < GAME_RULES.maxLevel && next.gold >= GAME_RULES.trainingCost && (next.xp + GAME_RULES.trainingXp >= needed || (round >= next.level * 2 && weights.levelBias > 1));
  if (shouldLevel && next.gold - GAME_RULES.trainingCost >= Math.max(0, nextInterestFloor(next.gold, weights.economyFloor) - (next.personality === "Tempo" || (next.personality === "Adaptive" && next.health < 45) ? 10 : 0))) {
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
    if (next.gold - GAME_RULES.rerollCost < floor && next.personality !== "Collector") break;
    const upgradeChance = next.units.some((unit) => ownedBaseCopies(next.units, unit.unitId) % 3 === 2);
    if (!upgradeChance && next.personality !== "Collector" && next.personality !== "Synergy Hunter" && random.next() > .4) break;
    next = { ...next, gold: next.gold - GAME_RULES.rerollCost, shop: rollAIShop(next.level, next.units, random), behavior: { ...next.behavior, rerolls: next.behavior.rerolls + 1 } };
    for (let purchase = 0; purchase < GAME_RULES.shopSize; purchase += 1) {
      const bought = maybeBuy(next, weights, random); if (bought === next) break; next = bought;
    }
    rerolls += 1;
  }
  next.units = positionBoard(next.units, next.level, next.difficulty);
  const before = ai.units.filter((unit) => unit.position !== null).map((unit) => `${unit.uid}:${unit.position}`).join("|");
  const after = next.units.filter((unit) => unit.position !== null).map((unit) => `${unit.uid}:${unit.position}`).join("|");
  next.behavior.formationChanges += before === after ? 0 : 1;
  next.behavior.synergyScore += synergyValue(next.units.filter((unit) => unit.position !== null));
  if (oldLevel !== next.level) next.shop = next.shop.length ? next.shop : rollAIShop(next.level, next.units, random);
  return next;
}

export function advanceAICommanders(commanders: AICommander[], round: number, random: SeededRandom) {
  return commanders.map((ai) => planAI(ai, round, random, true));
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
