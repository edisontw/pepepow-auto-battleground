# PEPEPOW Auto Battleground — Character & Combat Art Bible

This document is the visual source of truth for new unit art, replacement art, synergy sigils, and combat effects. The current direction is **realistic 2.5D game art** with compact silhouettes and believable materials. It is not the future full visual redesign.

## 1. Character master format

- One full-body subject on a genuinely transparent background.
- Master composition is square; production export is `320×320` lossless-alpha WebP.
- Three-quarter front view, camera slightly above waist height, neutral ground plane implied but not painted.
- Key light from upper-left/front at roughly 35°; cool cyan rim light from upper-right/rear.
- Character occupies 76–82% of the canvas height and remains inside a 7% safe margin.
- Feet share a common baseline at 88% canvas height. Head/primary focal point sits near 30% canvas height.
- No frame, backdrop, text, nameplate, pedestal, baked shadow rectangle, or environment.
- Keep baked particles and glow within 8% of the silhouette. Large gameplay effects are rendered by the game.

## 2. Shape language

- Compact, grounded proportions: rounded torso, relatively short limbs, readable hands and feet.
- One oversized gameplay-defining prop per unit; secondary props must not compete with it.
- Silhouette must remain identifiable at approximately `64×64` pixels.
- Materials may be realistic, but edges are slightly broadened and details are grouped into large value masses.
- Faces may be human, masked, robotic, or creature-based; avoid anime facial proportions and fashion-illustration poses.

### Class silhouettes

- **Guardian:** broad rectangle or shield wall; low center of gravity.
- **Ranger:** long diagonal weapon; narrow forward-facing profile.
- **Engineer:** backpack/tool rig and a visible mechanical arc around the torso.
- **Brawler:** wide shoulders or forearms; forward-leaning triangular stance.
- **Assassin:** split triangular silhouette, twin tools/blades, compact trailing cloth.
- **Hacker:** asymmetric equipment and one floating or articulated control device.
- **Support:** open protective shape, beacon/lantern/medical tool, calm stance.
- **Arcanist:** one ring, orb, staff head, or focusing apparatus; magical energy stays close to the device.

## 3. Faction materials and palettes

| Faction | Primary material | Main colors | Accent colors |
| --- | --- | --- | --- |
| Crystal | faceted jade crystal + silver/ivory armor | emerald, pale silver | cyan-white |
| Machine | worn brass + dark steel | amber, graphite | furnace orange |
| Wild | bark, stone, fur, living moss | moss green, earth brown | yellow-green |
| Cyber | gunmetal + blue-black technical fabric | electric blue, dark navy | cyan-white |
| Underground | iron, leather, rough stone | rust orange, charcoal | warm lantern gold |
| Void | obsidian + dark violet metal | violet, black | magenta-white |

Each unit uses its faction material plus no more than two dominant colors. Class identity comes from silhouette and prop, not an unrelated third palette.

## 4. Shared image usage

- Shop, Board, Bench, Unit Info, Archive, and Replay all use `/public/units/<unit-id>.webp`.
- Layout differences are made with cropping and `object-fit`; never create a separate inconsistent portrait for one UI.
- Unit images do not contain team color. Player cyan/green and enemy coral distinction remains a rendering layer.
- Star, HP, selection, stun, shield, and target state remain UI/VFX layers.

## 5. Synergy sigils

- Every synergy has one unique monochrome vector sigil under `/public/synergies/`.
- The same sigil is reused in the desktop panel, mobile panel, mobile totem, Unit Info, and Archive.
- Faction sigils use a hexagonal outer language; class sigils use a circular outer language.
- UI supplies tier frames, color, glow, progress, and inactive treatment. The SVG itself stays monochrome and mask-friendly.

## 6. Combat-effect language

- **Basic shot:** thin, direct line with a small endpoint spark.
- **Piercing shot:** wider double-core line and a distinct terminal burst.
- **Chain lightning:** ordered segmented links from source through each target.
- **Area spell:** low-opacity telegraph ring followed by a brief impact ring.
- **Healing:** soft teal-green pulse; never shares hostile colors.
- **Control:** violet or ice-blue bracket/ring around the affected unit.
- **Enemy area effect:** coral/violet telegraph. **Player area effect:** cyan/teal telegraph.
- Effects must explain source, target, area, and order before adding spectacle.
- Low-quality/mobile profiles retain the primary line/ring and remove only secondary particles.

