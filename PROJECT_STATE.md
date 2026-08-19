# PEPEPOW Auto Battleground — PROJECT_STATE

> Canonical context for future ChatGPT Sites / Codex work. Read this file first; do not rescan the whole repository unless the task genuinely requires it.

**Last updated:** 2026-08-19  
**Deployed site:** https://pepepow-auto-battleground.edisonhuang.chatgpt.site/  
**Current deployed version:** v0.9 art-unification release  
**Currently deployed commit:** user reports GitHub `main` through `0eba0eb00a5acc6afcaeed509b5bf310f1a06222` deployed  
**v0.9 base commit:** `599f614b430cc413a82e91d3cd407dd487a55866`; the art-unification release is published from the current GitHub `main`

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

- Combat engine: `combat-balance-0.9.0`; replay format v5.
- Targeting: nearest reachable enemy with sticky targets and BFS pathing.
- Guardian Taunt may override targeting.
- Assassin opening acquisition prioritizes enemy backline, then Rangers and Arcanists at equal depth.
- Assassin 2/3 retains +25% / +45% damage to Rangers and gains a smaller Arcanist counter multiplier.
- Wild 2/3: all allies +15% / +32% max HP.
- Support 2/3: healing +40% / +80%.
- Arcanist 2/4: +25/+45 starting Mana and +15%/+30% skill effect.

Regression risks: target flicker, living-unit overlap, corpse obstruction, stuck movement, duplicate animation damage, frame-rate-dependent results, replay incompatibility.

## 4. v0.9 roster and art

Roster: 33 units.

Newest Arcanists:

- **Arcane Apprentice** — 1 Gold — Machine / Support / Arcanist — `Mana Ward`.
- **Rune Blaster** — 2 Gold — Crystal / Hacker / Arcanist — radius-2 `Rune Nova` AoE.
- **Chrono Mage** — 4 Gold — Underground / Hacker / Arcanist — area damage + 1-tick `Time Lock` stun.

Other Arcanists: Glow Medic, Volt Hacker, Circuit Sage, Wild Seer, Storm Hacker. Those five later-added mage portraits were rebuilt under the shared realistic-2.5D art rules. Null Sovereign and Aurora Titan remain non-Arcanist. A 6-Arcanist capstone remains deferred.

New counterplay units: Rift Breaker (shield break), Mire Chemist (anti-heal), Signal Leech (Mana interference), Lantern Warden (backline protection), Prism Hook (pull/control), and Coil Ranger (repeated-damage feedback).

`ART_BIBLE.md` is authoritative for camera, light, proportions, silhouette language, faction materials/colors, transparent backgrounds and crop reuse. All unit assets remain 320×320 transparent WebP.

## 5. Board / combat presentation

- Board asset: `public/battle-board-v08.webp`.
- Authoritative placement is the 8×6 DOM grid; decorative painted tiles must never imply different legal coordinates.
- Battlefield Mana bars remain hidden; Mana is still simulated and visible in Unit Info.
- HP is the only persistent battlefield resource bar and is always green.
- Ranged / magic attacks use the fixed single / piercing / chain / area / heal / control / shield grammar in `app/v09-art.css`; AoE/global skills fan out visually to affected targets without changing damage logic.
- Player and enemy pieces have restrained team distinction: player green-cyan edge/glow cues and enemy red-coral edge/glow/star cues while HP stays green for both.
- Desktop Board-corner synergy totems remain hidden; mobile totems stay outside playable cells.
- Every faction/class has an authored SVG sigil under `public/synergies/`, reused in the Synergy list, mobile indicators, Unit Info and Game Archive.

## 6. Replay / responsive presentation

- Full-screen Replay remains independent of normal in-game Board sizing rules.
- Desktop Replay has explicit 8:6 geometry plus viewport width/height and minimum-size guards so generic low-height Board rules cannot collapse it to a tiny center board.
- Desktop targets: 1920×1080, 1440×900, 1366×768.
- Mobile targets: 390×844, 375×812, 360×800, 412×915.
- `app/v08-fixes.css` is loaded after `v08-overrides.css` for narrowly scoped post-deploy corrections.
- `app/v09-art.css` is loaded after v0.8 fixes, and site metadata describes the v0.9 release.

## 7. Progression / Shop / economy

