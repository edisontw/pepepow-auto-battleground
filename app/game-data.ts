export type Trait =
  | "Crystal"
  | "Machine"
  | "Wild"
  | "Cyber"
  | "Underground"
  | "Void"
  | "Guardian"
  | "Ranger"
  | "Engineer"
  | "Brawler"
  | "Assassin"
  | "Hacker"
  | "Support"
  | "Arcanist";

export type UnitDef = {
  id: string;
  name: string;
  cost: 1 | 2 | 3 | 4 | 5;
  traits: [Trait, Trait, ...Trait[]];
  icon: string;
  color: string;
  hp: number;
  attack: number;
  armor: number;
  range: 1 | 2 | 3 | 4;
  skill: string;
  skillText: string;
};

export type SkillVfxKind = "single" | "piercing" | "chain" | "area" | "heal" | "control" | "shield";

export const UNITS: UnitDef[] = [
  { id: "pickaxe-scout", name: "Pickaxe Scout", cost: 1, traits: ["Crystal", "Ranger"], icon: "⛏", color: "#62dca5", hp: 520, attack: 54, armor: 12, range: 3, skill: "Shard Shot", skillText: "Deals 165% attack damage to its locked target." },
  { id: "tunnel-guard", name: "Tunnel Guard", cost: 1, traits: ["Underground", "Guardian"], icon: "🛡", color: "#c58a54", hp: 700, attack: 38, armor: 25, range: 1, skill: "Brace", skillText: "Gains a shield equal to 24% max HP and taunts nearby enemies." },
  { id: "spark-mechanic", name: "Spark Mechanic", cost: 1, traits: ["Machine", "Engineer"], icon: "⚙", color: "#e0a739", hp: 540, attack: 48, armor: 16, range: 2, skill: "Field Overclock", skillText: "Repairs the lowest-health ally for 140% attack." },
  { id: "wild-burrower", name: "Wild Burrower", cost: 1, traits: ["Wild", "Brawler"], icon: "✦", color: "#8dd14c", hp: 680, attack: 50, armor: 18, range: 1, skill: "Headlong Rush", skillText: "Deals 165% attack damage around its locked target." },
  { id: "data-slinger", name: "Data Slinger", cost: 1, traits: ["Cyber", "Ranger"], icon: "⌁", color: "#42bfe8", hp: 500, attack: 58, armor: 10, range: 4, skill: "Packet Burst", skillText: "Deals 165% attack damage to its locked target." },
  { id: "glow-medic", name: "Glow Medic", cost: 1, traits: ["Crystal", "Support", "Arcanist"], icon: "✚", color: "#7ff4c7", hp: 520, attack: 40, armor: 14, range: 3, skill: "Lumen Mend", skillText: "Heals the two lowest-health allies for 210% attack." },
  { id: "arcane-apprentice", name: "Arcane Apprentice", cost: 1, traits: ["Machine", "Support", "Arcanist"], icon: "✧", color: "#7de6c8", hp: 500, attack: 36, armor: 12, range: 3, skill: "Mana Ward", skillText: "Heals the two lowest-health allies for 150% attack and grants them 20 Mana." },
  { id: "iron-bulwark", name: "Iron Bulwark", cost: 2, traits: ["Machine", "Guardian"], icon: "⬢", color: "#d4a641", hp: 850, attack: 52, armor: 36, range: 1, skill: "Fortify", skillText: "Gains a shield equal to 34% max HP and taunts nearby enemies." },
  { id: "cave-stalker", name: "Cave Stalker", cost: 2, traits: ["Underground", "Assassin"], icon: "◈", color: "#c4784f", hp: 610, attack: 78, armor: 14, range: 1, skill: "Ambush", skillText: "Targets enemy Rangers first in the backline and deals 225% attack damage when casting." },
  { id: "volt-hacker", name: "Volt Hacker", cost: 2, traits: ["Cyber", "Hacker", "Arcanist"], icon: "ϟ", color: "#47c9f2", hp: 580, attack: 62, armor: 13, range: 3, skill: "Chain Hack", skillText: "Lightning jumps between enemies." },
  { id: "rune-blaster", name: "Rune Blaster", cost: 2, traits: ["Crystal", "Hacker", "Arcanist"], icon: "✥", color: "#55cffa", hp: 570, attack: 68, armor: 12, range: 4, skill: "Rune Nova", skillText: "Detonates a rune across a 2-cell radius for 145% attack damage." },
  { id: "moss-brute", name: "Moss Brute", cost: 2, traits: ["Wild", "Brawler"], icon: "♜", color: "#75bd4d", hp: 900, attack: 64, armor: 22, range: 1, skill: "Ground Pound", skillText: "Damages nearby enemies." },
  { id: "prism-gunner", name: "Prism Gunner", cost: 2, traits: ["Crystal", "Ranger"], icon: "◇", color: "#6fe1b5", hp: 590, attack: 72, armor: 14, range: 4, skill: "Refraction", skillText: "Deals 165% attack damage to its locked target." },
  { id: "gear-smith", name: "Gear Smith", cost: 2, traits: ["Machine", "Engineer"], icon: "🔧", color: "#dfaa45", hp: 650, attack: 55, armor: 20, range: 2, skill: "Field Repair", skillText: "Repairs the lowest-health ally for 140% attack." },
  { id: "mire-chemist", name: "Mire Chemist", cost: 2, traits: ["Wild", "Engineer"], icon: "♨", color: "#92ba45", hp: 640, attack: 50, armor: 18, range: 3, skill: "Miasma Seal", skillText: "Marks enemies near the target, reducing healing received by 55% for 3 ticks." },
  { id: "lantern-warden", name: "Lantern Warden", cost: 2, traits: ["Underground", "Support"], icon: "▣", color: "#d39a52", hp: 720, attack: 48, armor: 24, range: 2, skill: "Safe Light", skillText: "Shields the most threatened backline ally and grants 20 Mana." },
  { id: "void-reaper", name: "Void Reaper", cost: 3, traits: ["Void", "Assassin"], icon: "☄", color: "#a878ed", hp: 680, attack: 100, armor: 16, range: 1, skill: "Phase Cut", skillText: "Strikes through armor and hunts enemy Rangers when opening a fight." },
  { id: "deep-warden", name: "Deep Warden", cost: 3, traits: ["Underground", "Guardian"], icon: "⬟", color: "#ad724b", hp: 1100, attack: 65, armor: 42, range: 1, skill: "Seismic Guard", skillText: "Deals 165% attack damage and stuns its locked target for 2 ticks." },
  { id: "circuit-sage", name: "Circuit Sage", cost: 3, traits: ["Cyber", "Support", "Arcanist"], icon: "◎", color: "#4acbe7", hp: 690, attack: 58, armor: 18, range: 3, skill: "Restore Point", skillText: "Heals the two lowest-health allies for 210% attack." },
  { id: "quartz-knight", name: "Quartz Knight", cost: 3, traits: ["Crystal", "Guardian"], icon: "♢", color: "#5edaa2", hp: 980, attack: 76, armor: 38, range: 1, skill: "Prismatic Wall", skillText: "Gains a shield equal to 24% max HP and taunts nearby enemies." },
  { id: "scrap-colossus", name: "Scrap Colossus", cost: 3, traits: ["Machine", "Brawler"], icon: "▣", color: "#d59b38", hp: 1080, attack: 82, armor: 28, range: 1, skill: "Magnet Slam", skillText: "Deals 165% attack damage around its locked target." },
  { id: "wild-seer", name: "Wild Seer", cost: 3, traits: ["Wild", "Support", "Arcanist"], icon: "☘", color: "#8cce57", hp: 720, attack: 63, armor: 18, range: 3, skill: "Growth Song", skillText: "Regenerates the whole team." },
  { id: "rift-breaker", name: "Rift Breaker", cost: 3, traits: ["Void", "Brawler"], icon: "⬣", color: "#a96bf1", hp: 1080, attack: 86, armor: 30, range: 1, skill: "Shield Collapse", skillText: "Destroys the target's shield before a heavy strike; broken shields amplify the hit." },
  { id: "signal-leech", name: "Signal Leech", cost: 3, traits: ["Cyber", "Assassin"], icon: "⌁", color: "#4ac8ef", hp: 700, attack: 96, armor: 17, range: 1, skill: "Mana Siphon", skillText: "Basic attacks corrupt 20 Mana. On cast, strikes the enemy with the most Mana, drains up to 45 Mana, and steals half." },
  { id: "prism-hook", name: "Prism Hook", cost: 3, traits: ["Crystal", "Assassin"], icon: "⟐", color: "#66e3b0", hp: 690, attack: 105, armor: 18, range: 1, skill: "Refractive Tether", skillText: "Pulls the farthest enemy one open cell closer and stuns it for 1 tick." },
  { id: "rift-sniper", name: "Rift Sniper", cost: 4, traits: ["Void", "Ranger"], icon: "⌖", color: "#ad7af2", hp: 720, attack: 132, armor: 17, range: 4, skill: "Event Horizon", skillText: "Charges a devastating long shot." },
  { id: "core-architect", name: "Core Architect", cost: 4, traits: ["Machine", "Engineer"], icon: "❖", color: "#f0b74f", hp: 820, attack: 82, armor: 25, range: 3, skill: "Auto-Repair", skillText: "Repairs the lowest-health ally for 140% attack." },
  { id: "phantom-miner", name: "Phantom Miner", cost: 4, traits: ["Underground", "Assassin"], icon: "♠", color: "#bc754d", hp: 780, attack: 140, armor: 20, range: 1, skill: "Shadow Shaft", skillText: "Targets enemy Rangers first in the backline and deals 225% attack damage when casting." },
  { id: "storm-hacker", name: "Storm Hacker", cost: 4, traits: ["Cyber", "Hacker", "Arcanist"], icon: "⌘", color: "#4bc8f0", hp: 760, attack: 92, armor: 19, range: 3, skill: "System Crash", skillText: "Disables and damages multiple enemies." },
  { id: "chrono-mage", name: "Chrono Mage", cost: 4, traits: ["Underground", "Hacker", "Arcanist"], icon: "◷", color: "#9b7af0", hp: 790, attack: 88, armor: 20, range: 3, skill: "Time Lock", skillText: "Deals 135% attack damage around the target and stuns survivors for 1 tick." },
  { id: "coil-ranger", name: "Coil Ranger", cost: 4, traits: ["Machine", "Ranger"], icon: "⌁", color: "#e2a541", hp: 760, attack: 120, armor: 22, range: 4, skill: "Feedback Mark", skillText: "Starts with 25 Mana. Marks the highest-Attack enemy for 3 ticks; 28% of all damage it deals feeds back into itself." },
  { id: "aurora-titan", name: "Aurora Titan", cost: 5, traits: ["Crystal", "Brawler"], icon: "✺", color: "#80f0c2", hp: 1500, attack: 135, armor: 38, range: 1, skill: "Aurora Quake", skillText: "A radiant shockwave hits all enemies." },
  { id: "null-sovereign", name: "Null Sovereign", cost: 5, traits: ["Void", "Hacker"], icon: "◉", color: "#b580f0", hp: 1050, attack: 150, armor: 25, range: 3, skill: "Null Protocol", skillText: "Deals 125% attack damage to all enemies and stuns them for 3 ticks." },
];

