import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("../app/game.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const v06 = readFileSync(new URL("../app/v06-overrides.css", import.meta.url), "utf8");
const v09 = readFileSync(new URL("../app/v09-art.css", import.meta.url), "utf8");

test("mobile gameplay exposes compact equipment and synergy panels", () => {
  assert.match(game, /function MobileStatusDock/);
  assert.match(game, /SYNERGIES/);
  assert.match(game, /EQUIPMENT/);
  assert.match(game, /aria-label="Open equipment guide"/);
  assert.match(css, /\.mobile-status-dock \{[^}]*display:grid/);
});

test("unit artwork cannot trigger iOS image callouts during long press", () => {
  assert.match(game, /className="unit-art"><img[^>]*draggable=\{false\}/);
  assert.match(game, /handlePointerDown[\s\S]*?event\.preventDefault\(\)/);
  assert.match(css, /-webkit-touch-callout:none/);
  assert.match(css, /\.unit-token img \{[^}]*pointer-events:none/);
});

test("mobile formation editing supports tap-to-move without touch inspection popups", () => {
  assert.match(game, /if \(event\.pointerType === "mouse"\)/);
  assert.match(game, /moveUnit\(selected\.uid, unit\.position\)/);
  assert.match(game, /onClick=\{\(\) => \{ if \(!unit\) tapBenchSlot\(index\); \}\}/);
  assert.match(game, /className="mobile-move-copy">TAP UNIT \/ CELL/);
  assert.match(game, /<button onClick=\{\(\) => inspectUnit\(selectedUnit\)\}>INFO<\/button>/);
  assert.match(v09, /\.drag-ghost \{[^}]*width:50px;[^}]*transform:translate\(-50%,-128%\)/);
  assert.match(v09, /\.unit-detail:not\(\.archive-unit-detail\) \{[^}]*bottom:calc\(var\(--shop-h\) \+ 3px\);[^}]*max-height:45dvh/);
});

test("mobile Shop keeps all five recruits visible with faction and class labels", () => {
  assert.match(game, /data-trait=\{trait\} className=\{index === 0 \? "faction" : index === 1 \? "class"/);
  assert.match(v09, /\.shop-cards \{ grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(v09, /\.shop-info>div \{[^}]*display:grid;[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(v09, /\.shop-info>div small \{[^}]*display:block/);
});

test("v0.9.4 keeps mobile recruit labels and primary controls readable", () => {
  assert.match(v09, /\.game-shell \{ --shop-h:154px; \}/);
  assert.match(v09, /\.shop-card \{[^}]*height:72px;[^}]*grid-template-rows:32px 40px/);
  assert.match(v09, /\.shop-info>div small \{[^}]*font:750 6px\/1\.05/);
  assert.match(v09, /\.shop-controls button,\.shop-controls button:first-child,\.battle-button \{[^}]*min-height:44px/);
  assert.match(v09, /\.music-volume \{ display:none; \}/);
});

test("desktop and result summaries receive the readability pass", () => {
  assert.match(v09, /@media\(min-width:901px\)[\s\S]*?\.shop-info>b \{ font-size:11\.5px; \}/);
  assert.match(v09, /\.result-card \{ width:min\(650px,95vw\); \}/);
  assert.match(v09, /\.top-five-summary strong \{ font-size:8\.5px; \}/);
  assert.match(v09, /\.result-actions button \{ min-height:44px; font-size:11px; \}/);
});

test("low-height desktop shop stretches inside its actual grid track", () => {
  assert.match(css, /grid-template-rows:minmax\(0,1fr\)/);
  assert.match(css, /@media \(max-height:820px\)[\s\S]*?\.shop-card \{ height:auto;/);
  assert.doesNotMatch(css, /@media \(max-height:820px\)[\s\S]*?\.shop-card \{ height:96px;/);
});

test("post-v0.6 desktop Shop preserves full unit art in a horizontal card", () => {
  assert.match(v06, /@media \(min-width:901px\)[\s\S]*?\.shop-card \{[^}]*grid-template-columns:46px minmax\(0,1fr\)/);
  assert.match(v06, /\.shop-art img \{[^}]*object-fit:contain;[^}]*object-position:center bottom/);
  assert.match(v06, /@media \(max-height:820px\)[\s\S]*?\.shop-card \{ grid-template-columns:42px minmax\(0,1fr\)/);
});

test("post-v0.6 mobile Board reserves a separate Bench row", () => {
  assert.match(v06, /@media \(max-width:900px\)[\s\S]*?\.arena-panel \{ grid-template-rows:22px auto 42px 23px/);
  assert.match(v06, /\.bench-wrap \{ height:42px; position:relative; z-index:3; \}/);
  assert.match(v06, /\.battle-board \{[^}]*aspect-ratio:8\/7\.2;[^}]*z-index:1/);
  assert.match(v06, /@media \(max-width:600px\)[\s\S]*?\.battle-board \{ aspect-ratio:8\/7; \}/);
});

test("post-v0.6 mobile HUD keeps primary numbers readable", () => {
  assert.match(v06, /\.resource-row \.gold b \{[^}]*font-size:14px/);
  assert.match(v06, /\.resource-row \.level b \{[^}]*font-size:19px/);
  assert.match(v06, /\.round-label strong \{ font-size:19px/);
});

test("defeat uses a non-control emblem rather than a close X", () => {
  assert.match(game, /draw \? "◇" : "◆"/);
  assert.match(game, /className="result-mark" aria-hidden="true"/);
});

test("battlefield pieces hide labels and pedestals while keeping stronger health bars", () => {
  assert.match(game, /\{compact && <span className="piece-base"/);
  assert.doesNotMatch(game, /!compact && <span className="unit-name"/);
  assert.match(css, /\.hp-track \{[^}]*height:8px/);
});

test("planning warns when the board is underfilled", () => {
  assert.match(game, /BOARD NOT FULL — \{deployed\.length\} \/ \{level\}/);
  assert.match(game, /const boardNotFull = phase === "planning" && deployed\.length < level/);
});

test("battle archive exposes enemy historical inspection", () => {
  assert.match(game, /ENEMY LINEUP/);
  assert.match(game, /HISTORICAL ENEMY SNAPSHOT/);
  assert.match(game, /selected\?\.result\.frames\[0\]/);
});

test("unit detail synergy sigils stay inside their cards", () => {
  assert.match(game, /className="detail-traits"[\s\S]*?<article key=\{trait\}>/);
  assert.match(v09, /\.detail-traits>article \{[^}]*padding-left:39px;[^}]*min-height:42px/);
  assert.match(v09, /\.detail-traits \.trait-gem \{[^}]*width:26px;[^}]*height:26px;[^}]*min-height:0;[^}]*padding:0/);
  assert.doesNotMatch(v09, /\.detail-traits span \{/);
});

test("combat presentation filters endpoint effects and announces ability casts", () => {
  assert.match(game, /const CELL_EFFECT_TYPES = new Set/);
  assert.match(game, /visibleCellEvents\(combatFrame\?\.events\.filter/);
  assert.match(game, /className=\{`skill-banner team-\$\{featuredCaster\.team\}`\}/);
  assert.match(game, /className="battle-message" role="status" aria-live="polite"/);
});
