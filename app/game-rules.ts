import { LEVEL_ODDS, UNITS, XP_TO_LEVEL } from "./game-data";

export const GAME_RULES = {
  benchSize: 8,
  shopSize: 5,
  rerollCost: 2,
  trainingCost: 4,
  trainingXp: 4,
  baseIncome: 5,
  interestStep: 10,
  interestCap: 5,
  maxLevel: 10,
  planningSeconds: 45,
  longPressMs: 450,
  dragThresholdPx: 8,
  streakBonuses: [
    { minimum: 5, bonus: 3 },
    { minimum: 3, bonus: 2 },
    { minimum: 2, bonus: 1 },
  ],
} as const;

export function passiveXpForRound(round: number) {
  return Math.min(8, 1 + Math.floor((Math.max(1, round) - 1) / 2));
}

export function interestForGold(gold: number) {
  return Math.min(GAME_RULES.interestCap, Math.floor(Math.max(0, gold) / GAME_RULES.interestStep));
}

export function streakBonusFor(streak: number) {
  const winsOrLosses = Math.abs(streak);
  return GAME_RULES.streakBonuses.find((entry) => winsOrLosses >= entry.minimum)?.bonus ?? 0;
}

export function incomeFor(gold: number, streak: number) {
  const interest = interestForGold(gold);
  const streakBonus = streakBonusFor(streak);
  return { base: GAME_RULES.baseIncome, interest, streakBonus, total: GAME_RULES.baseIncome + interest + streakBonus };
}

export function applyXp(currentLevel: number, currentXp: number, amount: number) {
  let level = currentLevel;
  let xp = currentXp + Math.max(0, amount);
  while (level < GAME_RULES.maxLevel) {
    const required = XP_TO_LEVEL[level] ?? Infinity;
    if (xp < required) break;
    xp -= required;
    level += 1;
  }
  return { level, xp: level >= GAME_RULES.maxLevel ? 0 : xp, levelsGained: level - currentLevel };
}

export function oddsForLevel(level: number) {
  const bounded = Math.max(2, Math.min(GAME_RULES.maxLevel, level));
  return [...LEVEL_ODDS[bounded]];
}

export function oddsTotal(level: number) {
  return oddsForLevel(level).reduce((sum, value) => sum + value, 0);
}

export function effectiveShopOdds(level: number, excluded = new Set<string>()) {
  const base = oddsForLevel(level);
  const available = base.map((weight, index) => weight > 0 && UNITS.some((unit) => unit.cost === index + 1 && !excluded.has(unit.id)) ? weight : 0);
  const total = available.reduce((sum, value) => sum + value, 0);
  if (!total) return [0, 0, 0, 0, 0];
  const normalized = available.map((value) => Math.round(value / total * 1000) / 10);
  const correction = Math.round((100 - normalized.reduce((sum, value) => sum + value, 0)) * 10) / 10;
  const correctionIndex = normalized.indexOf(Math.max(...normalized));
  normalized[correctionIndex] = Math.round((normalized[correctionIndex] + correction) * 10) / 10;
  return normalized;
}

export function resolveDropTarget(targets: string[]) {
  return targets.find((entry) => entry.startsWith("board:"))
    ?? targets.find((entry) => entry.startsWith("bench:"))
    ?? targets.find((entry) => entry === "sell")
    ?? null;
}
