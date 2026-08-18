# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole repository unless the task genuinely requires it.

**Last updated:** 2026-08-19  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.8  
**Currently deployed commit:** `2169fbc89ddb847f402b499d8da6f56297fecb91`  
**GitHub main:** contains the post-deploy fixes below; these follow-up changes are not yet redeployed

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
- Battlefield Mana bars remain hidden; Mana is still simulated and visible in Unit Info.
- HP is the only persistent battlefield resource bar and is always green.
- Ranged / magic attacks use projectile events already emitted by deterministic combat; AoE/global skills fan out visually to affected targets without changing damage logic.
- Player and enemy pieces now have restrained team distinction: player green edge/glow cues and enemy red edge/glow/star cues while HP fill remains green for both.
- Desktop Board-corner synergy totems remain hidden; mobile totems stay outside playable cells.
- Mobile totems now map every trait to an explicit colored symbol using the trait name already present in their title attribute instead of relying on a first-letter placeholder.

## 6. Replay / responsive presentation

- Full-screen Replay remains independent of the normal in-game Board sizing rules.
- Desktop Replay has explicit 8:6 geometry and viewport-based width/height guards so generic low-height Board rules cannot collapse it to a tiny center board.
- Desktop targets: 1920×1080, 1440×900, 1366×768.
- Mobile targets: 390×844, 375×812, 360×800, 412×915.
- `app/v08-fixes.css` is loaded after `v08-overrides.css` for narrowly scoped post-deploy corrections.
- Site metadata description has been updated to v0.8.

## 7. Progression / Shop / economy

- Passive XP: `min(8, 1 + floor((round - 1) / 2))`.
- Shop tier odds and Shop roll logic share one authoritative table.
- Adding units changes eligible members within cost tiers; tier probabilities are unchanged.
- Full Bench purchase is allowed only if the purchase atomically resolves into a legal upgrade.
- Merge overflow equipment is returned, not lost.
- Shop odds tests must derive tier members from `UNITS`, never hard-code old rosters.

## 8. Planning AI

- AI uses the same economy, Shop odds, unit stats and level rules as the player.
- Hard AI still values coherent frontline + damage + sustain formations and Assassin/Wild/Support/Guardian/Arcanist breakpoints.
- Late Hard AI (level 7+) now evaluates synergy progress from its active fighting core rather than spare Bench units, preventing phantom Bench synergies from driving lineup changes.
- Mature late-game formations use hysteresis: the current Board is retained unless a candidate composition is materially stronger; multi-unit swaps require a larger gain.
- Selected late-game core units retain their valid existing positions when possible instead of being fully re-laid every planning round.
- Late Hard purchases are restricted to meaningful upgrades/core copies, active-synergy breakpoints, aligned 3-cost pieces, or 4/5-cost carries; low-value novelty purchases are suppressed.
- 4/5-cost units receive additional late composition value.
- Hard AI no longer spends most idle rerolls when no upgrade, breakpoint, or high-cost carry chase exists; pressure can still justify aggressive rolling.
- Full-Bench selling remains legal and at normal refund, but late Hard AI only clears space for a strategically useful incoming unit.
- AI must never receive hidden Gold, XP, Shop, item, stat or combat advantages.

## 9. Authoritative modules

- Main UI / input / Board / Bench / Shop / archive / audio: `app/game.tsx`
- Base visuals: `app/globals.css`
- Responsive/presentation overrides: `app/v06-overrides.css`, `app/v07-overrides.css`, `app/v08-overrides.css`, `app/v08-fixes.css`
- Units / traits / items / synergy definitions: `app/game-data.ts`
- Combat / snapshots / replay: `app/battle-engine.ts`
- Economy / progression / Shop odds: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- Tests: `tests/`

## 10. Validation / next step

- Follow-up changes after deployed commit `2169fbc...` have been written to GitHub `main` but not deployed in this task.
- No combat-engine logic changed; replay/team/totem changes are presentation-only.
- Planning AI logic changed and should receive proportional verification before the next release: TypeScript/build, AI legality/regression tests, and representative late Hard-AI simulations (especially rounds / levels where the core is already mature).
- Visual verification should specifically cover desktop Replay size, mobile trait totem symbols, player/enemy differentiation, and normal green HP bars.
- Do not rerun broad deterministic combat stress tests solely for these changes unless a combat-engine regression appears.

## 11. Next-task protocol

1. Read this file first.
2. Inspect only directly relevant modules and dependencies.
3. Preserve deterministic combat and input/drop invariants.
4. Match testing effort to the actual modification.
5. For presentation changes, prefer rendered screenshots over broad code audits.
6. Deploy through the existing Sites/vinext workflow only when explicitly requested.
7. Update this same file after meaningful changes.
