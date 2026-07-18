"use strict";

const express = require("express");
const {
  rowToProduct,
  getScratchedCount,
  buildProductDetail,
  claimSlot,
  scratchSlot,
  getScratchSnapshots,
  saveScratchSnapshot,
  getSettings,
  getScheduleStatus,
  isProductPlayable,
  isProductVisibleInShop,
  syncScheduledProducts,
} = require("../helpers");

function createPublicRouter(db) {
  const router = express.Router();

  router.get("/settings", (_req, res) => {
    res.json(getSettings(db));
  });

  router.get("/products", (_req, res) => {
    syncScheduledProducts(db);
    const settings = getSettings(db);
    const rows = db
      .prepare(
        `SELECT * FROM products WHERE status = 'published' ORDER BY sort_order ASC, published_at DESC`
      )
      .all();

    const products = rows
      .filter((row) => isProductVisibleInShop(db, row, settings))
      .map((row) => {
        const product = rowToProduct(row);
        const scratchedCount = getScratchedCount(db, row.id);
        const scheduleStatus = getScheduleStatus(product);
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          coverImage: product.coverImage,
          price: product.price,
          category: product.category,
          totalDraws: product.totalDraws,
          scratchedCount,
          remainingDraws: Math.max(0, product.totalDraws - scratchedCount),
          theme: product.theme,
          scheduleStatus,
          playable: scheduleStatus === "none" || scheduleStatus === "active",
        };
      });

    res.json({ products });
  });

  router.get("/products/:id", (req, res) => {
    syncScheduledProducts(db);
    const preview = req.query.preview === "1" && Boolean(req.session && req.session.admin);
    const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "找不到商品" });
      return;
    }
    if (!preview && row.status !== "published") {
      res.status(404).json({ error: "找不到商品" });
      return;
    }

    if (!preview) {
      const playable = isProductPlayable(row);
      if (!playable.ok) {
        res.status(403).json({ error: playable.reason });
        return;
      }
    }

    const detail = buildProductDetail(db, req.params.id, { includeSlots: true });
    if (preview) {
      detail.preview = true;
    }
    res.json(detail);
  });

  router.post("/products/:id/slots/:index/claim", (req, res) => {
    const slotIndex = Number(req.params.index);
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      res.status(400).json({ error: "格子索引無效" });
      return;
    }

    const result = claimSlot(db, req.params.id, slotIndex);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.result);
  });

  router.post("/products/:id/slots/:index/scratch", (req, res) => {
    const slotIndex = Number(req.params.index);
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      res.status(400).json({ error: "格子索引無效" });
      return;
    }

    const result = scratchSlot(db, req.params.id, slotIndex);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.result);
  });

  router.get("/products/:id/scratch-snapshots", (req, res) => {
    const result = getScratchSnapshots(db, req.params.id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  router.put("/products/:id/slots/:index/scratch-snapshot", (req, res) => {
    const slotIndex = Number(req.params.index);
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      res.status(400).json({ error: "格子索引無效" });
      return;
    }

    const result = saveScratchSnapshot(db, req.params.id, slotIndex, req.body || {});
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.result);
  });

  return router;
}

module.exports = { createPublicRouter };
