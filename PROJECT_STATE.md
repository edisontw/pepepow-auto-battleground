# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole project unless the task genuinely requires it.

**Last updated:** 2026-08-17  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.6  
**GitHub main:** v0.7 candidate; contains post-v0.6 UI/AI fixes plus combat-balance changes not yet verified as deployed

## 1. Product direction

- Browser-based auto-battler; desktop and mobile are first-class targets.
- Gameplay first. Do not add blockchain/payment/wallet features unless explicitly requested.
- Battle simulation is deterministic and independent from animation/rendering.
- The Board remains the primary visual focus; Shop, Bench, HUD, Equipment, and active synergies must remain reachable.
- AI difficulty comes from decision quality, not hidden economy, Shop, item, or stat advantages.

## 2. Current release state

v0.6 is the active deployed release. GitHub `main` is a v0.7 candidate containing responsive/AI fixes, refreshed unit art, and the combat-balance pass below. Do not describe v0.7 as deployed until Sites deployment is completed and verified.

## 3. Architecture invariants

### Simulation and rendering

- Simulation is authoritative; rendering only visualizes state.
- Frame rate must not affect results.
- Identical starting state plus deterministic seed must reproduce the same battle.
- UI values for buffs, synergies, odds, XP, and other gameplay rules must come from authoritative gameplay/config modules, not duplicate UI tables.
- Units may carry more than two traits. `traits[0]` remains the primary faction and `traits[1]` remains the primary combat role/class; additional traits are additive synergies.

### Input and drop resolution

- Shop purchase: click/tap.
- Owned-unit short tap/click: select.
- Stationary long press: Unit Info.
- Desktop right-click: Unit Info fallback.
- Owned-unit movement: drag-and-drop.
- Selling: explicit Sell Zone or explicit Sell action only.
- Invalid drops cancel and return the unit to its origin; they never imply a sale.
- Board → Bench moves the unit and never sells it.

Preferred drop resolution: valid Board → valid Bench → explicit Sell Zone → return to origin.

## 4. Combat and targeting

- Default targeting uses the nearest valid/reachable enemy with sticky targets and BFS pathing.
- Guardian Taunt can override normal targeting.
- Assassin first acquisition prioritizes the enemy backline; within the same backline depth it prioritizes Rangers.
- Active Assassin 2/3 adds +25% / +45% damage against Rangers on both basic attacks and skills. Existing 25% / 42% critical chance at 175% damage remains.
- Combat engine/replay version for this pass: `combat-balance-0.7.0`, replay v4.
- Historical Battle Archive inspection must not modify deterministic combat or replay behavior.

Regression risks: target flicker, living-unit overlap, corpse obstruction, stuck movement, duplicate animation damage, frame-rate-dependent results, and old replay display compatibility.

## 5. v0.7 combat balance

### Arcanist magic archetype

- Additive trait: `Arcanist`, thresholds 2/4.
- Arcanist 2: Arcanists start with +25 Mana and their skills are 15% stronger.
- Arcanist 4: Arcanists start with +45 Mana and their skills are 30% stronger.
- Skill-power amplification applies to damaging skills and healing skills; the generic combat field is `CombatUnit.skillPower`.
- Current Arcanists: Glow Medic, Volt Hacker, Circuit Sage, Wild Seer, Storm Hacker.
- Null Sovereign and Aurora Titan intentionally do not receive Arcanist, avoiding a direct buff to the previously dominant Ranger/Void legendary core.

### Wild

- Wild thresholds are 2/3; the previous second threshold of 4 was unreachable with only three unique Wild units.
- Wild 2/3 grants all allies +15% / +32% maximum Health.

### Support

- Support thresholds remain 2/3.
- Support healing amplification is +40% / +80%.
- Arcanist Support units can additionally benefit from Arcanist skill power, creating a deliberate sustain/magic composition.

### Assassin vs Ranger

- Assassin remains a backline role but now explicitly hunts Rangers within the same backline depth.
- Assassin 2/3 deals +25% / +45% damage to Rangers in addition to its existing critical mechanic.
- This is a universal combat rule for player and AI, not an AI-only bonus.

## 6. Progression, Shop, and economy

- Passive XP curve: `min(8, 1 + floor((round - 1) / 2))`.
- Shop tier-odds display and Shop roll logic share the same authoritative table.
- Full Bench can accept a purchase only when it atomically resolves into a valid upgrade.
- Merge overflow equipment is returned rather than lost.
- Shop OWNED / UPGRADE reminders, explicit Sell, and 1★ / 2★ / 3★ upgrades are active behavior.

Authoritative values live in code; do not copy or invent economy numbers in this file.

## 7. Buffs, synergies, and equipment

