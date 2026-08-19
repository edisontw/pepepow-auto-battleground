import { OwnedUnit, simulateBattle } from "./battle-engine";
import { Trait, TRAIT_DETAILS, UNITS } from "./game-data";

export const MATRIX_ARCHETYPES: Trait[] = ["Ranger", "Arcanist", "Assassin", "Guardian", "Brawler", "Engineer", "Support", "Cyber"];

function formation(trait: Trait, team: "player" | "enemy"): OwnedUnit[] {
  const byPower = [...UNITS].sort((a, b) => b.cost - a.cost || a.id.localeCompare(b.id));
  const coreCount = Math.min(UNITS.filter((unit) => unit.traits.includes(trait)).length, TRAIT_DETAILS[trait].thresholds[1]);
  const selected = byPower.filter((unit) => unit.traits.includes(trait)).slice(0, coreCount);
  const add = (predicate: (unit: (typeof UNITS)[number]) => boolean, target: number) => {
    while (selected.filter(predicate).length < target) {
      const candidate = byPower.find((unit) => !selected.includes(unit) && predicate(unit));
      if (!candidate) break;
      selected.push(candidate);
    }
  };
  add((unit) => unit.traits[1] === "Guardian" || unit.traits[1] === "Brawler", 2);
  add((unit) => ["Ranger", "Assassin", "Hacker", "Brawler"].includes(unit.traits[1]), 2);
  for (const candidate of byPower) if (selected.length < 8 && !selected.includes(candidate)) selected.push(candidate);
  const ordered = selected.slice(0, 8);
  const stars = new Map(ordered.map((unit) => [unit.id, 1 as 1 | 2]));
  let budget = ordered.reduce((sum, unit) => sum + unit.cost, 0);
  for (const unit of [...ordered].sort((a, b) => Number(b.traits.includes(trait)) - Number(a.traits.includes(trait)) || a.cost - b.cost)) {
    if (budget + unit.cost * 2 > 36) continue;
    stars.set(unit.id, 2);
    budget += unit.cost * 2;
  }
  const front = team === "player" ? [32, 33, 34, 35, 36, 37, 38, 39] : [15, 14, 13, 12, 11, 10, 9, 8];
  const back = team === "player" ? [40, 47, 42, 45, 41, 46, 43, 44] : [0, 7, 2, 5, 1, 6, 3, 4];
  let frontIndex = 0;
  let backIndex = 0;
  return ordered.map((def, index) => {
    const role = def.traits[1];
    const isFront = role === "Guardian" || role === "Brawler";
    const position = isFront ? front[frontIndex++] : back[backIndex++];
    return { uid: `${team}-${trait}-${index}`, unitId: def.id, star: stars.get(def.id) ?? 1, position, itemIds: [] };
  });
}

export type MatrixCell = { wins: number; losses: number; draws: number; winRate: number };
export type MatchupMatrix = {
  seeds: number;
  archetypes: Trait[];
  cells: Record<string, MatrixCell>;
  counters: Record<string, string[]>;
};

export function buildMatchupMatrix(seeds = 128, baseSeed = 9001): MatchupMatrix {
  const cells: Record<string, MatrixCell> = {};
  for (const row of MATRIX_ARCHETYPES) for (const column of MATRIX_ARCHETYPES) {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (let index = 0; index < seeds; index += 1) {
      const seed = baseSeed + index * 131 + MATRIX_ARCHETYPES.indexOf(row) * 17 + MATRIX_ARCHETYPES.indexOf(column);
      const first = simulateBattle(formation(row, "player"), formation(column, "enemy"), seed);
      const reversed = simulateBattle(formation(column, "player"), formation(row, "enemy"), seed);
      if (first.winner === "player") wins += 1;
      else if (first.winner === "enemy") losses += 1;
      else draws += 1;
      if (reversed.winner === "enemy") wins += 1;
      else if (reversed.winner === "player") losses += 1;
      else draws += 1;
    }
    const trials = seeds * 2;
    cells[`${row}:${column}`] = { wins, losses, draws, winRate: Math.round((wins + draws * .5) / trials * 1000) / 1000 };
  }
  const counters = Object.fromEntries(MATRIX_ARCHETYPES.map((row) => [row, MATRIX_ARCHETYPES.filter((column) => column !== row && cells[`${row}:${column}`].winRate <= .45)]));
  return { seeds, archetypes: [...MATRIX_ARCHETYPES], cells, counters };
}

export function matrixMarkdown(matrix: MatchupMatrix) {
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const header = `| Composition | ${matrix.archetypes.join(" | ")} | Counters |`;
  const divider = `|---|${matrix.archetypes.map(() => "---:").join("|")}|---|`;
  const rows = matrix.archetypes.map((row) => `| ${row} | ${matrix.archetypes.map((column) => percent(matrix.cells[`${row}:${column}`].winRate)).join(" | ")} | ${matrix.counters[row].join(", ") || "none"} |`);
  return [`Fixed seeds per pairing: ${matrix.seeds}`, "", header, divider, ...rows].join("\n");
}
