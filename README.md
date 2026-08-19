# PEPEPOW Auto Battleground

Browser-based deterministic auto battler built with Next.js-compatible app code and the ChatGPT Sites / vinext deployment workflow.

- Repository source of truth: GitHub `main`
- Current source status: **v0.9 art-unification release**
- Deployed Sites release: **v0.9**
- Site: `https://pepepow-auto-battleground.edisonhuang.chatgpt.site/`

## v0.9 release

This pass deliberately does **not** add the deferred per-run three-choice tactical module. It keeps the current realistic 2.5D direction and lightweight transparent-WebP renderer while unifying the art and combat-reading language.

### Art and Synergy presentation

- Five later-added mage portraits were rebuilt to match the shared camera, lighting, proportions, silhouette and material rules.
- `ART_BIBLE.md` is the production specification for unit crops, class silhouettes, faction materials, palette, transparent backgrounds and reuse across Shop / Board / Unit Info.
- All 14 factions/classes now have authored mask-friendly SVG sigils under `public/synergies/`; the same icon component appears in the Synergy list, mobile indicators, Unit Info and Game Archive.
- Combat effects now use fixed categories: single, piercing, chain, area, heal, control and shield. Player area/control cues are cyan/teal; enemy cues are coral/violet.

### Six counterplay units

- **Rift Breaker** — Void / Brawler — destroys shields before its heavy strike.
- **Mire Chemist** — Wild / Engineer — applies 55% healing reduction.
- **Signal Leech** — Cyber / Assassin — corrupts Mana on attacks and siphons the highest-Mana enemy.
- **Lantern Warden** — Underground / Support — shields and charges a threatened backliner.
- **Prism Hook** — Crystal / Assassin — pulls and briefly controls a distant target.
- **Coil Ranger** — Machine / Ranger — marks a high-Attack enemy and reflects a portion of all damage it deals.

Roster: 33 units. Combat engine: `combat-balance-0.9.0`. Replay format: v5.

### Hard AI and balance harness

- Hard AI scouts the player's public Board and values Assassins against Ranger/Arcanist backlines.
- It shifts Assassin lanes toward the visible carry side; against Assassins it pulls carries inward and can corner a durable bait unit.
- Low-cost 3-star chases gain a late-game stop condition, low-value empty Bench pieces are pruned, and mismatched equipment lowers Board-selection value.
- Personalities retain different economy/tempo/collection priorities and now have different threat-response strength.
- `npm run balance:matrix` runs mirrored fixed-seed matchups and prints a cross-win-rate table plus counters. `MATRIX_SEEDS=256 npm run balance:matrix` increases the sample size.

The current matrix is a diagnostic baseline, not a claim of solved balance. Strong Arcanist/Cyber shells remain explicit tuning warnings; future balance work should require at least two practical counters before calling a dominant shell healthy.

## Verification

- Next.js production build: **PASS**
- ESLint: **PASS**
- TypeScript regression suites: **PASS**
- Mirrored fixed-seed matchup harness: **PASS** (128 seeds per side/pairing used during this pass)
- Unit artwork: 320×320 transparent WebP assets; Synergy artwork: 14 authored SVG masks

## Authoritative modules

- UI / input / Board / Bench / Shop / guide / archive: `app/game.tsx`
- Units, items, traits, skill VFX and Synergy assets: `app/game-data.ts`
- Deterministic combat and replay: `app/battle-engine.ts`
- Planning AI: `app/ai-engine.ts`
- Matchup harness: `app/balance-matrix.ts`, `scripts/ai-matchup-matrix.ts`
- v0.9 presentation: `app/v09-art.css`
- Canonical project context: `PROJECT_STATE.md`

v0.9 is published from GitHub `main` and deployed to the existing Sites project.