export const UNIT_MAP = Object.fromEntries(UNITS.map((unit) => [unit.id, unit])) as Record<string, UnitDef>;

export const SKILL_VFX: Partial<Record<string, SkillVfxKind>> = {
  "pickaxe-scout": "single", "data-slinger": "single", "prism-gunner": "single",
  "rift-sniper": "piercing", "coil-ranger": "control",
  "volt-hacker": "chain", "storm-hacker": "chain",
  "wild-burrower": "area", "moss-brute": "area", "scrap-colossus": "area", "rune-blaster": "area", "chrono-mage": "area", "aurora-titan": "area", "null-sovereign": "area", "mire-chemist": "area",
  "rift-breaker": "piercing",
  "spark-mechanic": "heal", "glow-medic": "heal", "arcane-apprentice": "heal", "gear-smith": "heal", "circuit-sage": "heal", "wild-seer": "heal", "core-architect": "heal", "lantern-warden": "shield",
  "tunnel-guard": "shield", "iron-bulwark": "shield", "quartz-knight": "shield",
  "deep-warden": "control", "signal-leech": "control", "prism-hook": "control",
};

export type ItemDef = { id: string; name: string; icon: string; text: string; attack?: number; hp?: number; armor?: number; mana?: number };
export const ITEMS: ItemDef[] = [
  { id: "power-pick", name: "Power Pick", icon: "⛏", text: "+25% attack", attack: 0.25 },
  { id: "crystal-core", name: "Crystal Core", icon: "◆", text: "+300 health", hp: 300 },
  { id: "reinforced-vest", name: "Reinforced Vest", icon: "▤", text: "+20 armor", armor: 20 },
  { id: "data-cell", name: "Data Cell", icon: "◫", text: "+35 starting mana", mana: 35 },
  { id: "twin-drill", name: "Twin Drill", icon: "⚒", text: "+15% attack, +10 armor", attack: 0.15, armor: 10 },
  { id: "deep-battery", name: "Deep Battery", icon: "▰", text: "+180 health, +20 mana", hp: 180, mana: 20 },
  { id: "void-lens", name: "Void Lens", icon: "◉", text: "+35% attack", attack: 0.35 },
  { id: "aegis-node", name: "Aegis Node", icon: "⬡", text: "+400 health, +25 armor", hp: 400, armor: 25 },
];

