# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole project unless the task genuinely requires it.

**Last updated:** 2026-08-18  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.7  
**GitHub main:** v0.8 candidate; three new original Arcanist units are implemented and verified but not yet deployed

## 1. Product direction

- Browser-based auto-battler; desktop and mobile are first-class targets.
- Gameplay first. Do not add blockchain/payment/wallet features unless explicitly requested.
- Battle simulation is deterministic and independent from animation/rendering.
- The Board remains the primary visual focus; Shop, Bench, HUD, Equipment, and active synergies must remain reachable.
- AI difficulty comes from decision quality, not hidden economy, Shop, item, or stat advantages.

## 2. Current release state

v0.7 is the active Sites release. GitHub `main` is now the v0.8 candidate. v0.8 expands the roster from 24 to 27 units with three genuinely new Arcanist characters and dedicated combat behavior. Do not describe v0.8 as deployed until Sites deployment is explicitly completed.

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
- Assassin 2/3 adds +25% / +45% damage against Rangers on both basic attacks and skills. Existing 25% / 42% critical chance at 175% damage remains.
- Current combat engine: `combat-balance-0.8.0`; replay format remains v4.
- Historical Battle Archive inspection must not modify deterministic combat or replay behavior.

Regression risks: target flicker, living-unit overlap, corpse obstruction, stuck movement, duplicate animation damage, frame-rate-dependent results, and old replay display compatibility.

## 5. Arcanist and v0.7 balance baseline

### Arcanist

- Additive trait: `Arcanist`, thresholds remain 2/4 for v0.8.
- Arcanist 2: Arcanists start with +25 Mana and skills are 15% stronger.
- Arcanist 4: Arcanists start with +45 Mana and skills are 30% stronger.
- Skill-power amplification applies to damaging and healing skills through `CombatUnit.skillPower`.
- v0.7 Arcanists: Glow Medic, Volt Hacker, Circuit Sage, Wild Seer, Storm Hacker.
- Null Sovereign and Aurora Titan intentionally do not receive Arcanist.
- A possible 6-Arcanist capstone is deliberately deferred; the current trait/UI/AI model is two-tier and should not be broadened until the 27-unit pool is observed in play.

### Wild / Support / Assassin

- Wild thresholds: 2/3; all allies gain +15% / +32% maximum Health.
- Support thresholds: 2/3; healing amplification +40% / +80%.
- Assassin 2/3: Ranger counter damage +25% / +45% in addition to existing critical mechanics.

## 6. v0.8 — three new original Arcanists

### Arcane Apprentice

- Cost: 1 Gold.
- Traits: Machine / Support / Arcanist.
- Stats: 500 HP, 36 Attack, 12 Armor, Range 3.
- Skill: `Mana Ward`.
- Effect: heals the two lowest-health allies for 150% Attack and grants them 20 Mana. Arcanist skill power scales both the spell's healing and Mana grant.
- Purpose: inexpensive magic/sustain bridge without Ranger or Void.

### Rune Blaster

- Cost: 2 Gold.
- Traits: Crystal / Hacker / Arcanist.
- Stats: 570 HP, 68 Attack, 12 Armor, Range 4.
- Skill: `Rune Nova`.
- Effect: detonates across a 2-cell radius for 145% Attack damage, scaled by Arcanist skill power.
- Purpose: accessible magic AoE rather than another Ranger carry.

### Chrono Mage

- Cost: 4 Gold.
- Traits: Underground / Hacker / Arcanist.
- Stats: 790 HP, 88 Attack, 20 Armor, Range 3.
- Skill: `Time Lock`.
- Effect: deals 135% Attack damage around the locked target and stuns surviving targets for 1 tick, scaled by Arcanist skill power.
- Purpose: late-game magic control without adding another 5-Gold legendary.

### Pool impact

- Total roster: 27 units, up from 24.
- Added costs: one 1-Gold, one 2-Gold, one 4-Gold.
- 5-Gold pool remains Aurora Titan + Null Sovereign only.
- All three new units deliberately avoid `Ranger` and `Void`, reducing the risk of strengthening the previously dominant Ranger + Void legendary core.

## 7. Progression, Shop, and economy

- Passive XP curve: `min(8, 1 + floor((round - 1) / 2))`.
- Shop tier odds and Shop roll logic share the same authoritative table.
- Adding units expands the eligible unit pool within a cost tier; tier probability itself does not change.
- Full Bench can accept a purchase only when it atomically resolves into a valid upgrade.
- Merge overflow equipment is returned rather than lost.
- Shop OWNED / UPGRADE reminders, explicit Sell, and 1★ / 2★ / 3★ upgrades remain active behavior.
- Shop-odds regression fixtures must derive tier members from `UNITS`; do not hard-code a stale list of unit IDs.

## 8. Buffs, synergies, equipment, and presentation

