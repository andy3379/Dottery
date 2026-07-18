"use strict";

const { nanoid } = require("nanoid");
const { computeEconomics } = require("../admin/economics");
const PrizeNumberSpec = require("../admin/prize-number-spec");

const STATUSES = ["draft", "published", "unpublished"];
const THEMES = ["light", "warm", "cool", "dark", "rose"];
const FOIL_PRESETS = ["silver", "gold", "color"];
const DRAW_MODES = ["shuffle", "manual"];
const SOLDOUT_VISIBILITY = ["hide", "show_soldout", "auto_unpublish"];

function nowIso() {
  return new Date().toISOString();
}

function shuffle(array) {
  const items = array.slice();
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeOptimalCols(slotCount, aspect) {
  if (slotCount <= 1) return 1;
  const ratio = aspect > 0 ? aspect : 1;
  let minCols = 2;
  if (slotCount > 12) minCols = 4;
  if (slotCount > 36) minCols = 8;
  const maxCols = slotCount;

  let targetCols = Math.round(Math.sqrt(slotCount * ratio));
  targetCols = clamp(targetCols, minCols, maxCols);

  for (let i = 0; i < 12; i++) {
    const rows = Math.ceil(slotCount / targetCols);
    const gridAspect = targetCols / Math.max(rows, 1);
    if (gridAspect < ratio * 0.92 && targetCols < maxCols) {
      targetCols += 1;
    } else if (gridAspect > ratio * 1.08 && targetCols > minCols) {
      targetCols -= 1;
    } else {
      break;
    }
  }

  return targetCols;
}

function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coverImage: row.cover_image,
    detailImage: row.detail_image || "",
    price: row.price,
    category: row.category,
    totalDraws: row.total_draws,
    slotCount: row.total_draws,
    cols: computeOptimalCols(row.total_draws),
    status: row.status,
    theme: row.theme,
    foilPreset: row.foil_preset,
    foilImage: row.foil_image,
    showRemaining: Boolean(row.show_remaining),
    scheduleEnabled: Boolean(row.schedule_enabled),
    scheduleStart: row.schedule_start || null,
    scheduleEnd: row.schedule_end || null,
    drawMode: DRAW_MODES.includes(row.draw_mode) ? row.draw_mode : "shuffle",
    sortOrder: Number(row.sort_order) || 0,
    soldoutVisibility: SOLDOUT_VISIBILITY.includes(row.soldout_visibility)
      ? row.soldout_visibility
      : "show_soldout",
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getScheduleStatus(product) {
  if (!product.scheduleEnabled) return "none";
  const now = Date.now();
  const start = product.scheduleStart ? Date.parse(product.scheduleStart) : NaN;
  const end = product.scheduleEnd ? Date.parse(product.scheduleEnd) : NaN;
  if (Number.isFinite(start) && now < start) return "upcoming";
  if (Number.isFinite(end) && now > end) return "ended";
  return "active";
}

function isProductPlayable(row) {
  if (!row || row.status !== "published") {
    return { ok: false, reason: "商品未上架" };
  }
  const product = rowToProduct(row);
  const scheduleStatus = getScheduleStatus(product);
  if (scheduleStatus === "upcoming") {
    return { ok: false, reason: "檔期尚未開始" };
  }
  if (scheduleStatus === "ended") {
    return { ok: false, reason: "檔期已結束" };
  }
  return { ok: true, scheduleStatus };
}

function isProductSoldOut(db, productId, row) {
  const totalDraws = row ? row.total_draws : 0;
  const scratchedCount = getScratchedCount(db, productId);
  return totalDraws > 0 && scratchedCount >= totalDraws;
}

function isProductVisibleInShop(db, row, settings) {
  if (!row || row.status !== "published") return false;
  const product = rowToProduct(row);
  if (product.scheduleEnabled && getScheduleStatus(product) === "ended") {
    return false;
  }
  if (isProductSoldOut(db, row.id, row)) {
    if (settings && settings.hideSoldOut) return false;
    if (product.soldoutVisibility === "hide") return false;
  }
  return true;
}

function rowToPrize(row) {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    grade: row.grade,
    name: row.name,
    image: row.image,
    quantity: row.quantity,
    cost: Number(row.cost) || 0,
    isLastOne: Boolean(row.is_last_one),
    sortOrder: row.sort_order,
  };
}

function getPrizes(db, productId) {
  return db
    .prepare(
      `SELECT * FROM prizes WHERE product_id = ? ORDER BY is_last_one ASC, sort_order ASC, grade ASC`
    )
    .all(productId)
    .map(rowToPrize);
}

