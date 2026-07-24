"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const { nanoid } = require("nanoid");
const {
  THEMES,
  FOIL_PRESETS,
  DRAW_MODES,
  SOLDOUT_VISIBILITY,
  nowIso,
  rowToProduct,
  getPrizes,
  getScratchedCount,
  buildProductDetail,
  createProductId,
  createPrizeId,
  normalizePrizeInput,
  publishProduct,
  duplicateProduct,
  archiveProduct,
  unarchiveProduct,
  resetBoard,
  getSettings,
  saveSettings,
  getAdminPin,
  buildDashboard,
  computeOptimalCols,
  saveSlotDrafts,
  validateManualSlots,
  buildSlotDraftsFromPrizeSpecs,
} = require("../helpers");
const { UPLOADS_DIR } = require("../db");

function createAdminRouter(db) {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".png";
      cb(null, `${nanoid(12)}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        cb(new Error("僅接受圖片檔"));
        return;
      }
      cb(null, true);
    },
  });

  function requireAuth(req, res, next) {
    if (req.session && req.session.admin) {
      next();
      return;
    }
    res.status(401).json({ error: "未登入" });
  }

  router.post("/login", (req, res) => {
    const password = String((req.body && req.body.password) || "");
    if (!/^\d{4}$/.test(password) || password !== getAdminPin(db)) {
      res.status(401).json({ error: "密碼錯誤" });
      return;
    }
    req.session.admin = true;
    res.json({ ok: true });
  });

  router.post("/verify-pin", (req, res) => {
    const password = String((req.body && req.body.password) || "");
    if (!/^\d{4}$/.test(password) || password !== getAdminPin(db)) {
      res.status(401).json({ error: "密碼錯誤" });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/logout", (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });

  router.get("/me", (req, res) => {
    res.json({ authenticated: Boolean(req.session && req.session.admin) });
  });

  router.use(requireAuth);

  router.get("/dashboard", (req, res) => {
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    res.json(buildDashboard(db, { from, to }));
  });

  router.get("/settings", (_req, res) => {
    res.json(getSettings(db));
  });

  router.put("/settings", (req, res) => {
    const body = req.body || {};
    try {
      res.json(saveSettings(db, body));
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message || "儲存失敗" });
    }
  });

  router.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "未上傳檔案" });
      return;
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  router.get("/products", (_req, res) => {
    const rows = db
      .prepare(`SELECT * FROM products ORDER BY sort_order ASC, updated_at DESC`)
      .all();

    const products = rows.map((row) => {
      const product = rowToProduct(row);
      const scratchedCount =
        row.status === "draft" ? 0 : getScratchedCount(db, row.id);
      return {
        ...product,
        scratchedCount,
        remainingDraws: Math.max(0, product.totalDraws - scratchedCount),
        prizeCount: db
          .prepare(`SELECT COUNT(*) AS count FROM prizes WHERE product_id = ? AND is_last_one = 0`)
          .get(row.id).count,
      };
    });

    res.json({ products });
  });

  router.get("/products/:id", (req, res) => {
    const detail = buildProductDetail(db, req.params.id, {
      includeSlots: true,
      revealAll: true,
      includeSlotDrafts: true,
    });
    if (!detail) {
      res.status(404).json({ error: "找不到商品" });
      return;
    }
    res.json(detail);
  });

  router.post("/products", (req, res) => {
    const body = req.body || {};
    const id = createProductId();
    const stamp = nowIso();
    const totalDraws = Math.max(1, Number(body.totalDraws) || 12);
    const cols = computeOptimalCols(totalDraws);
    const theme = THEMES.includes(body.theme) ? body.theme : "light";
    const foilPreset = FOIL_PRESETS.includes(body.foilPreset)
      ? body.foilPreset
      : "silver";
    const schedule = parseScheduleFields(body, null);
    const drawMode = DRAW_MODES.includes(body.drawMode) ? body.drawMode : "shuffle";
    const sortOrder = Number(body.sortOrder) || 0;
    const soldoutVisibility = SOLDOUT_VISIBILITY.includes(body.soldoutVisibility)
      ? body.soldoutVisibility
      : "show_soldout";

    db.prepare(
      `INSERT INTO products (
        id, name, description, cover_image, detail_image, price, category,
        total_draws, cols, status, theme, foil_preset, foil_image,
        show_remaining, schedule_enabled, schedule_start, schedule_end,
        draw_mode, sort_order, soldout_visibility,
        published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    ).run(
      id,
      String(body.name || "").trim(),
      String(body.description || "").trim(),
      String(body.coverImage || "").trim(),
      String(body.detailImage || "").trim(),
      Number(body.price) || 0,
      String(body.category || "").trim(),
      totalDraws,
      cols,
      theme,
      foilPreset,
      String(body.foilImage || "").trim(),
      body.showRemaining === false ? 0 : 1,
      schedule.scheduleEnabled ? 1 : 0,
      schedule.scheduleStart,
      schedule.scheduleEnd,
      drawMode,
      sortOrder,
      soldoutVisibility,
      stamp,
      stamp
    );

    if (Array.isArray(body.prizes)) {
      replacePrizes(db, id, body.prizes, body.lastOne || null);
    }

    applyPrizeNumberSpecsIfValid(db, id, body, drawMode, totalDraws);

    res.status(201).json(buildProductDetail(db, id, { includeSlots: true, revealAll: true, includeSlotDrafts: true }));
  });

  router.put("/products/:id", (req, res) => {
    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!product) {
      res.status(404).json({ error: "找不到商品" });
      return;
    }

    const body = req.body || {};
    const published = product.status === "published";

    if (published) {
      const theme = THEMES.includes(body.theme) ? body.theme : product.theme;
      const foilPreset = FOIL_PRESETS.includes(body.foilPreset)
        ? body.foilPreset
        : product.foil_preset;
      const schedule = parseScheduleFields(body, product);
      const soldoutVisibility = SOLDOUT_VISIBILITY.includes(body.soldoutVisibility)
        ? body.soldoutVisibility
        : product.soldout_visibility;
      const sortOrder =
        body.sortOrder != null ? Number(body.sortOrder) || 0 : product.sort_order;

      db.prepare(
        `UPDATE products SET
          name = ?, description = ?, cover_image = ?, detail_image = ?, price = ?, category = ?,
          theme = ?, foil_preset = ?, foil_image = ?, show_remaining = ?,
          schedule_enabled = ?, schedule_start = ?, schedule_end = ?,
          sort_order = ?, soldout_visibility = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        String(body.name != null ? body.name : product.name).trim(),
        String(body.description != null ? body.description : product.description).trim(),
        String(body.coverImage != null ? body.coverImage : product.cover_image).trim(),
        String(body.detailImage != null ? body.detailImage : product.detail_image || "").trim(),
        body.price != null ? Number(body.price) || 0 : product.price,
        String(body.category != null ? body.category : product.category).trim(),
        theme,
        foilPreset,
        String(body.foilImage != null ? body.foilImage : product.foil_image).trim(),
        body.showRemaining === false ? 0 : body.showRemaining === true ? 1 : product.show_remaining,
        schedule.scheduleEnabled ? 1 : 0,
        schedule.scheduleStart,
        schedule.scheduleEnd,
        sortOrder,
        soldoutVisibility,
        nowIso(),
        product.id
      );

      if (Array.isArray(body.prizes)) {
        const updateCost = db.prepare(
          `UPDATE prizes SET cost = ? WHERE id = ? AND product_id = ?`
        );
        body.prizes.forEach((prize) => {
          if (!prize.id) return;
          updateCost.run(Number(prize.cost) || 0, prize.id, product.id);
        });
      }

      if (body.lastOne && body.lastOne.id) {
        db.prepare(`UPDATE prizes SET cost = ? WHERE id = ? AND product_id = ?`).run(
          Number(body.lastOne.cost) || 0,
          body.lastOne.id,
          product.id
        );
      }

      res.json(buildProductDetail(db, product.id, { includeSlots: true, revealAll: true, includeSlotDrafts: true }));
      return;
    }

    const totalDraws = Math.max(1, Number(body.totalDraws != null ? body.totalDraws : product.total_draws) || 12);
    const cols = computeOptimalCols(totalDraws);
    const theme = THEMES.includes(body.theme) ? body.theme : product.theme;
    const foilPreset = FOIL_PRESETS.includes(body.foilPreset)
      ? body.foilPreset
      : product.foil_preset;
    const schedule = parseScheduleFields(body, product);
    const drawMode = DRAW_MODES.includes(body.drawMode) ? body.drawMode : product.draw_mode;
    const sortOrder =
      body.sortOrder != null ? Number(body.sortOrder) || 0 : product.sort_order;
    const soldoutVisibility = SOLDOUT_VISIBILITY.includes(body.soldoutVisibility)
      ? body.soldoutVisibility
      : product.soldout_visibility;

    const prizePoolChanged = Array.isArray(body.prizes) || body.lastOne !== undefined;
    const drawModeChanged = drawMode !== product.draw_mode;
    const totalDrawsChanged = totalDraws !== product.total_draws;
    const poolChanged = totalDrawsChanged || prizePoolChanged || drawModeChanged;

    db.prepare(
      `UPDATE products SET
        name = ?, description = ?, cover_image = ?, detail_image = ?, price = ?, category = ?,
        total_draws = ?, cols = ?, theme = ?, foil_preset = ?, foil_image = ?,
        show_remaining = ?, schedule_enabled = ?, schedule_start = ?, schedule_end = ?,
        draw_mode = ?, sort_order = ?, soldout_visibility = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      String(body.name != null ? body.name : product.name).trim(),
      String(body.description != null ? body.description : product.description).trim(),
      String(body.coverImage != null ? body.coverImage : product.cover_image).trim(),
      String(body.detailImage != null ? body.detailImage : product.detail_image || "").trim(),
      body.price != null ? Number(body.price) || 0 : product.price,
      String(body.category != null ? body.category : product.category).trim(),
      totalDraws,
      cols,
      theme,
      foilPreset,
      String(body.foilImage != null ? body.foilImage : product.foil_image).trim(),
      body.showRemaining === false ? 0 : body.showRemaining === true ? 1 : product.show_remaining,
      schedule.scheduleEnabled ? 1 : 0,
      schedule.scheduleStart,
      schedule.scheduleEnd,
      drawMode,
      sortOrder,
      soldoutVisibility,
      nowIso(),
      product.id
    );

    if (poolChanged) {
      db.prepare(`DELETE FROM slots WHERE product_id = ?`).run(product.id);
    }

    if (totalDrawsChanged || drawModeChanged) {
      db.prepare(`DELETE FROM slot_drafts WHERE product_id = ?`).run(product.id);
    }

    if (prizePoolChanged) {
      replacePrizes(
        db,
        product.id,
        body.prizes || getPrizes(db, product.id).filter((p) => !p.isLastOne),
        body.lastOne
      );
      db.prepare(`DELETE FROM slot_drafts WHERE product_id = ?`).run(product.id);
    }

    if (!applyPrizeNumberSpecsIfValid(db, product.id, body, drawMode, totalDraws)) {
      if (Array.isArray(body.slotDrafts) && !prizePoolChanged && !totalDrawsChanged && !drawModeChanged) {
        const prizeRows = getPrizes(db, product.id);
        const manualError = validateManualSlots(body.slotDrafts, prizeRows, totalDraws);
        if (!manualError) {
          saveSlotDrafts(db, product.id, body.slotDrafts, totalDraws);
        }
      }
    }

    res.json(buildProductDetail(db, product.id, { includeSlots: true, revealAll: true, includeSlotDrafts: true }));
  });

  router.put("/products/:id/slot-drafts", (req, res) => {
    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!product) {
      res.status(404).json({ error: "找不到商品" });
      return;
    }
    if (product.status === "published") {
      res.status(400).json({ error: "上架中無法修改盤面" });
      return;
    }

    const body = req.body || {};
    const totalDraws = product.total_draws;

    if (body.specs && typeof body.specs === "object") {
      const prizeRows = getPrizes(db, product.id);
      const built = buildSlotDraftsFromPrizeSpecs(prizeRows, body.specs, totalDraws);
      if (built.error) {
        res.status(400).json({ error: built.error });
        return;
      }
      const draftResult = saveSlotDrafts(db, product.id, built.drafts, totalDraws);
      if (draftResult.error) {
        res.status(draftResult.status).json({ error: draftResult.error });
        return;
      }
      res.json({ slotDrafts: draftResult.drafts });
      return;
    }

    if (Array.isArray(body.slots)) {
      const prizeRows = getPrizes(db, product.id);
      const manualError = validateManualSlots(body.slots, prizeRows, totalDraws);
      if (manualError) {
        res.status(400).json({ error: manualError });
        return;
      }
    }

    const draftResult = saveSlotDrafts(db, product.id, body.slots || [], totalDraws);
    if (draftResult.error) {
      res.status(draftResult.status).json({ error: draftResult.error });
      return;
    }
    res.json({ slotDrafts: draftResult.drafts });
  });

  router.delete("/products/:id", (req, res) => {
    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!product) {
      res.status(404).json({ error: "找不到商品" });
      return;
    }
    if (product.status === "published") {
      res.status(400).json({ error: "請先下架再刪除" });
      return;
    }

    db.prepare(`DELETE FROM slots WHERE product_id = ?`).run(product.id);
    db.prepare(`DELETE FROM slot_drafts WHERE product_id = ?`).run(product.id);
    db.prepare(`DELETE FROM prizes WHERE product_id = ?`).run(product.id);
    db.prepare(`DELETE FROM products WHERE id = ?`).run(product.id);
    res.json({ ok: true });
  });

  router.post("/products/:id/publish", (req, res) => {
    const result = publishProduct(db, req.params.id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.product);
  });

  router.post("/products/:id/unpublish", (req, res) => {
    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!product) {
      res.status(404).json({ error: "找不到商品" });
      return;
    }
    if (product.status !== "published") {
      res.status(400).json({ error: "商品未上架" });
      return;
    }

    db.prepare(
      `UPDATE products SET status = 'unpublished', updated_at = ? WHERE id = ?`
    ).run(nowIso(), product.id);

    res.json(buildProductDetail(db, product.id, { includeSlots: true, revealAll: true }));
  });

  router.post("/products/:id/duplicate", (req, res) => {
    const result = duplicateProduct(db, req.params.id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json(result.product);
  });

  router.post("/products/:id/archive", (req, res) => {
    const result = archiveProduct(db, req.params.id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.product);
  });

  router.post("/products/:id/unarchive", (req, res) => {
    const result = unarchiveProduct(db, req.params.id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.product);
  });

  router.post("/products/:id/reset", (req, res) => {
    const result = resetBoard(db, req.params.id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.product);
  });

  return router;
}

