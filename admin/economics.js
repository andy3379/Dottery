"use strict";

function resolveStopTiers(tiers) {
  if (!tiers.length) return [];
  if (tiers.length === 1) return tiers;
  const maxQty = Math.max(...tiers.map((tier) => tier.quantity));
  const nonFiller = tiers.filter((tier) => tier.quantity < maxQty);
  return nonFiller.length ? nonFiller : tiers.slice(0, 1);
}

function resolveStopPrizes(prizes) {
  const regular = (prizes || []).filter((p) => !p.isLastOne);
  const tiers = regular.map((prize) => {
    const quantity = Math.max(0, Number(prize.quantity) || 0);
    const cost = Math.max(0, Number(prize.cost) || 0);
    return {
      id: prize.id || "",
      name: prize.name || "",
      quantity,
      cost,
      totalCost: quantity * cost,
    };
  });
  const stopTiers = resolveStopTiers(tiers);
  return {
    m: stopTiers.reduce((sum, tier) => sum + tier.quantity, 0),
    stopCost: stopTiers.reduce((sum, tier) => sum + tier.totalCost, 0),
    name: stopTiers.map((tier) => tier.name).filter(Boolean).join("、"),
    tiers,
    stopTiers,
  };
}

function resolveMajorPrize(prizes) {
  const stop = resolveStopPrizes(prizes);
  const top = stop.tiers[0];
  return {
    m: stop.m,
    v: top ? top.cost : 0,
    name: stop.name,
    tiers: stop.tiers,
    stopCost: stop.stopCost,
  };
}

function expectedCostThroughDraws(drawSchedule, expectedDraws) {
  const schedule = drawSchedule || [];
  const draws = Math.max(0, Number(expectedDraws) || 0);
  if (!schedule.length || draws <= 0) return 0;
  const full = Math.min(Math.floor(draws), schedule.length);
  const fraction = draws - full;
  let total = 0;
  for (let i = 0; i < full; i += 1) {
    total += schedule[i];
  }
  if (fraction > 0) {
    const tail = schedule[Math.min(full, schedule.length - 1)];
    total += tail * fraction;
  }
  return total;
}

function computeJackpotStopEconomics(params) {
  const totalDraws = Math.max(1, Math.floor(Number(params.N)) || 1);
  const price = Math.max(0, Number(params.P) || 0);
  const majorCount = Math.max(0, Math.floor(Number(params.m)) || 0);
  const targetMarginRate = Math.min(
    0.9,
    Math.max(0, Number(params.targetMarginRate) || 0)
  );
  const drawSchedule = params.drawSchedule || [];
  const invalidMajorCount = majorCount > totalDraws;
  const expectedStopDraw =
    majorCount > 0
      ? (majorCount * (totalDraws + 1)) / (majorCount + 1)
      : 0;
  const expectedRevenue = price * expectedStopDraw;
  const expectedCost =
    params.expectedCost != null
      ? Math.max(0, Number(params.expectedCost) || 0)
      : expectedCostThroughDraws(drawSchedule, expectedStopDraw);
  const expectedProfit = expectedRevenue - expectedCost;
  const expectedProfitRate =
    expectedRevenue > 0 ? expectedProfit / expectedRevenue : 0;
  const marginDenominator = 1 - targetMarginRate;
  const suggestedPrice =
    majorCount > 0 &&
    expectedStopDraw > 0 &&
    marginDenominator > 0
      ? expectedCost / (expectedStopDraw * marginDenominator)
      : 0;
  const priceDelta = price - suggestedPrice;

  return {
    N: totalDraws,
    P: price,
    m: majorCount,
    targetMarginRate,
    expectedStopDraw,
    expectedRevenue,
    expectedCost,
    expectedProfit,
    expectedProfitRate,
    suggestedPrice,
    priceDelta,
    invalidMajorCount,
    isLoss: expectedProfit < 0,
  };
}

function resolveLastOne(product, prizes) {
  const lastOneInput = product.lastOne || prizes.find((p) => p.isLastOne) || null;
  const enabledFromProduct = product.lastOneEnabled;
  const enabled =
    enabledFromProduct != null
      ? Boolean(enabledFromProduct)
      : Boolean(prizes.some((p) => p.isLastOne && (p.name || p.image || p.id)));
  const active =
    enabled && lastOneInput && (lastOneInput.name || lastOneInput.image || lastOneInput.id);
  return active ? lastOneInput : null;
}

