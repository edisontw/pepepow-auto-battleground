import { buildMatchupMatrix, matrixMarkdown } from "../app/balance-matrix";

const seeds = Math.max(8, Number.parseInt(process.env.MATRIX_SEEDS ?? "128", 10) || 128);
const matrix = buildMatchupMatrix(seeds);
process.stdout.write(`${matrixMarkdown(matrix)}\n`);