export type TraitDetail = {
  category: "Faction" | "Class";
  thresholds: [number, number];
  summary: string;
  tiers: [string, string];
  appliesTo: "All allies" | "Trait units";
  icon: string;
  color: string;
  accent: string;
};

export const TRAIT_DETAILS: Record<Trait, TraitDetail> = {
  Crystal: { category: "Faction", thresholds: [2, 4], summary: "Crystal plating reinforces the entire formation.", tiers: ["All allies gain +12 Armor.", "All allies gain +26 Armor."], appliesTo: "All allies", icon: "/synergies/crystal.svg", color: "#62e7c2", accent: "#e8fff7" },
  Machine: { category: "Faction", thresholds: [2, 4], summary: "Synchronized machinery raises the crew's damage output.", tiers: ["All allies gain +10% Attack.", "All allies gain +25% Attack."], appliesTo: "All allies", icon: "/synergies/machine.svg", color: "#e6aa45", accent: "#ffe29a" },
  Wild: { category: "Faction", thresholds: [2, 3], summary: "Living ore and primal vigor strengthen every ally.", tiers: ["All allies gain +15% maximum Health.", "All allies gain +32% maximum Health."], appliesTo: "All allies", icon: "/synergies/wild.svg", color: "#89c951", accent: "#d9ee75" },
  Cyber: { category: "Faction", thresholds: [2, 4], summary: "A shared data bus accelerates skill charging.", tiers: ["All allies gain 32 Mana per attack instead of 24.", "All allies gain 42 Mana per attack instead of 24."], appliesTo: "All allies", icon: "/synergies/cyber.svg", color: "#45c9ee", accent: "#dffaff" },
  Underground: { category: "Faction", thresholds: [2, 4], summary: "Tunnel survival techniques convert damage into recovery.", tiers: ["All allies heal for 8% of attack damage dealt.", "All allies heal for 18% of attack damage dealt."], appliesTo: "All allies", icon: "/synergies/underground.svg", color: "#c27b4e", accent: "#f1bd72" },
  Void: { category: "Faction", thresholds: [2, 3], summary: "Void energy erodes enemy defenses before each strike.", tiers: ["All allies ignore 15 enemy Armor.", "All allies ignore 30 enemy Armor."], appliesTo: "All allies", icon: "/synergies/void.svg", color: "#a872eb", accent: "#f0ceff" },
  Guardian: { category: "Class", thresholds: [2, 4], summary: "Guardians form an armored front line.", tiers: ["Guardians gain +18 Armor.", "Guardians gain +34 Armor."], appliesTo: "Trait units", icon: "/synergies/guardian.svg", color: "#6fd5ff", accent: "#dff8ff" },
  Ranger: { category: "Class", thresholds: [2, 4], summary: "Rangers coordinate focused ranged fire.", tiers: ["Rangers gain +15% Attack.", "Rangers gain +30% Attack."], appliesTo: "Trait units", icon: "/synergies/ranger.svg", color: "#f0cf61", accent: "#fff1a8" },
  Engineer: { category: "Class", thresholds: [2, 3], summary: "Engineers enter combat with charged equipment.", tiers: ["Engineers start with +30 Mana.", "Engineers start with +55 Mana."], appliesTo: "Trait units", icon: "/synergies/engineer.svg", color: "#e3a647", accent: "#ffe1a0" },
  Brawler: { category: "Class", thresholds: [2, 4], summary: "Brawlers become harder to bring down.", tiers: ["Brawlers gain +18% maximum Health.", "Brawlers gain +35% maximum Health."], appliesTo: "Trait units", icon: "/synergies/brawler.svg", color: "#e77f50", accent: "#ffd0aa" },
  Assassin: { category: "Class", thresholds: [2, 3], summary: "Assassins breach the backline and prey on Rangers.", tiers: ["Assassins have a 25% chance to deal 175% damage and deal +25% damage to Rangers.", "Assassins have a 42% chance to deal 175% damage and deal +45% damage to Rangers."], appliesTo: "Trait units", icon: "/synergies/assassin.svg", color: "#ef626b", accent: "#ffd0d3" },
  Hacker: { category: "Class", thresholds: [2, 3], summary: "Hacker attacks propagate to nearby targets.", tiers: ["Hacker attacks splash 35% damage to one adjacent enemy.", "Hacker attacks splash 60% damage to one adjacent enemy."], appliesTo: "Trait units", icon: "/synergies/hacker.svg", color: "#5dcfff", accent: "#d7f5ff" },
  Support: { category: "Class", thresholds: [2, 3], summary: "Support units amplify every repair and healing pulse.", tiers: ["Support healing is increased by 40%.", "Support healing is increased by 80%."], appliesTo: "Trait units", icon: "/synergies/support.svg", color: "#65dfbd", accent: "#e4fff4" },
  Arcanist: { category: "Class", thresholds: [2, 4], summary: "Arcanists channel combat energy into earlier, stronger abilities.", tiers: ["Arcanists start with +25 Mana and their skills are 15% stronger.", "Arcanists start with +45 Mana and their skills are 30% stronger."], appliesTo: "Trait units", icon: "/synergies/arcanist.svg", color: "#c972ef", accent: "#f2d2ff" },
};