function computeEconomics(product, prizesInput, options) {
  const prizes = prizesInput || product.prizes || [];
  const totalDraws = Math.max(
    1,
    Number(product.totalDraws ?? product.total_draws) || 1
  );
  const price = Number(product.price) || 0;
  const regular = prizes.filter((p) => !p.isLastOne);

  const lines = regular.map((prize) => {
    const quantity = Math.max(0, Number(prize.quantity) || 0);
    const cost = Math.max(0, Number(prize.cost) || 0);
    const probability = quantity / totalDraws;
    const evContribution = (cost * quantity) / totalDraws;
    return {
      id: prize.id || "",
      name: prize.name || "",
      quantity,
      cost,
      probability,
      evContribution,
      kind: "regular",
    };
  });

  const regularCost = lines.reduce((sum, line) => sum + line.cost * line.quantity, 0);
  const regularEvPerDraw = regularCost / totalDraws;

  const lastOneInput = resolveLastOne(product, prizes);
  let lastOne = null;
  let lastOneCost = 0;
  if (lastOneInput) {
    lastOneCost = Math.max(0, Number(lastOneInput.cost) || 0);
    lastOne = {
      id: lastOneInput.id || "",
      name: lastOneInput.name || "",
      quantity: 1,
      cost: lastOneCost,
      probability: 1 / totalDraws,
      evContribution: lastOneCost / totalDraws,
      kind: "lastOne",
    };
  }

  const totalCost = regularCost + lastOneCost;
  const drawSchedule = buildDrawCostSchedule(
    totalDraws,
    regularCost,
    lastOneCost,
    Boolean(lastOne)
  );
  const marginByDraw = drawSchedule.map((expectedCost, index) => {
    const draw = index + 1;
    return {
      draw,
      expectedCost,
      margin: price - expectedCost,
    };
  });
  const totalMargin = marginByDraw.reduce((sum, row) => sum + row.margin, 0);
  const evPerDraw = totalDraws > 0 ? totalCost / totalDraws : 0;
  const maxDrawCost = drawSchedule.reduce(
    (max, cost) => Math.max(max, cost),
    0
  );
  const recommendedPrice = Math.max(0, Math.ceil(maxDrawCost - 1e-9));
  const lastOneEvPerDraw = lastOne ? lastOneCost / totalDraws : 0;
  const marginPerDraw = totalDraws > 0 ? totalMargin / totalDraws : 0;
  const marginRate = price > 0 ? marginPerDraw / price : 0;
  const totalRevenue = price * totalDraws;
  const majorPrize = resolveMajorPrize(prizes);
  const stopDrawSchedule = buildDrawCostSchedule(totalDraws, regularCost, 0, false);
  const stopModel = computeJackpotStopEconomics({
    N: totalDraws,
    P: price,
    m: majorPrize.m,
    drawSchedule: stopDrawSchedule,
    targetMarginRate: options?.targetMarginRate ?? 0.3,
  });

  return {
    totalDraws,
    price,
    regularCost,
    lastOneCost,
    totalCost,
    regularEvPerDraw,
    lastOneEvPerDraw,
    evPerDraw,
    marginPerDraw,
    marginRate,
    totalRevenue,
    totalMargin,
    recommendedPrice,
    maxDrawCost,
    marginByDraw,
    isLoss: stopModel.isLoss,
    lines,
    lastOne,
    majorPrize,
    stopModel,
    expectedProfit: stopModel.expectedProfit,
    expectedProfitRate: stopModel.expectedProfitRate,
    suggestedPrice: stopModel.suggestedPrice,
    priceDelta: stopModel.priceDelta,
    expectedStopDraw: stopModel.expectedStopDraw,
  };
}

