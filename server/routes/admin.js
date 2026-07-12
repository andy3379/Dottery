"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const { nanoid } = require("nanoid");
const {
  THEMES,
  FOIL_PRESETS,
  nowIso,
  rowToProduct,
  getPrizes,
  getScratchedCount,
  buildProductDetail,
  createProductId,
  createPrizeId,
  normalizePrizeInput,
  publishProduct,
  resetBoard,
  getSettings,
  saveSettings,
  buildDashboard,
  computeOptimalCols,
} = require("../helpers");
const { UPLOADS_DIR } = require("../db");

function createAdminRouter(db, options) {
  const router = express.Router();
  const adminPassword = options.adminPassword;

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
    if (password !== adminPassword) {
      res.status(401).json({ error: "密碼錯誤" });
      return;
    }
    req.session.admin = true;
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
    res.json(saveSettings(db, body));
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
      .prepare(`SELECT * FROM products ORDER BY updated_at DESC`)
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

    db.prepare(
      `INSERT INTO products (
        id, name, description, cover_image, price, category,
        total_draws, cols, status, theme, foil_preset, foil_image,
        show_remaining, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, NULL, ?, ?)`
    ).run(
      id,
      String(body.name || "").trim(),
      String(body.description || "").trim(),
      String(body.coverImage || "").trim(),
      Number(body.price) || 0,
      String(body.category || "").trim(),
      totalDraws,
      cols,
      theme,
      foilPreset,
      String(body.foilImage || "").trim(),
      body.showRemaining === false ? 0 : 1,
      stamp,
      stamp
    );

    if (Array.isArray(body.prizes)) {
      replacePrizes(db, id, body.prizes, body.lastOne || null);
    }

    res.status(201).json(buildProductDetail(db, id, { includeSlots: true, revealAll: true }));
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

      db.prepare(
        `UPDATE products SET
          name = ?, description = ?, cover_image = ?, price = ?, category = ?,
          theme = ?, foil_preset = ?, foil_image = ?, show_remaining = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        String(body.name != null ? body.name : product.name).trim(),
        String(body.description != null ? body.description : product.description).trim(),
        String(body.coverImage != null ? body.coverImage : product.cover_image).trim(),
        body.price != null ? Number(body.price) || 0 : product.price,
        String(body.category != null ? body.category : product.category).trim(),
        theme,
        foilPreset,
        String(body.foilImage != null ? body.foilImage : product.foil_image).trim(),
        body.showRemaining === false ? 0 : body.showRemaining === true ? 1 : product.show_remaining,
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

      res.json(buildProductDetail(db, product.id, { includeSlots: true, revealAll: true }));
      return;
    }

    const totalDraws = Math.max(1, Number(body.totalDraws != null ? body.totalDraws : product.total_draws) || 12);
    const cols = computeOptimalCols(totalDraws);
    const theme = THEMES.includes(body.theme) ? body.theme : product.theme;
    const foilPreset = FOIL_PRESETS.includes(body.foilPreset)
      ? body.foilPreset
      : product.foil_preset;

    const poolChanged =
      totalDraws !== product.total_draws ||
      Array.isArray(body.prizes) ||
      body.lastOne !== undefined;

    db.prepare(
      `UPDATE products SET
        name = ?, description = ?, cover_image = ?, price = ?, category = ?,
        total_draws = ?, cols = ?, theme = ?, foil_preset = ?, foil_image = ?,
        show_remaining = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      String(body.name != null ? body.name : product.name).trim(),
      String(body.description != null ? body.description : product.description).trim(),
      String(body.coverImage != null ? body.coverImage : product.cover_image).trim(),
      body.price != null ? Number(body.price) || 0 : product.price,
      String(body.category != null ? body.category : product.category).trim(),
      totalDraws,
      cols,
      theme,
      foilPreset,
      String(body.foilImage != null ? body.foilImage : product.foil_image).trim(),
      body.showRemaining === false ? 0 : body.showRemaining === true ? 1 : product.show_remaining,
      nowIso(),
      product.id
    );

    if (Array.isArray(body.prizes) || body.lastOne !== undefined) {
      replacePrizes(
        db,
        product.id,
        body.prizes || getPrizes(db, product.id).filter((p) => !p.isLastOne),
        body.lastOne
      );
    }

    if (poolChanged) {
      db.prepare(`DELETE FROM slots WHERE product_id = ?`).run(product.id);
    }

    res.json(buildProductDetail(db, product.id, { includeSlots: true, revealAll: true }));
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
        index
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
