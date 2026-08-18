# PEPEPOW Auto Battleground

Browser-based auto battler built with Next.js-compatible app code and the ChatGPT Sites / vinext deployment workflow.

- Repository source of truth: GitHub `main`
- Current source status: **v0.8 candidate**
- Deployed Sites release: **v0.7**
- Site: `https://pepepow-auto-battleground.edisonhuang.chatgpt.site/`

## v0.8 candidate — three original Arcanists

v0.8 expands the roster from 24 to 27 units with three genuinely new playable characters rather than only adding traits to existing units:

- **Arcane Apprentice** — 1 Gold — Machine / Support / Arcanist
  - Mana Ward: heals the two lowest-health allies for 150% Attack and grants them 20 Mana; Arcanist skill power scales the effect.
- **Rune Blaster** — 2 Gold — Crystal / Hacker / Arcanist
  - Rune Nova: detonates across a 2-cell radius for 145% Attack damage.
- **Chrono Mage** — 4 Gold — Underground / Hacker / Arcanist
  - Time Lock: deals 135% Attack damage around the target and stuns surviving targets for 1 tick.

Each unit has its own 320×320 WebP portrait in `public/units/`. The reproducible art source is `scripts/generate-v08-unit-art.py`.

The three new units deliberately avoid `Ranger` and `Void`, so they do not directly strengthen the previously dominant Ranger + Void legendary core. The 5-Gold legendary pool is unchanged.

### Arcanist remains 2 / 4

For this candidate the authoritative Arcanist thresholds remain:

- 2 Arcanist: +25 starting Mana and +15% skill effect
- 4 Arcanist: +45 starting Mana and +30% skill effect

A possible 6-Arcanist capstone is intentionally deferred. Adding it would require a broader three-tier trait/UI/AI data-model change and should be evaluated after observing the expanded roster.

Combat engine: `combat-balance-0.8.0`. Replay format remains v4.

## v0.7 deployed baseline

The deployed v0.7 release already includes:

- additive Arcanist on Glow Medic, Volt Hacker, Circuit Sage, Wild Seer, and Storm Hacker
- Assassin priority/counter damage against Rangers
- reachable Wild `2 / 3` thresholds and stronger Support healing
- desktop Board-corner synergy totems removed; mobile indicators moved outside playable Board cells
- 2★ / 3★ decorative glow removed while star labels remain
- five-card mobile Shop fit at the supported phone widths

## Verification

For the v0.8 candidate:

- Next.js production build: **PASS**
- TypeScript regression suite (`tests/*.test.ts`): **PASS**
- New regressions cover all three new units, Mana Ward, Rune Nova, Time Lock, Arcanist rules, deterministic combat, Shop odds, AI/game rules, and UI contracts.

The legacy combined `npm test` command also invokes `tests/rendered-html.test.mjs`, which expects the Sites/Vite `dist/server/index.js` artifact even though the command first runs `next build`; that artifact mismatch is separate from the v0.8 combat implementation. The production build and applicable TypeScript regressions passed independently.

## Authoritative modules

- Main game UI / input / Board / Bench / Shop / guide / archive: `app/game.tsx`
- Units, items, traits, synergy thresholds and descriptions: `app/game-data.ts`
- Economy and progression: `app/game-rules.ts`
- Deterministic combat and replay: `app/battle-engine.ts`
- Planning AI: `app/ai-engine.ts`
- Responsive overrides: `app/v06-overrides.css`, `app/v07-overrides.css`
- Regression tests: `tests/`
- Canonical project context: `PROJECT_STATE.md`

v0.8 is not deployed to Sites until explicitly published.