- Numerical gameplay effects displayed in UI must be derived from `TRAIT_DETAILS` / combat snapshots.
- Trait counting includes all additive traits such as Arcanist.
- Mobile exposes Synergies and Equipment through compact expandable controls.
- Shop, Unit Info, Battle Archive, and identification views retain unit names; battlefield pieces are art-forward with no name/pedestal.
- Desktop targets: 1920×1080, 1440×900, 1366×768.
- Mobile targets: 390×844, 375×812, 360×800, 412×915.
- `app/v06-overrides.css` and `app/v07-overrides.css` remain the responsive override layers.
- v0.7 deployed presentation includes: desktop Board-corner synergy totems hidden; mobile indicators moved outside playable Board cells; 2★/3★ decorative glow removed while star labels remain; five mobile Shop cards fit simultaneously.
- v0.8 WebPs: `public/units/arcane-apprentice.webp`, `public/units/rune-blaster.webp`, `public/units/chrono-mage.webp`.
- These assets are 320×320 WebP images. Reproducible source: `scripts/generate-v08-unit-art.py`.

## 9. Planning AI

- Personalities vary economy, rerolls, leveling, focus, and upgrade priorities.
- Easy primarily uses raw unit power and intentionally noisy evaluation.
- Normal uses composition-aware greedy Board selection.
- Hard uses low-noise candidate evaluation plus exhaustive legal Board-combination scoring, actual trait-threshold progress, focus/role pairings, front-line/damage coverage, and stronger leveling/reroll decisions.
- AI Shop generation iterates `UNITS`, so all three v0.8 units enter AI shops automatically at the same legal cost-tier odds as the player.
- AI synergy evaluation iterates authoritative unit traits and `TRAIT_DETAILS`, so the new Arcanists are evaluated naturally without hidden bonuses.
- Hard additionally values Assassin counter-pressure and Wild/Support sustain when useful.
- Hard Wild second tier uses the reachable `wild >= 3` threshold.
- AI uses the same Gold, XP, Shop odds, Bench cap, unit stats, traits, and combat rules as the player.

## 10. Battle statistics / Archive / audio

- Rankings use Top 5 for Damage Dealt, Healing Done, and Damage Taken.
- Battle Archive retains deterministic verification, enemy lineup, and historical inspection.
- Planning and Combat use phase-appropriate music; preference is persisted.
- Audio: `public/audio/planning.mp3`, `public/audio/combat.mp3`.

## 11. Authoritative modules

- App/game UI, input, Board/Bench/Sell, Unit Info, archive, audio: `app/game.tsx`
- Base responsive layout and unit visuals: `app/globals.css`
- Responsive overrides: `app/v06-overrides.css`, `app/v07-overrides.css`
- Deterministic combat and combat snapshots: `app/battle-engine.ts`
- Units, items, traits, and `TRAIT_DETAILS`: `app/game-data.ts`
- Economy, progression, Shop odds, and game rules: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- Combat regressions: `tests/battle-engine.test.ts`
- AI regressions: `tests/ai-engine.test.ts`
- Game-rule regressions: `tests/game-rules.test.ts`
- Targeted UI contract tests: `tests/ui-contract.test.ts`
- v0.8 art source: `scripts/generate-v08-unit-art.py`

## 12. Validation state

- v0.7 is deployed to Sites per the completed deployment pass on 2026-08-18.
- v0.8 Next.js production build: PASS.
- v0.8 TypeScript regression suite (`node --import tsx --test tests/*.test.ts`): PASS.
- New v0.8 coverage verifies the three original units, no Ranger/Void traits on them, Arcanist tier-two behavior, Mana Ward Mana grant, Rune Nova radius-2 damage, Time Lock stun, deterministic replay, Shop odds, AI/game rules, and UI contracts.
- Initial targeted regression run exposed one stale test fixture that hard-coded the pre-v0.8 1-Gold roster. The test was corrected to derive all 1-Gold IDs from `UNITS`; the rerun passed.
- The legacy combined `npm test` command still includes `tests/rendered-html.test.mjs`, which expects the Sites/Vite `dist/server/index.js` artifact after a `next build`; this existing artifact mismatch is separate from v0.8. Do not report the combined command as PASS unless that test workflow is reconciled.
- No broad battle-simulation stress run or rendered viewport QA was performed for v0.8 in this implementation pass.

## 13. Known issues / next validation

- GitHub `main` v0.8 candidate has not yet been deployed to ChatGPT Sites.
- Before/with v0.8 deployment, do only proportional validation unless new problems are reported: confirm the three new portraits render in Shop/Board/Unit Info and smoke-test their three skills.
- Observe whether expanding the roster from 24 to 27 makes 2★/3★ upgrades noticeably too slow before changing Shop odds or copy-pool behavior.
- Observe Arcanist 2/4 performance before introducing a 6-unit capstone.
- A broad balance simulation is optional follow-up, not required for the source implementation itself.

## 14. Next-task protocol

1. Read this file first.
2. Inspect only directly relevant modules and immediate dependencies.
3. Preserve deterministic combat and input/drop invariants.
4. For combat-engine changes, run proportional deterministic/regression coverage before release.
5. Verify visual changes with rendered screenshots when presentation is changed.
6. Publish through the existing Sites project only when deployment is requested.
7. Update this same file concisely after meaningful changes.
