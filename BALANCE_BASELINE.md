# v0.9 Fixed-Seed Balance Baseline

Generated with `MATRIX_SEEDS=128 npm run balance:matrix` on 2026-08-19.

Each pairing is played twice per seed with sides reversed. The reported win rate awards half a point for a draw, removes top/bottom spawn bias, and produces 50% self-matchups. Test formations use eight units, activate the selected second-tier Synergy where possible, include basic frontline/damage coverage, and stay within a 36-Gold roster budget.

| Composition | Ranger | Arcanist | Assassin | Guardian | Brawler | Engineer | Support | Cyber | Counters at ≤45% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Ranger | 50% | 0% | 65% | 94% | 82% | 33% | 50% | 4% | Arcanist, Engineer, Cyber |
| Arcanist | 100% | 50% | 97% | 50% | 50% | 100% | 61% | 50% | none |
| Assassin | 38% | 3% | 50% | 88% | 59% | 49% | 14% | 0% | Ranger, Arcanist, Support, Cyber |
| Guardian | 11% | 50% | 6% | 50% | 46% | 52% | 50% | 0% | Ranger, Assassin, Cyber |
| Brawler | 21% | 50% | 45% | 56% | 50% | 88% | 50% | 49% | Ranger |
| Engineer | 69% | 0% | 50% | 48% | 14% | 50% | 88% | 0% | Arcanist, Brawler, Cyber |
| Support | 50% | 35% | 85% | 50% | 50% | 12% | 50% | 19% | Arcanist, Engineer, Cyber |
| Cyber | 99% | 50% | 100% | 100% | 51% | 100% | 84% | 50% | none |

## Interpretation

- This is a screening matrix, not a tier-list proof. It tests fixed representative shells, not every unit, item, position or shop path.
- Arcanist and Cyber are the immediate tuning warnings: neither currently has two reliable counter rows.
- Brawler has only one clear counter row and should be watched with the same rule.
- Ranger, Assassin, Guardian, Engineer and Support already show multiple losing matchups, so broad nerfs to those shells are not supported by this baseline.
- After a balance change, rerun the same seed count and compare the full matrix. Do not tune from a single matchup or unmirrored results.