function getSlots(db, productId) {
  return db
    .prepare(
      `SELECT s.*, p.grade AS prize_grade, p.name AS prize_name, p.image AS prize_image, p.is_last_one AS prize_is_last_one
       FROM slots s
       JOIN prizes p ON p.id = s.prize_id
       WHERE s.product_id = ?
       ORDER BY s.slot_index ASC`
    )
    .all(productId)
    .map((row) => ({
      id: row.id,
      productId: row.product_id,
      slotIndex: row.slot_index,
      number: row.number,
      prizeId: row.prize_id,
      scratched: Boolean(row.scratched),
      scratchedAt: row.scratched_at,
      prize: {
        id: row.prize_id,
        grade: row.prize_grade,
        name: row.prize_name,
        image: row.prize_image,
        isLastOne: Boolean(row.prize_is_last_one),
      },
    }));
}

function getScratchedCount(db, productId) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM slots WHERE product_id = ? AND scratched = 1`)
    .get(productId);
  return row ? row.count : 0;
}

function prizeNumberMap(db, productId, options = {}) {
  const unscratchedOnly = Boolean(options.unscratchedOnly);
  const rows = db
    .prepare(
      unscratchedOnly
        ? `SELECT s.number, s.prize_id
           FROM slots s
           WHERE s.product_id = ? AND s.scratched = 0
           ORDER BY s.number ASC`
        : `SELECT s.number, s.prize_id
           FROM slots s
           WHERE s.product_id = ?
           ORDER BY s.number ASC`
    )
    .all(productId);
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.prize_id)) map.set(row.prize_id, []);
    map.get(row.prize_id).push(row.number);
  });
  return map;
}

function remainingByPrize(db, productId) {
  const numberMap = prizeNumberMap(db, productId, { unscratchedOnly: true });
  return db
    .prepare(
      `SELECT p.id, p.grade, p.name, p.image, p.quantity, p.is_last_one,
              COALESCE(SUM(CASE WHEN s.scratched = 0 THEN 1 ELSE 0 END), 0) AS remaining
       FROM prizes p
       LEFT JOIN slots s ON s.prize_id = p.id
       WHERE p.product_id = ? AND p.is_last_one = 0
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.grade ASC`
    )
    .all(productId)
    .map((row) => ({
      id: row.id,
      grade: row.grade,
      name: row.name,
      image: row.image,
      quantity: row.quantity,
      remaining: row.remaining,
      numbers: numberMap.get(row.id) || [],
    }));
}

function winningNumbers(db, productId) {
  return db
    .prepare(
      `SELECT s.number, s.scratched, p.grade, p.name, p.image, p.id AS prize_id
       FROM slots s
       JOIN prizes p ON p.id = s.prize_id
       WHERE s.product_id = ?
       ORDER BY s.number ASC`
    )
    .all(productId)
    .map((row) => ({
      number: row.number,
      scratched: Boolean(row.scratched),
      prizeId: row.prize_id,
      grade: row.grade,
      name: row.name,
      image: row.image,
    }));
}

function lastOnePrize(db, productId) {
  const row = db
    .prepare(`SELECT * FROM prizes WHERE product_id = ? AND is_last_one = 1 LIMIT 1`)
    .get(productId);
  return rowToPrize(row);
}

function buildProductDetail(db, productId, options = {}) {
  const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  if (!row) return null;

  const product = rowToProduct(row);
  const prizes = getPrizes(db, productId);
  const scratchedCount = getScratchedCount(db, productId);
  const remaining = remainingByPrize(db, productId);
  const lastOne = lastOnePrize(db, productId);
  const numbers = winningNumbers(db, productId);

  let slots = [];
  let scratchLog = [];
  let slotDrafts = [];
  if (options.includeSlotDrafts) {
    slotDrafts = getSlotDrafts(db, productId);
  }
  if (row.status === "published" || row.status === "unpublished" || options.includeSlots) {
    const allSlots = getSlots(db, productId);
    slots = allSlots.map((slot) => {
      if (options.revealAll || slot.scratched) {
        return {
          slotIndex: slot.slotIndex,
          scratched: slot.scratched,
          scratchedAt: slot.scratchedAt,
          number: slot.number,
          prize: slot.prize,
        };
      }
      return {
        slotIndex: slot.slotIndex,
        scratched: false,
      };
    });

    scratchLog = allSlots
      .filter((slot) => slot.scratched)
      .sort((a, b) => String(b.scratchedAt || "").localeCompare(String(a.scratchedAt || "")))
      .map((slot) => ({
        slotIndex: slot.slotIndex,
        number: slot.number,
        scratchedAt: slot.scratchedAt,
        prize: slot.prize,
      }));
  }

  return {
    ...product,
    scheduleStatus: getScheduleStatus(product),
    prizes,
    lastOne,
    scratchedCount,
    remainingDraws: Math.max(0, product.totalDraws - scratchedCount),
    remaining: remaining.map((item) => ({
      ...item,
      drawn: Math.max(0, item.quantity - item.remaining),
    })),
    winningNumbers: numbers,
    slots,
    slotDrafts,
    scratchLog,
    layout: {
      slotSize: 88,
      gap: 24,
      zoomTargetSize: 300,
      zoomPadding: 0.88,
    },
  };
}

function createProductId() {
  return nanoid(10);
}

function createPrizeId() {
  return nanoid(10);
}

function createSlotId() {
  return nanoid(12);
}

function normalizePrizeInput(input, index) {
  return {
    id: input.id || createPrizeId(),
    grade: String(input.grade || "").trim(),
    name: String(input.name || "").trim(),
    image: String(input.image || "").trim(),
    quantity: Math.max(0, Number(input.quantity) || 0),
    cost: Math.max(0, Number(input.cost) || 0),
    isLastOne: Boolean(input.isLastOne),
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : index,
  };
}

function getSlotDrafts(db, productId) {
  return db
    .prepare(
      `SELECT slot_index, number, prize_id AS prizeId
       FROM slot_drafts
       WHERE product_id = ?
       ORDER BY slot_index ASC`
    )
    .all(productId)
    .map((row) => ({
      slotIndex: row.slot_index,
      number: row.number,
      prizeId: row.prizeId,
    }));
}

function saveSlotDrafts(db, productId, draftsInput, totalDraws) {
  const drafts = (draftsInput || []).map((item, index) => ({
    slotIndex: Number.isInteger(item.slotIndex) ? item.slotIndex : index,
    number: Number(item.number),
    prizeId: String(item.prizeId || "").trim(),
  }));

  if (drafts.length !== totalDraws) {
    return { error: `需配置 ${totalDraws} 個格位`, status: 400 };
  }

  const insert = db.prepare(
    `INSERT INTO slot_drafts (product_id, slot_index, number, prize_id)
     VALUES (?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM slot_drafts WHERE product_id = ?`).run(productId);
    drafts.forEach((draft) => {
      insert.run(productId, draft.slotIndex, draft.number, draft.prizeId);
    });
  });

  tx();
  return { drafts: getSlotDrafts(db, productId) };
}

function buildSlotDraftsFromPrizeSpecs(prizes, specs, totalDraws) {
  return PrizeNumberSpec.buildSlotDrafts(prizes, specs, totalDraws);
}

function validateManualSlots(drafts, prizes, totalDraws) {
  if (!drafts || drafts.length !== totalDraws) {
    return `需配置 ${totalDraws} 個格位`;
  }

  const regular = prizes.filter((p) => !p.isLastOne);
  const prizeIds = new Set(regular.map((p) => p.id));
  const expectedCounts = new Map(regular.map((p) => [p.id, p.quantity]));
  const actualCounts = new Map();
  const numbers = new Set();

  for (const draft of drafts) {
    if (!prizeIds.has(draft.prizeId)) {
      return "含無效獎項";
    }
    const num = Number(draft.number);
    if (!Number.isInteger(num) || num < 1 || num > totalDraws) {
      return "號碼無效";
    }
    if (numbers.has(num)) {
      return "號碼重複";
    }
    numbers.add(num);
    actualCounts.set(draft.prizeId, (actualCounts.get(draft.prizeId) || 0) + 1);
  }

  if (numbers.size !== totalDraws) {
    return "號碼需涵蓋 1 至 N";
  }

  for (const prize of regular) {
    if ((actualCounts.get(prize.id) || 0) !== prize.quantity) {
      return `獎項「${prize.name || prize.grade}」配置數量不符`;
    }
  }

  return null;
}

function syncScheduledProducts(db) {
  const stamp = nowIso();

  const scheduledDrafts = db
    .prepare(
      `SELECT * FROM products
       WHERE status = 'draft'
         AND schedule_enabled = 1
         AND schedule_start IS NOT NULL
         AND schedule_start <= ?`
    )
    .all(stamp);

  scheduledDrafts.forEach((row) => {
    if (row.schedule_end && row.schedule_end < stamp) return;
    publishProduct(db, row.id);
  });

  const autoUnpublishRows = db
    .prepare(
      `SELECT * FROM products
       WHERE status = 'published' AND soldout_visibility = 'auto_unpublish'`
    )
    .all();

  autoUnpublishRows.forEach((row) => {
    if (isProductSoldOut(db, row.id, row)) {
      db.prepare(
        `UPDATE products SET status = 'unpublished', updated_at = ? WHERE id = ?`
      ).run(stamp, row.id);
    }
  });
}


function validatePublish(product, prizes) {
  const regular = prizes.filter((p) => !p.isLastOne);
  const lastOnes = prizes.filter((p) => p.isLastOne);

  if (lastOnes.length > 1) {
    return "只能設定一個最後賞";
  }

  if (lastOnes.length === 1) {
    if (!lastOnes[0].name) {
      return "最後賞需有名稱";
    }
  }

  if (regular.length === 0) {
    return "至少需要一個獎項";
  }

  for (const prize of regular) {
    if (!prize.name) {
      return "每個獎項需有名稱";
    }
    if (prize.quantity < 1) {
      return "獎項數量至少為 1";
    }
  }

  const total = regular.reduce((sum, p) => sum + p.quantity, 0);
  if (total !== product.total_draws) {
    return `獎項數量加總（${total}）需等於總抽數（${product.total_draws}）`;
  }

  return null;
}

function publishProduct(db, productId) {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  if (!product) {
    return { error: "找不到商品", status: 404 };
  }
  if (product.status === "published") {
    return { error: "商品已上架", status: 400 };
  }

  const existingSlots = db
    .prepare(`SELECT COUNT(*) AS count FROM slots WHERE product_id = ?`)
    .get(productId).count;

  if (product.status === "unpublished" && existingSlots > 0) {
    const prizeRows = db
      .prepare(`SELECT * FROM prizes WHERE product_id = ? ORDER BY sort_order ASC`)
      .all(productId)
      .map(rowToPrize);
    const error = validatePublish(product, prizeRows);
    if (error) {
      return { error, status: 400 };
    }

    const regular = prizeRows.filter((p) => !p.isLastOne);
    const expected = regular.reduce((sum, p) => sum + p.quantity, 0);
    const slotPrizeCount = db
      .prepare(`SELECT COUNT(*) AS count FROM slots WHERE product_id = ?`)
      .get(productId).count;

    if (expected === product.total_draws && slotPrizeCount === product.total_draws) {
      db.prepare(
        `UPDATE products SET status = 'published', updated_at = ? WHERE id = ?`
      ).run(nowIso(), productId);
      return { product: buildProductDetail(db, productId, { includeSlots: true, revealAll: true }) };
    }
  }

  const prizeRows = db
    .prepare(`SELECT * FROM prizes WHERE product_id = ? ORDER BY sort_order ASC`)
    .all(productId)
    .map(rowToPrize);

  const error = validatePublish(product, prizeRows);
  if (error) {
    return { error, status: 400 };
  }

  const drawMode = DRAW_MODES.includes(product.draw_mode) ? product.draw_mode : "shuffle";
  let manualDrafts = null;

  if (drawMode === "manual") {
    manualDrafts = getSlotDrafts(db, productId);
    const manualError = validateManualSlots(manualDrafts, prizeRows, product.total_draws);
    if (manualError) {
      return { error: manualError, status: 400 };
    }
  }

  const regular = prizeRows.filter((p) => !p.isLastOne);
  const shuffledPrizes = [];
  const numbers = [];

  if (drawMode === "manual") {
    manualDrafts.forEach((draft) => {
      shuffledPrizes.push(draft.prizeId);
      numbers.push(draft.number);
    });
  } else {
    const prizeBag = [];
    for (const prize of regular) {
      for (let i = 0; i < prize.quantity; i++) {
        prizeBag.push(prize.id);
      }
    }
    shuffledPrizes.push(...shuffle(prizeBag));
    numbers.push(
      ...shuffle(Array.from({ length: product.total_draws }, (_, i) => i + 1))
    );
  }

  const insertSlot = db.prepare(
    `INSERT INTO slots (id, product_id, slot_index, number, prize_id, scratched, scratched_at)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`
  );

  const stamp = nowIso();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM slots WHERE product_id = ?`).run(productId);
    db.prepare(`DELETE FROM slot_drafts WHERE product_id = ?`).run(productId);

    for (let i = 0; i < product.total_draws; i++) {
      insertSlot.run(
        createSlotId(),
        productId,
        i,
        numbers[i],
        shuffledPrizes[i]
      );
    }

    db.prepare(
      `UPDATE products SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`
    ).run(stamp, stamp, productId);
  });

  tx();
  return { product: buildProductDetail(db, productId, { includeSlots: true, revealAll: true }) };
}

