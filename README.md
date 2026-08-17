# PEPEPOW Auto Battleground

Browser-based auto battler built with Next.js-compatible app code and the ChatGPT Sites / vinext deployment workflow.

- Repository source of truth: GitHub `main`
- Current source status: **v0.7 candidate**
- Deployed Sites release: **v0.6** until the candidate is explicitly deployed
- Site: `https://pepepow-auto-battleground.edisonhuang.chatgpt.site/`

## v0.7 candidate gameplay changes

### Arcanist
Five existing units now carry the additive `Arcanist` trait while retaining their faction and class:

- Glow Medic
- Volt Hacker
- Circuit Sage
- Wild Seer
- Storm Hacker

Arcanist thresholds are authoritative in `app/game-data.ts`:

- 2 Arcanist: +25 starting Mana and +15% skill effect
- 4 Arcanist: +45 starting Mana and +30% skill effect

Null Sovereign and Aurora Titan deliberately do **not** receive Arcanist so the established Ranger + Void + legendary core is not strengthened indirectly.

### Counter / sustain balance

- Assassin opening targeting prefers Rangers among equivalent backline targets.
- Assassin 2: +25% damage to Rangers.
- Assassin 3: +45% damage to Rangers.
- Wild now uses reachable `2 / 3` thresholds: +15% / +32% team HP.
- Support 2 / 3 healing multipliers are +40% / +80%.
- Arcanist skill power also amplifies compatible Support spell effects.

The combat engine version is `combat-balance-0.7.0`; replay format is v4.

## v0.7 presentation changes

- New WebP portraits are maintained in `public/units/` for the five Arcanist units.
- Desktop hides the Board-corner synergy totems; synergy values remain available in the HUD/status interfaces.
- Mobile keeps synergy totems outside the playable Board cells.
- Existing v0.6 Windows Shop visibility and mobile Board/Bench separation fixes remain in `app/v06-overrides.css`.

## Authoritative modules

- Main game UI / input / Board / Bench / Shop / guide / archive: `app/game.tsx`
- Units, items, traits, synergy thresholds and descriptions: `app/game-data.ts`
- Economy and progression: `app/game-rules.ts`
- Deterministic combat and replay: `app/battle-engine.ts`
- Planning AI: `app/ai-engine.ts`
- Responsive and visual overrides: `app/v06-overrides.css`
- Regression tests: `tests/`
- Canonical project context for future work: `PROJECT_STATE.md`

## Development / verification

Use the existing locked project scripts rather than changing dependencies for routine work:

```bash
npm test
npm run build
```

For ChatGPT Sites, use the existing `*:sites` / vinext workflow defined by the repository and the Sites project. Standard Next.js compatibility is retained for external environments.

Do not treat an untested GitHub candidate as deployed. Combat changes should receive deterministic regression tests plus appropriate battle simulation before release.