export const TRAIT_TEXT = Object.fromEntries(
  Object.entries(TRAIT_DETAILS).map(([trait, detail]) => [trait, `${detail.thresholds.join("/")}: ${detail.tiers[0].replace(/\.$/, "")} / ${detail.tiers[1].replace(/\.$/, "")}`]),
) as Record<Trait, string>;

export const AI_PROFILES = [
  { name: "Iron Vera", focus: "Machine" as Trait, icon: "V", color: "#e1ad49", style: "Patient Builder" },
  { name: "Mossjaw", focus: "Wild" as Trait, icon: "M", color: "#83c951", style: "Aggressive Roller" },
  { name: "Cipher-7", focus: "Cyber" as Trait, icon: "C", color: "#43c5e9", style: "Flexible Hacker" },
  { name: "Delver Knox", focus: "Underground" as Trait, icon: "K", color: "#bb7950", style: "Economy Greed" },
  { name: "Nova Shard", focus: "Crystal" as Trait, icon: "N", color: "#66e0ad", style: "Reroll Specialist" },
  { name: "The Quiet", focus: "Void" as Trait, icon: "Q", color: "#aa79e9", style: "Late-game Pivot" },
  { name: "Atlas POW", focus: "Guardian" as Trait, icon: "A", color: "#f0c768", style: "Unbreakable Front" },
];

export const COST_COLORS = ["", "#a8b3a5", "#5bd48d", "#5ab5ee", "#b27ae9", "#f2bd4a"];

export const LEVEL_ODDS: Record<number, number[]> = {
  2: [100, 0, 0, 0, 0], 3: [75, 25, 0, 0, 0], 4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0], 6: [30, 40, 25, 5, 0], 7: [20, 30, 35, 14, 1],
  8: [15, 20, 35, 25, 5], 9: [10, 15, 30, 30, 15], 10: [5, 10, 20, 35, 30],
};

export const XP_TO_LEVEL: Record<number, number> = { 2: 2, 3: 6, 4: 10, 5: 18, 6: 28, 7: 40, 8: 56, 9: 72 };