function resetBoard(db, productId) {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  if (!product) {
    return { error: "找不到商品", status: 404 };
  }

  const slotCount = db
    .prepare(`SELECT COUNT(*) AS count FROM slots WHERE product_id = ?`)
    .get(productId).count;

  if (slotCount === 0) {
    return { error: "尚未產生面板", status: 400 };
  }

  db.prepare(
    `UPDATE slots SET scratched = 0, scratched_at = NULL WHERE product_id = ?`
  ).run(productId);
  db.prepare(`UPDATE products SET updated_at = ? WHERE id = ?`).run(nowIso(), productId);

  return { product: buildProductDetail(db, productId, { includeSlots: true, revealAll: true }) };
}

function loadSlotWithPrize(db, productId, slotIndex) {
  return db
    .prepare(
      `SELECT s.*, p.grade AS prize_grade, p.name AS prize_name, p.image AS prize_image, p.is_last_one AS prize_is_last_one
       FROM slots s
       JOIN prizes p ON p.id = s.prize_id
       WHERE s.product_id = ? AND s.slot_index = ?`
    )
    .get(productId, slotIndex);
}

function slotPrizePayload(slot) {
  return {
    id: slot.prize_id,
    grade: slot.prize_grade,
    name: slot.prize_name,
    image: slot.prize_image,
    isLastOne: false,
  };
}