- Display numerical gameplay values whenever the underlying effect has one.
- Current Faction/Class/Trait rows show count, active tier/threshold, and actual active value.
- Values are derived from `TRAIT_DETAILS` and combat snapshots; do not maintain a second UI-only value table.
- Trait counting uses every trait on a unit, including additive third traits such as Arcanist.
- Mobile exposes Synergies and Equipment through compact expandable controls that do not permanently consume Board space.

## 8. Unit presentation / responsive layout

- Shop, Unit Info, Battle Archive, and identification views retain unit names; battlefield pieces remain art-forward with no name/pedestal.
- Desktop targets: 1920×1080, 1440×900, 1366×768.
- Mobile targets: 390×844, 375×812, 360×800, 412×915.
- `app/v06-overrides.css` is the final targeted override layer after `globals.css`.
- Current post-v0.6 fixes on main: horizontal low-height desktop Shop cards, larger key HUD/Shop/status text, and corrected mobile Board/Bench separation.
- v0.7 candidate hides the Board-corner synergy totems on desktop. On mobile, the same compact progress indicators are positioned above the Board boundary so they no longer cover playable cells.
- v0.7 candidate refreshes the WebP portraits for Glow Medic, Volt Hacker, Circuit Sage, Wild Seer, and Storm Hacker in `public/units/`.

## 9. Planning AI

- Personalities vary economy, rerolls, leveling, focus, and upgrade priorities.
- Easy primarily uses raw unit power and intentionally noisy evaluation.
- Normal uses composition-aware greedy Board selection.
- Hard uses low-noise candidate evaluation plus exhaustive legal Board-combination scoring, actual trait-threshold progress, focus/role pairings, front-line/damage coverage, and stronger leveling/reroll decisions.
- Because AI synergy evaluation iterates authoritative unit traits/`TRAIT_DETAILS`, Arcanist and the Wild 2/3 threshold are automatically considered without hidden bonuses.
- Hard additionally values Assassin counter-pressure and Wild/Support sustain when they improve a legal composition.
- The Hard-specific Wild second-tier heuristic is aligned to `wild >= 3`; the stale unreachable `wild >= 4` check was removed during the v0.7 review.
- AI uses the same Gold, XP, Shop odds, Bench cap, unit stats, traits, and combat rules as the player.

## 10. Battle statistics / Archive / audio

- Rankings use Top 5 for Damage Dealt, Healing Done, and Damage Taken.
- Battle Archive retains deterministic verification, enemy lineup, and historical inspection.
- Planning and Combat use phase-appropriate music; preference is persisted.
- Audio: `public/audio/planning.mp3`, `public/audio/combat.mp3`.

## 11. Authoritative modules

- App/game UI, input, Board/Bench/Sell, Unit Info, archive, audio: `app/game.tsx`
- Base responsive layout and unit visuals: `app/globals.css`
- v0.6/post-v0.6 targeted responsive overrides: `app/v06-overrides.css`
- Deterministic combat and combat snapshots: `app/battle-engine.ts`
- Units, items, traits, and `TRAIT_DETAILS`: `app/game-data.ts`
- Economy, progression, Shop odds, and game rules: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- Combat regressions: `tests/battle-engine.test.ts`
- AI regressions: `tests/ai-engine.test.ts`
- Targeted UI contract tests: `tests/ui-contract.test.ts`

## 12. Validation state

- v0.6 standard Node 22 validation passed before its deployment.
- v0.7 combat tests in source cover Assassin Ranger-target preference, Arcanist tier-two starting Mana/skill power, reachable Wild tier two, deterministic battle reproduction, BFS, sticky/forced targeting, and empty-side resolution.
- This targeted GitHub review confirmed the authoritative v0.7 trait/combat code and corrected the stale Hard-AI Wild `>=4` second-tier heuristic to `>=3`.
- Full `npm test`, broad battle simulation, and rendered viewport verification have not been executed from the GitHub connector environment; run them before declaring v0.7 deployed.

## 13. Known issues / next validation

- GitHub `main` v0.7 candidate has not yet been deployed to ChatGPT Sites.
- Run full build/tests before deployment because combat simulation changed.
- Run deterministic combat regression/stress proportional to the simulation change.
- Recheck desktop 1440×900 / 1366×768 and mobile 390×844 / 375×812 / 360×800 after deployment.
- Repeat physical iPhone Safari long-press smoke when convenient.
- The latest request ended with the incomplete phrase `移掉二星棋子的…`; no 2★ presentation/gameplay change was made. Resolve the missing wording before editing that behavior.

## 14. Next-task protocol

1. Read this file first.
2. Inspect only directly relevant modules and immediate dependencies.
3. Preserve deterministic combat and input/drop invariants.
4. For combat-engine changes, run deterministic/regression/stress coverage before release.
5. Verify visual changes with rendered screenshots, not DOM dimensions alone.
6. Publish through the existing Sites project only when deployment is requested and verify deployment status.
7. Update this same file concisely after meaningful changes.
