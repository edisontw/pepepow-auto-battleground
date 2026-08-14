import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("../app/game.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

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

test("low-height desktop shop stretches inside its actual grid track", () => {
  assert.match(css, /grid-template-rows:minmax\(0,1fr\)/);
  assert.match(css, /@media \(max-height:820px\)[\s\S]*?\.shop-card \{ height:auto;/);
  assert.doesNotMatch(css, /@media \(max-height:820px\)[\s\S]*?\.shop-card \{ height:96px;/);
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