function claimSlot(db, productId, slotIndex) {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  if (!product) {
    return { error: "找不到商品", status: 404 };
  }
  const playable = isProductPlayable(product);
  if (!playable.ok) {
    return { error: playable.reason, status: 400 };
  }

  const slot = loadSlotWithPrize(db, productId, slotIndex);
  if (!slot) {
    return { error: "找不到格子", status: 404 };
  }

  const scratchedCount = getScratchedCount(db, productId);
  return {
    result: {
      slotIndex: slot.slot_index,
      number: slot.number,
      scratched: Boolean(slot.scratched),
      prize: slotPrizePayload(slot),
      lastOneAwarded: null,
      remaining: remainingByPrize(db, productId),
      scratchedCount,
      remainingDraws: Math.max(0, product.total_draws - scratchedCount),
    },
  };
}

function scratchSlot(db, productId, slotIndex) {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  if (!product) {
    return { error: "找不到商品", status: 404 };
  }
  const playable = isProductPlayable(product);
  if (!playable.ok) {
    return { error: playable.reason, status: 400 };
  }

  const slot = loadSlotWithPrize(db, productId, slotIndex);
  if (!slot) {
    return { error: "找不到格子", status: 404 };
  }

  const scratchedCount = getScratchedCount(db, productId);
  const isLastSlot = scratchedCount === product.total_draws - 1 && !slot.scratched;
  const lastOne = lastOnePrize(db, productId);

  if (!slot.scratched) {
    db.prepare(
      `UPDATE slots SET scratched = 1, scratched_at = ? WHERE id = ?`
    ).run(nowIso(), slot.id);
    deleteScratchSnapshot(db, productId, slotIndex);
  }

  const nextCount = getScratchedCount(db, productId);
  const result = {
    slotIndex: slot.slot_index,
    number: slot.number,
    scratched: true,
    prize: slotPrizePayload(slot),
    lastOneAwarded: null,
    remaining: remainingByPrize(db, productId),
    scratchedCount: nextCount,
    remainingDraws: Math.max(0, product.total_draws - nextCount),
  };

  if (isLastSlot && lastOne) {
    result.lastOneAwarded = lastOne;
  }

  return { result };
}

