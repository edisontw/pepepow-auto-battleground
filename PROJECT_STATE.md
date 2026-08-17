# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole project unless the task genuinely requires it.

**Last updated:** 2026-08-17  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.6  
**GitHub main:** contains post-v0.6 fixes not yet verified as deployed

## 1. Product direction

- Browser-based auto-battler; desktop and mobile are first-class targets.
- Gameplay first. Do not add blockchain/payment/wallet features unless explicitly requested.
- Battle simulation is deterministic and independent from animation/rendering.
- The Board remains the primary visual focus; Shop, Bench, HUD, Equipment, and active synergies must remain reachable.
- AI difficulty comes from decision quality, not hidden economy, Shop, item, or stat advantages.

## 2. Current release state

v0.6 is the active deployed release. It preserves v0.5 gameplay and adds:

- synergy totems on the Board
- randomized opening units
- a compact mobile Shop
- mobile XP display, larger Level, and clearer Gold
- removal of mobile unit bases
- a smaller desktop Shop and Bench with a larger Board

The v0.5 responsive, input, archive, and battlefield presentation improvements remain active.

## 3. Architecture invariants

### Simulation and rendering

- Simulation is authoritative; rendering only visualizes state.
- Frame rate must not affect results.
- Identical starting state plus deterministic seed must reproduce the same battle.
- UI values for buffs, synergies, odds, XP, and other gameplay rules must come from authoritative gameplay/config modules, not duplicate UI tables.

### Input and drop resolution

- Shop purchase: click/tap.
- Owned-unit short tap/click: select.
- Stationary long press: Unit Info.
- Desktop right-click: Unit Info fallback.
- Owned-unit movement: drag-and-drop.
- Selling: explicit Sell Zone or explicit Sell action only.
- Invalid drops cancel and return the unit to its origin; they never imply a sale.
- Board → Bench moves the unit and never sells it.

Preferred drop resolution:

1. valid Board destination
2. valid Bench destination
3. explicit Sell Zone
4. otherwise return to origin

## 4. Combat and targeting

- Default targeting uses the nearest valid/reachable enemy.
- Target stickiness prevents unnecessary retargeting.
- BFS handles blocked paths.
- Guardian Taunt can override normal targeting.
- Assassin may prioritize the enemy backline at battle start.
- Historical Battle Archive inspection must not modify deterministic combat or replay behavior.

Regression risks: target flicker, living-unit overlap, corpse obstruction, stuck movement, duplicate animation damage, and frame-rate-dependent results.

## 5. Progression, Shop, and economy

- Passive XP curve: `min(8, 1 + floor((round - 1) / 2))`.
- Shop tier-odds display and Shop roll logic share the same authoritative table.
- Full Bench can accept a purchase only when it atomically resolves into a valid upgrade.
- Merge overflow equipment is returned rather than lost.
- Shop OWNED / UPGRADE reminders, explicit Sell, and 1★ / 2★ / 3★ upgrades are active behavior.

Authoritative values live in code; do not copy or invent economy numbers in this file.

## 6. Unit presentation

- Shop, Unit Info, Battle Archive, and other identification views retain unit names.
- Battlefield units are art-forward chess pieces: names are removed and pedestal/base visuals are removed.
- Battlefield HP bars are deliberately stronger and easier to scan; Mana remains readable.
- 1★ / 2★ / 3★ differentiation and selection state remain clear.
- Compact Bench presentation may retain its own label/base treatment on desktop; mobile bases remain removed.
- Do not introduce heavyweight true 3D rendering.

## 7. Buffs, synergies, and equipment

- Display numerical gameplay values whenever the underlying effect has one.
- Current Faction/Class/Trait rows show count, active tier/threshold, and actual active value.
- Values are derived from `TRAIT_DETAILS` and combat snapshots; do not maintain a second UI-only value table.
- Mobile exposes Synergies and Equipment through compact expandable controls that do not permanently consume Board space.
- Unit Info uses the same practical stat/buff/equipment presentation for live and historical units.

## 8. Planning warning

- During Planning, show `BOARD NOT FULL — current / cap` whenever deployed count is below the current limit.
- It is static, non-spamming, does not auto-deploy, and disappears immediately when the Board is full.

## 9. Battle statistics and Archive

- Rankings use Top 5 and cover Damage Dealt, Healing Done, and Damage Taken.
- Battle Archive retains deterministic verification and round history.
- Each record exposes the enemy lineup.
- Historical enemy inspection uses recorded combat state/stats and reuses Unit Info presentation.

## 10. Responsive layout