function applyPrizeNumberSpecsIfValid(db, productId, body, drawMode, totalDraws) {
  if (drawMode !== "manual" || !body.prizeNumberSpecs || typeof body.prizeNumberSpecs !== "object") {
    return false;
  }
  const prizeRows = getPrizes(db, productId);
  const built = buildSlotDraftsFromPrizeSpecs(prizeRows, body.prizeNumberSpecs, totalDraws);
  if (built.error) {
    return false;
  }
  saveSlotDrafts(db, productId, built.drafts, totalDraws);
  return true;
}

function parseScheduleFields(body, current) {
  const scheduleEnabled =
    body.scheduleEnabled != null
      ? Boolean(body.scheduleEnabled)
      : Boolean(current && current.schedule_enabled);
  const scheduleStart =
    body.scheduleStart !== undefined
      ? body.scheduleStart || null
      : current
        ? current.schedule_start || null
        : null;
  const scheduleEnd =
    body.scheduleEnd !== undefined
      ? body.scheduleEnd || null
      : current
        ? current.schedule_end || null
        : null;
  return { scheduleEnabled, scheduleStart, scheduleEnd };
}

function replacePrizes(db, productId, prizesInput, lastOneInput) {
  const prizes = (prizesInput || [])
    .filter((p) => !p.isLastOne)
    .map((p, index) => normalizePrizeInput(p, index));

  let lastOne = null;
  if (lastOneInput && (lastOneInput.name || lastOneInput.image)) {
    lastOne = normalizePrizeInput(
      {
        ...lastOneInput,
        quantity: 1,
        isLastOne: true,
        sortOrder: 9999,
      },
      9999
    );
  }

  const insert = db.prepare(
    `INSERT INTO prizes (id, product_id, grade, name, image, quantity, cost, is_last_one, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM prizes WHERE product_id = ?`).run(productId);
    prizes.forEach((prize, index) => {
      insert.run(
        prize.id || createPrizeId(),
        productId,
        prize.grade,
        prize.name,
        prize.image,
        prize.quantity,
        prize.cost,
        0,
        Number.isFinite(prize.sortOrder) ? prize.sortOrder : index
      );
    });
    if (lastOne) {
      insert.run(
        lastOne.id || createPrizeId(),
        productId,
        lastOne.grade || "",
        lastOne.name,
        lastOne.image,
        1,
        lastOne.cost,
        1,
        9999
      );
    }
  });

  tx();
}

module.exports = { createAdminRouter };