function rowToSettings(row) {
  if (!row) return null;
  return {
    shopTitle: row.shop_title,
    showPrice: Boolean(row.show_price),
    showProgress: Boolean(row.show_progress),
    hideSoldOut: Boolean(row.hide_soldout),
    defaultShowRemaining: Boolean(row.default_show_remaining),
    updatedAt: row.updated_at,
  };
}

function getSettings(db) {
  const row = db.prepare(`SELECT * FROM settings WHERE id = 1`).get();
  return rowToSettings(row);
}

function getAdminPin(db) {
  const row = db.prepare(`SELECT admin_pin FROM settings WHERE id = 1`).get();
  const pin = row ? String(row.admin_pin || "") : "";
  return /^\d{4}$/.test(pin) ? pin : "0000";
}

function saveSettings(db, input) {
  const current = getSettings(db) || {
    shopTitle: "Dottery",
    showPrice: true,
    showProgress: true,
    hideSoldOut: false,
    defaultShowRemaining: true,
  };

  const next = {
    shopTitle: String(input.shopTitle != null ? input.shopTitle : current.shopTitle).trim(),
    showPrice: input.showPrice != null ? Boolean(input.showPrice) : current.showPrice,
    showProgress:
      input.showProgress != null ? Boolean(input.showProgress) : current.showProgress,
    hideSoldOut: input.hideSoldOut != null ? Boolean(input.hideSoldOut) : current.hideSoldOut,
    defaultShowRemaining:
      input.defaultShowRemaining != null
        ? Boolean(input.defaultShowRemaining)
        : current.defaultShowRemaining,
    updatedAt: nowIso(),
  };

  const pinInput = input.adminPin != null ? String(input.adminPin).trim() : "";
  if (pinInput) {
    if (!/^\d{4}$/.test(pinInput)) {
      const err = new Error("密碼須為4位數字");
      err.status = 400;
      throw err;
    }
    db.prepare(
      `UPDATE settings SET
        shop_title = ?, show_price = ?, show_progress = ?,
        hide_soldout = ?, default_show_remaining = ?, admin_pin = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      next.shopTitle || "Dottery",
      next.showPrice ? 1 : 0,
      next.showProgress ? 1 : 0,
      next.hideSoldOut ? 1 : 0,
      next.defaultShowRemaining ? 1 : 0,
      pinInput,
      next.updatedAt
    );
  } else {
    db.prepare(
      `UPDATE settings SET
        shop_title = ?, show_price = ?, show_progress = ?,
        hide_soldout = ?, default_show_remaining = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      next.shopTitle || "Dottery",
      next.showPrice ? 1 : 0,
      next.showProgress ? 1 : 0,
      next.hideSoldOut ? 1 : 0,
      next.defaultShowRemaining ? 1 : 0,
      next.updatedAt
    );
  }

  return getSettings(db);
}

