import assert from "node:assert/strict";
import test from "node:test";
import { buildMatchupMatrix, MATRIX_ARCHETYPES, matrixMarkdown } from "../app/balance-matrix";

test("fixed-seed matchup matrix is deterministic and contains every pairing", () => {
  const first = buildMatchupMatrix(8, 4200);
  const second = buildMatchupMatrix(8, 4200);
  assert.deepEqual(first, second);
  assert.equal(Object.keys(first.cells).length, MATRIX_ARCHETYPES.length ** 2);
  assert.match(matrixMarkdown(first), /Composition/);
  for (const cell of Object.values(first.cells)) assert.ok(cell.winRate >= 0 && cell.winRate <= 1);
});
