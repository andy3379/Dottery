"use strict";

const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const {
  computeDrawDistributions,
  resolveTargetPrizeCount,
} = require(path.join(__dirname, "..", "admin", "economics.js"));

function formatPct(value) {
  return `${(value * 100).toFixed(4)}%`;
}

function printDistribution(label, result, showDraws) {
  const { exact, simulated, maxDelta } = result;
  console.log(`\n${label}`);
  console.log(
    `  大獎 ${exact.targetCount} / ${exact.totalDraws} · 刮數 ${exact.scratchCount} · 模擬 ${simulated.trials.toLocaleString()} 次 · 最大誤差 ${formatPct(maxDelta)}`
  );
  console.log(
    `  刮完未中: 理論 ${formatPct(exact.missWithin)} · 模擬 ${formatPct(simulated.missWithin)}`
  );
  console.log(
    `  刮完有中: 理論 ${formatPct(exact.hitWithin)} · 模擬 ${formatPct(simulated.hitWithin)}`
  );
  console.log("  第幾次中 · 理論 · 模擬");
  for (const draw of showDraws) {
    const exactRow = exact.byDraw[draw - 1];
    const simRow = simulated.byDraw[draw - 1];
    if (!exactRow) continue;
    console.log(
      `  第 ${String(draw).padStart(3, " ")} 次 · ${formatPct(exactRow.probability)} · ${formatPct(simRow.probability)}`
    );
  }
}

function pickShowDraws(scratchCount) {
  if (scratchCount <= 12) {
    return Array.from({ length: scratchCount }, (_, i) => i + 1);
  }
  const draws = new Set([1, 2, 3, 4, 5]);
  const mid = Math.ceil(scratchCount / 2);
  draws.add(mid);
  for (let i = Math.max(1, scratchCount - 4); i <= scratchCount; i++) {
    draws.add(i);
  }
  return Array.from(draws).sort((a, b) => a - b);
}

function runProductCase(product, prizes, scratchCounts, trials) {
  const targetCount = resolveTargetPrizeCount(prizes, "first");
  const topName = prizes[0]?.name || "大獎";
  console.log(`\n${"=".repeat(72)}`);
  console.log(`${product.name} · 總抽數 ${product.total_draws} · ${topName} × ${targetCount}`);
  const results = computeDrawDistributions(
    { totalDraws: product.total_draws, prizes },
    { scratchCounts, trials, target: "first" }
  );
  for (const result of results) {
    printDistribution(
      `刮數 ${result.scratchCount}`,
      result,
      pickShowDraws(result.scratchCount)
    );
  }
}

function main() {
  const trials = Number(process.argv[2]) || 200000;
  const db = new DatabaseSync(path.join(__dirname, "..", "data", "dottery.db"));
  const products = db
    .prepare(`SELECT id, name, total_draws, price FROM products ORDER BY total_draws DESC`)
    .all();

  console.log(`蒙地卡羅模擬 · ${trials.toLocaleString()} 次 / 組`);
  console.log("模型: 上架洗牌後，隨機選格刮開（不放回）");

  for (const product of products) {
    const prizes = db
      .prepare(
        `SELECT grade, name, quantity, cost, sort_order, is_last_one
         FROM prizes WHERE product_id = ? AND is_last_one = 0
         ORDER BY sort_order ASC`
      )
      .all(product.id);
    if (!prizes.length || !resolveTargetPrizeCount(prizes, "first")) continue;

    const total = Number(product.total_draws) || 1;
    const scratchCounts =
      total >= 1000
        ? [10, 50, 100, 200, 500, 1000].filter((n) => n <= total)
        : [1, 2, 3, 4, 6, 8, 10, 12].filter((n) => n <= total);

    runProductCase(product, prizes, scratchCounts, trials);
  }

  runProductCase(
    { name: "示範 100 抽", total_draws: 100 },
    [
      { name: "Grand", quantity: 1, isLastOne: false },
      { name: "Normal", quantity: 99, isLastOne: false },
    ],
    [5, 10, 20, 50, 100],
    trials
  );
}

main();