function countTopPrizesRemaining(remaining) {
  if (!remaining || !remaining.length) return { left: 0, total: 0 };
  const top = remaining.slice(0, 2);
  return top.reduce(
    (acc, item) => {
      acc.left += Number(item.remaining) || 0;
      acc.total += Number(item.quantity) || 0;
      return acc;
    },
    { left: 0, total: 0 }
  );
}

function periodStartIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function parseDateRange(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (from > to) return null;
  return { fromIso: from.toISOString(), untilIso: to.toISOString() };
}

function aggregateScratchPnL(db, sinceIso, untilIso) {
  const scratches = untilIso
    ? db
        .prepare(
          `SELECT pr.id AS product_id, pr.name AS product_name, pr.price, p.cost AS prize_cost
           FROM slots s
           JOIN prizes p ON p.id = s.prize_id
           JOIN products pr ON pr.id = s.product_id
           WHERE s.scratched = 1 AND s.scratched_at >= ? AND s.scratched_at <= ?`
        )
        .all(sinceIso, untilIso)
    : db
        .prepare(
          `SELECT pr.id AS product_id, pr.name AS product_name, pr.price, p.cost AS prize_cost
           FROM slots s
           JOIN prizes p ON p.id = s.prize_id
           JOIN products pr ON pr.id = s.product_id
           WHERE s.scratched = 1 AND s.scratched_at >= ?`
        )
        .all(sinceIso);

  let revenue = 0;
  let cost = 0;
  const byProduct = {};

  scratches.forEach((row) => {
    const price = Number(row.price) || 0;
    const prizeCost = Number(row.prize_cost) || 0;
    revenue += price;
    cost += prizeCost;

    if (!byProduct[row.product_id]) {
      byProduct[row.product_id] = {
        productId: row.product_id,
        productName: row.product_name,
        revenue: 0,
        cost: 0,
        profit: 0,
        scratches: 0,
      };
    }
    const item = byProduct[row.product_id];
    item.revenue += price;
    item.cost += prizeCost;
    item.scratches += 1;
  });

  const lastOneRows = untilIso
    ? db
        .prepare(
          `SELECT pr.id AS product_id, pr.name AS product_name, lo.cost
           FROM products pr
           JOIN prizes lo ON lo.product_id = pr.id AND lo.is_last_one = 1
           JOIN (
             SELECT product_id, MAX(scratched_at) AS last_at
             FROM slots
             WHERE scratched = 1
             GROUP BY product_id
           ) last ON last.product_id = pr.id
           WHERE last.last_at >= ? AND last.last_at <= ?
             AND (SELECT COUNT(*) FROM slots s WHERE s.product_id = pr.id AND s.scratched = 1) = pr.total_draws`
        )
        .all(sinceIso, untilIso)
    : db
        .prepare(
          `SELECT pr.id AS product_id, pr.name AS product_name, lo.cost
           FROM products pr
           JOIN prizes lo ON lo.product_id = pr.id AND lo.is_last_one = 1
           JOIN (
             SELECT product_id, MAX(scratched_at) AS last_at
             FROM slots
             WHERE scratched = 1
             GROUP BY product_id
           ) last ON last.product_id = pr.id
           WHERE last.last_at >= ?
             AND (SELECT COUNT(*) FROM slots s WHERE s.product_id = pr.id AND s.scratched = 1) = pr.total_draws`
        )
        .all(sinceIso);

  lastOneRows.forEach((row) => {
    const lastOneCost = Number(row.cost) || 0;
    if (!lastOneCost) return;
    cost += lastOneCost;
    if (!byProduct[row.product_id]) {
      byProduct[row.product_id] = {
        productId: row.product_id,
        productName: row.product_name,
        revenue: 0,
        cost: 0,
        profit: 0,
        scratches: 0,
      };
    }
    byProduct[row.product_id].cost += lastOneCost;
  });

  Object.values(byProduct).forEach((item) => {
    item.profit = item.revenue - item.cost;
  });

  return {
    revenue,
    cost,
    profit: revenue - cost,
    scratches: scratches.length,
    byProduct,
  };
}

