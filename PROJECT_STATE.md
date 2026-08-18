# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole repository unless the task genuinely requires it.

**Last updated:** 2026-08-18  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.8  
**GitHub main:** post-v0.8 polish candidate; current GitHub changes described below are not yet redeployed

## 1. Product / architecture invariants

- Browser auto-battler; desktop and mobile are first-class targets.
- Simulation is authoritative and deterministic; rendering/animation must not change battle results.
- Identical starting state + seed must reproduce the same battle.
- AI difficulty comes from decision quality, never hidden Gold/XP/Shop/stat advantages.
- Units may have additive traits beyond primary faction (`traits[0]`) and combat role (`traits[1]`).
- UI gameplay values should come from authoritative gameplay/config modules, not duplicate tables.
- Avoid heavyweight true-3D rendering; use polished 2.5D/CSS/image presentation.

## 2. Input / Board invariants

- Shop: tap/click to buy.
- Owned unit: short tap/click selects; stationary long press opens Unit Info; desktop right-click is fallback.
- Movement uses drag-and-drop.
- Sell only through an explicit Sell action/zone.
- Invalid drop returns to origin; Board → Bench never sells.
- Preferred drop resolution: Board → Bench → explicit Sell → return to origin.

## 3. Combat baseline

- Combat engine: `combat-balance-0.8.0`; replay format v4.
- Targeting: nearest reachable enemy with sticky targets and BFS pathing.
- Guardian Taunt may override targeting.
- Assassin opening acquisition prioritizes enemy backline and Rangers at equal depth.
- Assassin 2/3: +25% / +45% damage to Rangers plus existing critical mechanic.
- Wild 2/3: all allies +15% / +32% max HP.
- Support 2/3: healing +40% / +80%.
- Arcanist 2/4: +25/+45 starting Mana and +15%/+30% skill effect.

Regression risks: target flicker, living-unit overlap, corpse obstruction, stuck movement, duplicate animation damage, frame-rate-dependent results, replay incompatibility.

## 4. v0.8 roster

Roster: 27 units.

Newest Arcanists:

- **Arcane Apprentice** — 1 Gold — Machine / Support / Arcanist — `Mana Ward`.
- **Rune Blaster** — 2 Gold — Crystal / Hacker / Arcanist — radius-2 `Rune Nova` AoE.
- **Chrono Mage** — 4 Gold — Underground / Hacker / Arcanist — area damage + 1-tick `Time Lock` stun.

Other Arcanists: Glow Medic, Volt Hacker, Circuit Sage, Wild Seer, Storm Hacker. Null Sovereign and Aurora Titan remain non-Arcanist. A 6-Arcanist capstone remains deferred.

## 5. Board / combat presentation

- Board asset: `public/battle-board-v08.webp`.
- Authoritative placement is the 8×6 DOM grid; decorative painted tiles must never imply different legal coordinates.
- Post-v0.8 CSS de-emphasizes painted tile lines and strengthens the real DOM cell surfaces/borders so pieces visually sit on the legal cells.
- Battlefield Mana bars remain hidden; Mana is still simulated and visible in Unit Info.
- HP is the only persistent battlefield resource bar and is now always green rather than red/yellow/green by percentage.
- Existing projectile events are rendered more clearly for ranged and magic attacks. Area/global skills already emit one projectile per affected target, so multi-target fan-out is presentation-only.
- Mobile no longer suppresses projectile VFX entirely; it uses a lighter projectile treatment.
- Attack/cast/hit/impact motion remains rendering-only and does not change combat timing.
- Desktop Board-corner synergy totems remain hidden; mobile indicators remain outside playable Board cells.
- Synergy list / mobile indicator styling now uses a clearer blue/glass presentation inspired by the current visual reference.

## 6. Readability / responsive presentation

- Desktop small labels and numeric text receive a moderate readability increase without changing major panel dimensions.
- Guide, Archive, Unit Info, synergy, Shop and other explanatory text receive larger desktop sizes.
- Existing scroll areas remain the overflow mechanism where more text no longer fits.
- Desktop targets: 1920×1080, 1440×900, 1366×768.
- Mobile targets: 390×844, 375×812, 360×800, 412×915.
- v0.7 presentation still applies: 2★/3★ decorative glow removed and all five Shop cards fit supported phone widths.

## 7. Progression / Shop / economy

- Passive XP: `min(8, 1 + floor((round - 1) / 2))`.
- Shop tier odds and Shop roll logic share one authoritative table.
- Adding units changes eligible members within cost tiers; tier probabilities are unchanged.
- Full Bench purchase is allowed only if the purchase atomically resolves into a legal upgrade.
- Merge overflow equipment is returned, not lost.
- Shop odds tests must derive tier members from `UNITS`, never hard-code old rosters.

## 8. Planning AI

- AI uses the same economy, Shop odds, unit stats and level rules as the player.
- Hard AI now has lower decision noise, stronger preference for coherent frontline + damage + sustain formations, and additional value for Assassin/Wild/Support/Guardian/Arcanist breakpoints.
- Hard AI is more willing to level and reroll under pressure (low HP or loss streak) instead of over-protecting Interest.
- Hard support units favor protected middle/back positions; Assassin lanes remain edge-biased for backline access.
- Hard AI can sell one low-value 1★ unequipped Bench unit at the normal refund when a full Bench blocks a strategically useful purchase. Upgrade-near, focused, high-cost and active-synergy pieces receive higher keep scores.
- AI must still never receive hidden Gold, XP, Shop, item, stat or combat advantages.

## 9. Authoritative modules

- Main UI / input / Board / Bench / Shop / archive / audio: `app/game.tsx`
- Base visuals: `app/globals.css`
- Responsive/presentation overrides: `app/v06-overrides.css`, `app/v07-overrides.css`, `app/v08-overrides.css`
- Units / traits / items / synergy definitions: `app/game-data.ts`
- Combat / snapshots / replay: `app/battle-engine.ts`
- Economy / progression / Shop odds: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- Tests: `tests/`

## 10. Validation / next step

- The deployed v0.8 site predates the current post-v0.8 GitHub polish in `app/v08-overrides.css` and `app/ai-engine.ts`.
- Current changes have not yet been built, rendered, battle-simulated, or redeployed in this task.
- Before deployment, proportional verification should cover: TypeScript/build, AI legality/regression tests, representative Hard-AI simulations, desktop text fit, Board/grid visual alignment, green HP bars, projectile visibility, and representative desktop/mobile screenshots.
- No combat-engine logic changed, so deterministic combat balance stress tests are not required solely for the VFX/readability changes; AI simulations are warranted because planning logic changed.

## 11. Next-task protocol

1. Read this file first.
2. Inspect only directly relevant modules and dependencies.
3. Preserve deterministic combat and input/drop invariants.
4. Match testing effort to the actual modification.
5. For presentation changes, prefer rendered screenshots over broad code audits.
6. Deploy through the existing Sites/vinext workflow only when explicitly requested.
7. Update this same file after meaningful changes.