function buildDrawCostSchedule(totalDraws, regularCost, lastOneCost, hasLastOne) {
  const total = Math.max(1, Number(totalDraws) || 1);
  const schedule = [];
  let remainingDraws = total;
  let remainingCost = Math.max(0, Number(regularCost) || 0);
  const lastOne = Math.max(0, Number(lastOneCost) || 0);

  for (let draw = 1; draw <= total; draw++) {
    const expectedRegularCost =
      remainingDraws > 0 ? remainingCost / remainingDraws : 0;
    const expectedCost =
      hasLastOne && draw === total
        ? expectedRegularCost + lastOne
        : expectedRegularCost;
    schedule.push(expectedCost);
    if (draw < total) {
      remainingDraws -= 1;
      remainingCost = Math.max(0, remainingCost - expectedRegularCost);
    }
  }

  return schedule;
}


function resolveTargetPrizeCount(prizes, target) {
  const regular = (prizes || []).filter((p) => !p.isLastOne);
  if (!regular.length) return 0;
  if (target === "top") {
    return regular.slice(0, 2).reduce((sum, prize) => sum + Math.max(0, Number(prize.quantity) || 0), 0);
  }
  return Math.max(0, Number(regular[0].quantity) || 0);
}

function exactFirstHitOnDraw(totalDraws, targetCount, drawIndex) {
  const total = Math.max(1, Number(totalDraws) || 1);
  const targets = Math.max(0, Math.min(Number(targetCount) || 0, total));
  const draw = Math.max(1, Number(drawIndex) || 1);
  if (!targets || draw > total) return 0;
  let prob = targets / (total - draw + 1);
  for (let j = 0; j < draw - 1; j++) {
    prob *= (total - targets - j) / (total - j);
  }
  return prob;
}

function exactFirstHitDistribution(totalDraws, targetCount, scratchCount) {
  const total = Math.max(1, Number(totalDraws) || 1);
  const targets = Math.max(0, Math.min(Number(targetCount) || 0, total));
  const scratches = Math.max(0, Math.min(Number(scratchCount) || 0, total));
  const byDraw = [];
  let hitWithin = 0;
  for (let draw = 1; draw <= scratches; draw++) {
    const probability = exactFirstHitOnDraw(total, targets, draw);
    byDraw.push({ draw, probability });
    hitWithin += probability;
  }
  return {
    totalDraws: total,
    targetCount: targets,
    scratchCount: scratches,
    byDraw,
    hitWithin,
    missWithin: Math.max(0, 1 - hitWithin),
  };
}

function simulateFirstHitDistribution(options) {
  const totalDraws = Math.max(1, Number(options.totalDraws) || 1);
  const targetCount = Math.max(0, Math.min(Number(options.targetCount) || 0, totalDraws));
  const scratchCount = Math.max(0, Math.min(Number(options.scratchCount) || 0, totalDraws));
  const trials = Math.max(1, Number(options.trials) || 100000);
  const counts = new Array(scratchCount + 1).fill(0);

  for (let t = 0; t < trials; t++) {
    let remaining = totalDraws;
    let targetsLeft = targetCount;
    let hitOn = 0;
    for (let draw = 1; draw <= scratchCount; draw++) {
      if (targetsLeft > 0 && Math.random() < targetsLeft / remaining) {
        hitOn = draw;
        break;
      }
      remaining -= 1;
    }
    counts[hitOn] += 1;
  }

  const byDraw = [];
  let hitWithin = 0;
  for (let draw = 1; draw <= scratchCount; draw++) {
    const probability = counts[draw] / trials;
    byDraw.push({ draw, probability });
    hitWithin += probability;
  }

  return {
    totalDraws,
    targetCount,
    scratchCount,
    trials,
    byDraw,
    hitWithin,
    missWithin: counts[0] / trials,
  };
}

function compareDrawDistribution(totalDraws, targetCount, scratchCount, trials) {
  const exact = exactFirstHitDistribution(totalDraws, targetCount, scratchCount);
  const simulated = simulateFirstHitDistribution({
    totalDraws,
    targetCount,
    scratchCount,
    trials,
  });
  const maxDelta = exact.byDraw.reduce((max, row, index) => {
    const delta = Math.abs(row.probability - simulated.byDraw[index].probability);
    return Math.max(max, delta);
  }, Math.abs(exact.missWithin - simulated.missWithin));
  return { exact, simulated, maxDelta };
}