function buildDashboard(db, options = {}) {
  const rows = db.prepare(`SELECT * FROM products ORDER BY sort_order ASC, updated_at DESC`).all();
  let totalDraws = 0;
  let totalScratched = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let publishedCount = 0;
  let draftCount = 0;
  let unpublishedCount = 0;
  let soldOutCount = 0;

  const allTimePnL = aggregateScratchPnL(db, "1970-01-01T00:00:00.000Z");
  totalCost = allTimePnL.cost;

  const periods = {
    7: aggregateScratchPnL(db, periodStartIso(7)),
    30: aggregateScratchPnL(db, periodStartIso(30)),
  };

  let customPnL = null;
  const customRange = parseDateRange(options.from, options.to);
  if (customRange) {
    customPnL = aggregateScratchPnL(db, customRange.fromIso, customRange.untilIso);
  }

  const products = rows.map((row) => {
    const product = rowToProduct(row);
    const scratchedCount =
      row.status === "draft" ? 0 : getScratchedCount(db, row.id);
    const remainingDraws = Math.max(0, product.totalDraws - scratchedCount);
    const sellThrough =
      product.totalDraws > 0 ? scratchedCount / product.totalDraws : 0;
    const revenue = scratchedCount * (Number(product.price) || 0);
    const remaining = row.status === "draft" ? [] : remainingByPrize(db, row.id);
    const topPrizes = countTopPrizesRemaining(remaining);
    const done =
      row.status !== "draft" &&
      product.totalDraws > 0 &&
      scratchedCount >= product.totalDraws;

    totalDraws += product.totalDraws;
    totalScratched += scratchedCount;
    totalRevenue += revenue;

    if (row.status === "published") publishedCount += 1;
    if (row.status === "draft") draftCount += 1;
    if (row.status === "unpublished") unpublishedCount += 1;
    if (done) soldOutCount += 1;

    return {
      id: product.id,
      name: product.name,
      status: product.status,
      price: product.price,
      totalDraws: product.totalDraws,
      scratchedCount,
      remainingDraws,
      sellThrough,
      revenue,
      totalCost: (allTimePnL.byProduct[product.id] || {}).cost || 0,
      totalProfit: (allTimePnL.byProduct[product.id] || {}).profit || 0,
      period7: periods[7].byProduct[product.id] || null,
      period30: periods[30].byProduct[product.id] || null,
      periodCustom: customPnL ? customPnL.byProduct[product.id] || null : null,
      topPrizes,
      publishedAt: product.publishedAt,
      done,
    };
  });

  const recentActivity = db
    .prepare(
      `SELECT s.slot_index, s.number, s.scratched_at, p.grade, p.name,
              pr.id AS product_id, pr.name AS product_name
       FROM slots s
       JOIN prizes p ON p.id = s.prize_id
       JOIN products pr ON pr.id = s.product_id
       WHERE s.scratched = 1
       ORDER BY s.scratched_at DESC
       LIMIT 12`
    )
    .all()
    .map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      slotIndex: row.slot_index,
      number: row.number,
      scratchedAt: row.scratched_at,
      prize: { grade: row.grade, name: row.name },
    }));

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const alerts = [];

  products.forEach((product) => {
    if (product.status !== "published") return;

    const publishedAt = product.publishedAt ? Date.parse(product.publishedAt) : NaN;
    if (
      product.totalDraws > 0 &&
      product.sellThrough < 0.2 &&
      Number.isFinite(publishedAt) &&
      now - publishedAt >= sevenDaysMs
    ) {
      alerts.push({
        type: "slow",
        productId: product.id,
        productName: product.name,
        value: `${Math.round(product.sellThrough * 100)}%`,
      });
    }

    if (product.topPrizes.total > 0 && product.topPrizes.left <= 1) {
      alerts.push({
        type: "lowStock",
        productId: product.id,
        productName: product.name,
        value: `${product.topPrizes.left}/${product.topPrizes.total}`,
      });
    }
  });

  return {
    summary: {
      productCount: rows.length,
      publishedCount,
      draftCount,
      unpublishedCount,
      soldOutCount,
      totalDraws,
      totalScratched,
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      sellThrough: totalDraws > 0 ? totalScratched / totalDraws : 0,
    },
    periods: {
      7: {
        revenue: periods[7].revenue,
        cost: periods[7].cost,
        profit: periods[7].profit,
        scratches: periods[7].scratches,
      },
      30: {
        revenue: periods[30].revenue,
        cost: periods[30].cost,
        profit: periods[30].profit,
        scratches: periods[30].scratches,
      },
      custom: customPnL
        ? {
            revenue: customPnL.revenue,
            cost: customPnL.cost,
            profit: customPnL.profit,
            scratches: customPnL.scratches,
            from: options.from,
            to: options.to,
          }
        : null,
    },
    products,
    recentActivity,
    alerts,
  };
}