- Desktop targets: 1920×1080, 1440×900, and 1366×768.
- Board sizing is height-aware; low-height desktops compact secondary chrome before shrinking the Board excessively.
- Mobile portrait targets: 390×844, 375×812, 360×800, and 412×915.
- The mobile status dock provides expandable Synergies and Equipment.
- `app/v06-overrides.css` is the final targeted override layer after `globals.css`; when fixing responsive regressions, check inherited earlier media rules before adding more conflicting rules.
- Do not reintroduce battlefield names or pedestals to solve spacing.

## 11. Planning AI

- Personalities still vary economy, rerolls, leveling, focus, and upgrade priorities.
- Easy primarily uses raw unit power and intentionally noisy evaluation.
- Normal uses composition-aware greedy Board selection.
- Hard uses low-noise candidate evaluation plus exhaustive legal Board-combination scoring, actual trait-threshold progress, focus/role pairings, front-line/damage coverage, and stronger leveling/reroll decisions.
- Hard gives strategic preference to Assassin counter-pressure and to Wild/Support sustain when they improve a legal composition; this is planning preference, not a hidden combat bonus.
- Hard Assassin formation favors edge-forward deployment to reach protected backlines sooner.
- AI must use the same Gold, XP, Shop odds, Bench cap, unit stats, and combat rules as the player. Do not grant hidden items/resources or inspect information the player could not know.

## 12. Audio

- Planning and Combat use phase-appropriate music.
- Music preference is persisted.
- Audio files: `public/audio/planning.mp3`, `public/audio/combat.mp3`.

## 13. Authoritative modules

- App/game UI, input, Board/Bench/Sell, Unit Info, archive, audio: `app/game.tsx`
- Base responsive layout and unit visuals: `app/globals.css`
- v0.6/post-v0.6 targeted responsive overrides: `app/v06-overrides.css`
- Deterministic combat and combat snapshots: `app/battle-engine.ts`
- Units, items, traits, and `TRAIT_DETAILS`: `app/game-data.ts`
- Economy, progression, Shop odds, and game rules: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- AI regressions: `tests/ai-engine.test.ts`
- Targeted UI contract tests: `tests/ui-contract.test.ts`
- Board/Bench/Sell and rule regressions: `tests/game-rules.test.ts`

## 14. Validation baseline

- v0.5 production checkpoint build and targeted UI/game-rule tests passed, with screenshots at the documented desktop/mobile target sizes.
- v0.6 standard Node 22 validation passed `npm ci`, lint, `next build`, and HTTP dev-server smoke before deployment.
- Post-v0.6 AI extraction/simulation check: Hard produced materially higher cumulative synergy planning than Normal across sampled seeds while keeping legal Gold/Board/Bench state; regression coverage now encodes this expectation.
- Post-v0.6 UI fixes still require rendered target-viewport verification after deployment; do not mark them visually verified from CSS inspection alone.

## 15. Known issues / balance backlog

- GitHub `main` post-v0.6 UI and AI changes have not yet been verified on the deployed Sites build.
- Repeat physical iPhone Safari long-press smoke when convenient.
- Balance direction for a later combat pass: add a magic-oriented archetype; make Assassin a clearer Ranger counter; improve Wild and Support viability. Do not silently implement these as hidden AI-only advantages.

## 16. Post-v0.6 changes currently on GitHub main

- Windows/low-height desktop Shop cards are horizontal instead of squeezing character art into a short stacked image row; unit image uses contained bottom alignment and text sizing is increased.
- Key desktop/mobile HUD, Shop, synergy, status-dock, and action text/numbers are enlarged from the overly compressed v0.6 values.
- Mobile Board resets the inherited tall portrait aspect ratio and explicitly reserves separate Board, Bench, and notice rows so the sixth Board row cannot extend underneath the Bench.
- Hard AI now evaluates real synergy thresholds and legal whole-Board compositions, levels/rerolls more purposefully, and adds Assassin/Wild/Support role pressure while preserving fair resources.
- `tests/ai-engine.test.ts` includes a multi-seed Hard-vs-Normal synergy-planning regression plus legality checks.

## 17. Next-task protocol

1. Read this file first.
2. Reproduce only the reported/current issue; inspect directly relevant modules and immediate dependencies.
3. Preserve deterministic combat and input/drop invariants.
4. Keep testing proportional; do not rerun the 1,000-seed stress suite unless simulation behavior changes.
5. Verify visual changes with rendered screenshots, not DOM dimensions alone.
6. Publish through the existing Sites project when deployment is requested and verify deployment status.
7. Update this same file concisely after meaningful changes.