- Passive XP: `min(8, 1 + floor((round - 1) / 2))`.
- Shop tier odds and Shop roll logic share one authoritative table.
- Adding units changes eligible members within cost tiers; tier probabilities are unchanged.
- Full Bench purchase is allowed only if the purchase atomically resolves into a legal upgrade.
- Merge overflow equipment is returned for the player.
- Shop odds tests must derive tier members from `UNITS`, never hard-code old rosters.

## 8. Planning AI

- AI uses the same economy, Shop odds, unit stats and level rules as the player.
- Hard AI values coherent frontline + damage + sustain formations and Assassin/Wild/Support/Guardian/Arcanist breakpoints.
- Late Hard AI (level 7+) evaluates synergy progress from its active fighting core rather than spare Bench units, preventing phantom Bench synergies from driving lineup changes.
- Mature late-game formations use hysteresis: the current Board is retained unless a candidate composition is materially stronger; multi-unit swaps require a larger gain.
- Selected late-game core units retain valid existing positions when possible instead of being fully re-laid every planning round.
- Late Hard purchases are restricted to meaningful upgrades/core copies, active-synergy breakpoints, aligned 3-cost pieces, or 4/5-cost carries; low-value novelty purchases are suppressed.
- Hard AI avoids wasteful idle rerolls when no upgrade, breakpoint or carry chase exists; pressure can still justify aggressive rolling.
- Full-Bench selling remains legal and at normal refund, but late Hard AI only clears space for a strategically useful incoming unit.
- New late-game progression fix: surviving AI commanders receive one deterministic neutral-cycle equipment reward every 5 completed rounds starting after round 5. This starts later than the player's possible round-1 reward, so early difficulty is not inflated.
- AI chooses the legal recipient based on the item's attack/HP/armor/Mana profile, preferring deployed/upgraded pieces. Equipment value is now included in Board-selection and Bench-keep scoring.
- Each AI unit remains capped at the normal two items; there is no hidden item-stat multiplier.
- Hard AI analyzes the player's public Board: Ranger/Arcanist density raises Assassin value, visible carry side changes Assassin lanes, and visible Assassins trigger inward carry placement plus optional durable corner bait.
- Threat-response strength varies by personality; Adaptive and Tempo react more aggressively than Collector/Synergy Hunter.
- Low-cost 3-star chases have a late-game stop condition, empty low-value Bench pieces are pruned, and equipment mismatch reduces Board-selection value so a better-fitting unit can replace the holder.
- AI must never receive hidden Gold, XP, Shop, stat or combat advantages.

## 9. Authoritative modules

- Main UI / input / Board / Bench / Shop / archive / audio: `app/game.tsx`
- Base visuals: `app/globals.css`
- Responsive/presentation overrides: `app/v06-overrides.css`, `app/v07-overrides.css`, `app/v08-overrides.css`, `app/v08-fixes.css`
- Units / traits / items / synergy definitions: `app/game-data.ts`
- Combat / snapshots / replay: `app/battle-engine.ts`
- Economy / progression / Shop odds: `app/game-rules.ts`
- Planning AI: `app/ai-engine.ts`
- Fixed-seed balance matrix: `app/balance-matrix.ts`, `scripts/ai-matchup-matrix.ts`
- Art specification: `ART_BIBLE.md`
- Tests: `tests/`

## 10. Validation / next step

- Local Next.js production build, ESLint and all TypeScript regression suites pass for the v0.9 release.
- The mirrored matchup harness was run at 128 fixed seeds per side/pairing. Mirroring removes top/bottom spawn bias and makes self-matchups 50%.
- The matrix is intentionally diagnostic: optimized Arcanist/Cyber shells still lack two reliable counters and must remain a balance warning rather than being declared solved.
- Before deployment, run the full harness after any tuning, then visually smoke-test Synergy sigils/VFX at 1366×768 and one supported mobile viewport.
- v0.9 is published from GitHub `main` and deployed through the existing Sites/vinext workflow.

## 11. Next-task protocol

1. Read this file first.
2. Inspect only directly relevant modules and dependencies.
3. Preserve deterministic combat and input/drop invariants.
4. Match testing effort to the actual modification.
5. For presentation changes, prefer rendered screenshots over broad code audits.
6. Deploy through the existing Sites/vinext workflow only when explicitly requested.
7. Update this same file after meaningful changes.