function computeDrawDistributions(product, options) {
  const prizes = options?.prizes || product.prizes || [];
  const totalDraws = Math.max(1, Number(product.totalDraws ?? product.total_draws) || 1);
  const targetCount = resolveTargetPrizeCount(prizes, options?.target || "first");
  const scratchCounts = (options?.scratchCounts || []).map((n) =>
    Math.max(0, Math.min(Number(n) || 0, totalDraws))
  );
  const trials = Math.max(1, Number(options?.trials) || 100000);
  return scratchCounts.map((scratchCount) => ({
    scratchCount,
    ...compareDrawDistribution(totalDraws, targetCount, scratchCount, trials),
  }));
}

function suggestScratchCounts(totalDraws) {
  const total = Math.max(1, Number(totalDraws) || 1);
  const seeds =
    total <= 24
      ? [1, 2, 3, 5, 8, 12, total]
      : [10, 25, 50, 100, 200, 500, 1000, Math.min(total, 2000), total];
  const out = [];
  for (const n of seeds) {
    const value = Math.max(1, Math.min(Number(n) || 0, total));
    if (!out.includes(value)) out.push(value);
  }
  return out.slice(0, 8);
}

function bucketDrawDistribution(byDraw, maxBars) {
  const limit = Math.max(1, Number(maxBars) || 40);
  if (!byDraw.length) return [];
  if (byDraw.length <= limit) {
    return byDraw.map((row) => ({
      draw: row.draw,
      label: String(row.draw),
      probability: row.probability,
    }));
  }
  const bucketSize = Math.ceil(byDraw.length / limit);
  const buckets = [];
  for (let start = 0; start < byDraw.length; start += bucketSize) {
    const slice = byDraw.slice(start, start + bucketSize);
    const drawStart = slice[0].draw;
    const drawEnd = slice[slice.length - 1].draw;
    buckets.push({
      draw: drawStart,
      label: drawStart === drawEnd ? String(drawStart) : `${drawStart}-${drawEnd}`,
      probability: slice.reduce((sum, row) => sum + row.probability, 0),
    });
  }
  return buckets;
}

function computeScratchOutlook(product, scratchCount, options) {
  const econ = computeEconomics(product, options?.prizes);
  const prizes = options?.prizes || product.prizes || [];
  const targetCount = resolveTargetPrizeCount(prizes, options?.target || "first");
  const scratches = Math.max(
    0,
    Math.min(Number(scratchCount) || 0, econ.totalDraws)
  );
  const distribution = exactFirstHitDistribution(econ.totalDraws, targetCount, scratches);
  const targetName =
    (prizes.filter((p) => !p.isLastOne)[0] || {}).name || "";
  const expectedCost = econ.marginByDraw
    .slice(0, scratches)
    .reduce((sum, row) => sum + row.expectedCost, 0);
  const expectedMargin = scratches * econ.price - expectedCost;
  return {
    scratchCount: scratches,
    targetCount,
    targetName,
    distribution,
    chart: bucketDrawDistribution(distribution.byDraw, options?.maxBars || 40),
    expectedRevenue: scratches * econ.price,
    expectedCost,
    expectedMargin,
    isLoss: expectedMargin < 0,
    economics: econ,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    resolveStopTiers,
    resolveStopPrizes,
    resolveMajorPrize,
    expectedCostThroughDraws,
    computeJackpotStopEconomics,
    computeEconomics,
    resolveTargetPrizeCount,
    exactFirstHitOnDraw,
    exactFirstHitDistribution,
    simulateFirstHitDistribution,
    compareDrawDistribution,
    computeDrawDistributions,
    suggestScratchCounts,
    bucketDrawDistribution,
    computeScratchOutlook,
    buildDrawCostSchedule,
  };
}

if (typeof window !== "undefined") {
  window.DotteryEconomics = {
    resolveStopTiers,
    resolveStopPrizes,
    resolveMajorPrize,
    expectedCostThroughDraws,
    computeJackpotStopEconomics,
    computeEconomics,
    resolveTargetPrizeCount,
    exactFirstHitOnDraw,
    exactFirstHitDistribution,
    simulateFirstHitDistribution,
    compareDrawDistribution,
    computeDrawDistributions,
    suggestScratchCounts,
    bucketDrawDistribution,
    computeScratchOutlook,
    buildDrawCostSchedule,
  };
}
