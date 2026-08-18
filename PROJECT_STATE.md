# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole repository unless the task genuinely requires it.

**Last updated:** 2026-08-18  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.7  
**GitHub main:** v0.8 candidate; not yet deployed

## 1. Product / architecture invariants

- Browser auto-battler; desktop and mobile are first-class targets.
- Simulation is authoritative and deterministic; rendering/animation must not change battle results.
- Identical starting state + seed must reproduce the same battle.
- AI difficulty comes from decision quality, never hidden Gold/XP/Shop/stat advantages.
- Units may have additive traits beyond their primary faction (`traits[0]`) and combat role (`traits[1]`).
- UI gameplay values should come from authoritative gameplay/config modules, not duplicate tables.
- Avoid heavyweight true-3D rendering; use polished 2.5D/CSS/image presentation.

## 2. Input / Board invariants

- Shop: tap/click to buy.
- Owned unit: short tap/click selects; stationary long press opens Unit Info; desktop right-click is fallback.
- Movement uses drag-and-drop.
- Sell only through an explicit Sell action/zone.
- Invalid drop returns to origin; Board → Bench never sells.
- Preferred drop resolution: Board → Bench → explicit Sell → return to origin.

## 3. Current combat baseline

- Combat engine: `combat-balance-0.8.0`; replay format v4.
- Targeting: nearest reachable enemy with sticky targets and BFS pathing.
- Guardian Taunt may override targeting.
- Assassin opening acquisition prioritizes enemy backline and Rangers at equal depth.
- Assassin 2/3: +25% / +45% damage to Rangers plus existing critical mechanic.
- Wild 2/3: all allies +15% / +32% max HP.
- Support 2/3: healing +40% / +80%.

Regression risks: target flicker, living-unit overlap, corpse obstruction, stuck movement, duplicate animation damage, frame-rate-dependent results, replay incompatibility.

## 4. Arcanist

Arcanist remains a two-tier additive trait for v0.8:

- 2 Arcanist: +25 starting Mana, skills +15%.
- 4 Arcanist: +45 starting Mana, skills +30%.
- Skill power applies to compatible damage/healing effects through `CombatUnit.skillPower`.
- Existing Arcanists: Glow Medic, Volt Hacker, Circuit Sage, Wild Seer, Storm Hacker.
- Null Sovereign and Aurora Titan intentionally remain non-Arcanist.
- A 6-Arcanist capstone is deferred until the expanded roster is observed in play.

## 5. v0.8 roster additions

Roster expands from 24 → 27 units:

- **Arcane Apprentice** — 1 Gold — Machine / Support / Arcanist — `Mana Ward`: heals two lowest-health allies and grants Mana.
- **Rune Blaster** — 2 Gold — Crystal / Hacker / Arcanist — `Rune Nova`: radius-2 AoE magic damage.
- **Chrono Mage** — 4 Gold — Underground / Hacker / Arcanist — `Time Lock`: area damage + 1-tick stun.

All three intentionally avoid Ranger and Void. The 5-Gold pool remains Aurora Titan + Null Sovereign.

Current final portraits:

- `public/units/arcane-apprentice.webp`
- `public/units/rune-blaster.webp`
- `public/units/chrono-mage.webp`

They are visually separated by palette for Board readability: green, pink/magenta, and dark blue/purple respectively.

## 6. v0.8 battle presentation

Latest rendering-only polish on GitHub `main`:

- New dimensional board asset: `public/battle-board-v08.webp`.
- `app/v08-overrides.css` crops the new board art behind the authoritative 8×6 DOM grid; DOM cells remain responsible for placement/input/combat positioning.
- Battlefield Mana bars are hidden for cleaner reading; Mana still exists in simulation and detailed stats.
- HP is the only persistent battlefield resource bar and is slightly stronger/readable.
- Attack, cast, hit, impact and floating-number presentation are slightly punchier without changing combat timing or results.
- Mobile reduces glow/filter intensity to preserve character clarity.
- v0.7 presentation remains: desktop Board-corner synergy totems hidden; mobile indicators outside playable Board cells; 2★/3★ decorative glow removed; five Shop cards fit supported phone widths.

Responsive targets:

- Desktop: 1920×1080, 1440×900, 1366×768.
- Mobile: 390×844, 375×812, 360×800, 412×915.

## 7. Progression / Shop / AI

- Passive XP: `min(8, 1 + floor((round - 1) / 2))`.
- Shop tier odds and Shop roll logic share one authoritative table.
- Adding units expands eligible units within cost tiers; tier probabilities themselves are unchanged.
- Full Bench purchase is allowed only if the purchase atomically resolves into a legal upgrade.
- Merge overflow equipment is returned, not lost.
- Shop odds tests must derive tier members from `UNITS`, never hard-code old rosters.
- AI Shop generation and synergy evaluation iterate `UNITS` / `TRAIT_DETAILS`, so v0.8 units enter AI logic naturally.
- Hard AI uses composition-aware legal Board selection, low-noise candidate scoring, synergy progress, counter-pressure and sustain evaluation while obeying the same rules/resources as player.

## 8. Authoritative modules

- Main UI / input / Board / Bench / Shop / archive / audio: `app/game.tsx`
- Base visuals: `app/globals.css`
- Responsive/presentation overrides: `app/v06-overrides.css`, `app/v07-overrides.css`, `app/v08-overrides.css`
- Units / traits / items / synergy definitions: `app/game-data.ts`
- Combat / snapshots / replay: `app/battle-engine.ts`
- Economy / progression / Shop odds: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- Tests: `tests/`

## 9. Validation state / next step

- v0.8 Next.js production build previously passed before the latest rendering-only CSS change.
- v0.8 TypeScript regression suite previously passed after roster/skill implementation.
- Latest Board/HP/effects change is CSS/import-only; no combat-engine logic changed, so broad battle simulations are not warranted.
- No rendered viewport QA has yet been performed for the new board asset.
- Before Sites deployment, only proportional visual QA is needed: confirm board crop/alignment, character readability, HP-only battlefield display, and 3 new portraits on representative desktop/mobile widths.
- GitHub `main` v0.8 is not yet deployed to Sites.

## 10. Next-task protocol

1. Read this file first.
2. Inspect only directly relevant modules and dependencies.
3. Preserve deterministic combat and input/drop invariants.
4. Match testing effort to the actual modification.
5. For presentation changes, prefer rendered screenshots over broad code audits.
6. Deploy through the existing Sites/vinext workflow only when explicitly requested.
7. Update this same file after meaningful changes.
