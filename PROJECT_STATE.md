# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole project unless the task genuinely requires it.

**Last updated:** 2026-08-15  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.5

## 1. Product direction

- Browser-based auto-battler; desktop and mobile are first-class targets.
- Gameplay first. Do not add blockchain/payment/wallet features unless explicitly requested.
- Battle simulation is deterministic and independent from animation/rendering.
- The Board remains the primary visual focus; Shop, Bench, HUD, Equipment, and active synergies must remain reachable.
- AI difficulty comes from decision quality, not hidden economy, Shop, or stat advantages.

## 2. Current release state

v0.5 is the active release. It preserves v0.4 gameplay and adds:

- desktop viewport fitting at 1920×1080, 1440×900, and 1366×768 without clipping the Shop, Bench, Board, or HUD
- scoped suppression of native image/context interactions on draggable game pieces while retaining tap, long press, drag, and desktop right-click
- compact expandable Equipment and active-synergy interfaces on mobile
- battlefield pieces with no name label and no pedestal/base, larger character art, stronger HP bars, readable Mana, clear stars, and clear selection
- numeric values for displayed team buffs and synergy tiers sourced from the same gameplay configuration/snapshot used by combat
- planning-phase `BOARD NOT FULL — deployed / cap` warning that clears immediately at capacity
- Battle Archive enemy-lineup inspection using the recorded battle snapshot and recorded combat statistics
- a non-button decorative defeat mark instead of a misleading close “X”

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
- Compact Bench presentation may retain its own label/base treatment.
- Do not introduce heavyweight true 3D rendering.

## 7. Buffs, synergies, and equipment

- Display numerical gameplay values whenever the underlying effect has one: attack, attack speed, armor, shield, healing, stacks, duration, or tier bonus.
- Current Faction/Class/Trait rows show count, active tier/threshold, and actual active value.
- Values are derived from `TRAIT_DETAILS` and combat snapshots; do not maintain a second UI-only value table.
- Mobile exposes Synergies and Equipment through compact expandable controls that do not permanently consume Board space.
- Unit Info uses the same practical stat/buff/equipment presentation for live and historical units.

## 8. Planning warning

- During Planning, show `BOARD NOT FULL — current / cap` whenever deployed count is below the current limit.
- The warning is especially prominent when a usable Bench unit exists.
- It is static, non-spamming, does not auto-deploy, and disappears immediately when the Board is full.

## 9. Battle statistics and Archive

- Rankings use Top 5 and cover Damage Dealt, Healing Done, and Damage Taken.
- Battle Archive retains deterministic verification and round history.
- Each record exposes the enemy lineup.
- Enemy inspection uses the first recorded combat frame plus recorded result stats where available, so HP, attack, attack speed, armor, range, equipment, buffs/synergies, Damage Dealt, Healing Done, and Damage Taken describe the enemy as fought.
- Historical inspection reuses Unit Info presentation rather than maintaining a separate stats UI.

## 10. Responsive layout

- Desktop layout fits the useful viewport at 1920×1080, 1440×900, and 1366×768.
- Board sizing is height-aware; low-height desktops compact secondary chrome before shrinking the Board excessively.
- Mobile portrait keeps the Board, Bench, under-deployment notice, status dock, and Shop reachable at 390×844, 375×812, 360×800, and 412×915.
- The mobile status dock provides expandable Synergies and Equipment.
- Do not reintroduce battlefield names or pedestals to solve spacing.

## 11. Audio

- Planning and Combat use phase-appropriate music.
- Music preference is persisted.
- Audio files: `public/audio/planning.mp3`, `public/audio/combat.mp3`.

## 12. Authoritative modules

- App/game UI, input, Board/Bench/Sell, Unit Info, archive, audio: `app/game.tsx`
- Responsive layout and unit visuals: `app/globals.css`
- Deterministic combat and combat snapshots: `app/battle-engine.ts`
- Units, items, traits, and `TRAIT_DETAILS`: `app/game-data.ts`
- Economy, progression, Shop odds, and game rules: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- Targeted UI contract tests: `tests/ui-contract.test.ts`
- Board/Bench/Sell and rule regressions: `tests/game-rules.test.ts`

## 13. v0.5 validation baseline

- Production checkpoint build passed.
- Targeted UI and game-rule tests passed.
- Desktop screenshots inspected at 1920×1080, 1440×900, and 1366×768.
- Mobile screenshots inspected at 390×844, 375×812, 360×800, and 412×915.
- Mouse/touch smoke covered selection, drag, Board → Bench, explicit Sell, Shop purchase, Unit Info, and scoped long-press handling.
- Multi-round smoke covered phase changes, music, battle results, Top 5, and Battle Archive historical enemy inspection.
- No combat balance or deterministic simulation rules were changed; the 1,000-seed stress test was intentionally not rerun.

## 14. Known issues

- No confirmed v0.5 release blocker.
- Device-specific follow-up: repeat the long-press smoke test on physical iPhone Safari when convenient; implementation now prevents default native actions only on interactive unit pieces and preserves normal browser behavior elsewhere.

## 15. v0.6 source on main (not yet deployed)

- Opening player units are randomized from distinct 1-cost units using the expedition seed instead of always starting with Tunnel Guard + Pickaxe Scout.
- Board now shows compact live synergy-progress totems sourced from the existing authoritative synergy rows.
- Mobile HUD restores visible XP, emphasizes level and Gold, shrinks the Shop/status footprint, and removes remaining mobile piece bases including Bench bases.
- Desktop Shop and Bench chrome are reduced to return more vertical space to the Board.
- GitHub `main` uses standard Next.js for default `dev`, `build`, `start`, and lint so external editors such as Google AI Studio can import and run it. ChatGPT Sites-specific vinext/Vite commands remain available as `dev:sites`, `build:sites`, `start:sites`, and `lint:sites`.
- Standard Node 22 validation passed `npm ci`, lint, `next build`, and an HTTP dev-server smoke test after excluding Sites-only `worker/`, `db/`, `build/`, `vite.config.ts`, and `drizzle.config.ts` from the ordinary Next TypeScript project.

## 16. Next-task protocol

1. Read this file first.
2. Reproduce the reported issue in the current deployed build.
3. Inspect only the directly relevant modules and immediate dependencies.
4. Preserve deterministic combat and the input/drop invariants.
5. Keep testing proportional; do not rerun the 1,000-seed stress suite unless simulation behavior changes.
6. Verify visual changes with rendered screenshots, not DOM dimensions alone.
7. Publish through the existing Sites project and verify the deployment status.
8. Update this same file concisely after the release.