function getScratchSnapshots(db, productId) {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  if (!product) {
    return { error: "找不到商品", status: 404 };
  }
  const playable = isProductPlayable(product);
  if (!playable.ok) {
    return { error: playable.reason, status: 400 };
  }

  const rows = db
    .prepare(
      `SELECT slot_index, width, height, image, number, sealed, updated_at
       FROM scratch_snapshots WHERE product_id = ?`
    )
    .all(productId);

  const snapshots = {};
  rows.forEach((row) => {
    snapshots[String(row.slot_index)] = {
      width: row.width,
      height: row.height,
      image: row.image,
      number: row.number ?? null,
      sealed: Boolean(row.sealed),
      updatedAt: row.updated_at,
    };
  });

  return { snapshots };
}

function saveScratchSnapshot(db, productId, slotIndex, payload) {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  if (!product) {
    return { error: "找不到商品", status: 404 };
  }
  const playable = isProductPlayable(product);
  if (!playable.ok) {
    return { error: playable.reason, status: 400 };
  }

  const slot = db
    .prepare(`SELECT scratched FROM slots WHERE product_id = ? AND slot_index = ?`)
    .get(productId, slotIndex);
  if (!slot) {
    return { error: "找不到格子", status: 404 };
  }
  if (slot.scratched) {
    deleteScratchSnapshot(db, productId, slotIndex);
    return {
      result: {
        slotIndex,
        skipped: true,
        scratched: true,
      },
    };
  }

  const width = Number(payload.width);
  const height = Number(payload.height);
  const image = String(payload.image || "");
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0 || !image) {
    return { error: "快照資料無效", status: 400 };
  }

  const updatedAt = nowIso();
  db.prepare(
    `INSERT INTO scratch_snapshots (product_id, slot_index, width, height, image, number, sealed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(product_id, slot_index) DO UPDATE SET
       width = excluded.width,
       height = excluded.height,
       image = excluded.image,
       number = excluded.number,
       sealed = excluded.sealed,
       updated_at = excluded.updated_at`
  ).run(
    productId,
    slotIndex,
    width,
    height,
    image,
    payload.number != null ? Number(payload.number) : null,
    payload.sealed ? 1 : 0,
    updatedAt
  );

  return {
    result: {
      slotIndex,
      width,
      height,
      number: payload.number != null ? Number(payload.number) : null,
      sealed: Boolean(payload.sealed),
      updatedAt,
    },
  };
}

function deleteScratchSnapshot(db, productId, slotIndex) {
  db.prepare(`DELETE FROM scratch_snapshots WHERE product_id = ? AND slot_index = ?`).run(
    productId,
    slotIndex
  );
}

module.exports = {
  STATUSES,
  THEMES,
  FOIL_PRESETS,
  DRAW_MODES,
  SOLDOUT_VISIBILITY,
  nowIso,
  shuffle,
  rowToProduct,
  rowToPrize,
  getPrizes,
  getSlots,
  getSlotDrafts,
  saveSlotDrafts,
  getScratchedCount,
  remainingByPrize,
  winningNumbers,
  lastOnePrize,
  buildProductDetail,
  createProductId,
  createPrizeId,
  createSlotId,
  normalizePrizeInput,
  computeEconomics,
  validatePublish,
  validateManualSlots,
  buildSlotDraftsFromPrizeSpecs,
  publishProduct,
  resetBoard,
  claimSlot,
  scratchSlot,
  getScratchSnapshots,
  saveScratchSnapshot,
  deleteScratchSnapshot,
  getSettings,
  saveSettings,
  getAdminPin,
  countTopPrizesRemaining,
  buildDashboard,
  computeOptimalCols,
  getScheduleStatus,
  isProductPlayable,
  isProductVisibleInShop,
  isProductSoldOut,
  syncScheduledProducts,
};
