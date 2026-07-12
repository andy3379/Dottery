"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const DB_PATH = path.join(DATA_DIR, "dottery.db");

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function wrapDb(raw) {
  return {
    prepare(sql) {
      const stmt = raw.prepare(sql);
      return {
        run(...params) {
          return stmt.run(...params);
        },
        get(...params) {
          return stmt.get(...params);
        },
        all(...params) {
          return stmt.all(...params);
        },
      };
    },
    exec(sql) {
      raw.exec(sql);
    },
    transaction(fn) {
      return (...args) => {
        raw.exec("BEGIN");
        try {
          const result = fn(...args);
          raw.exec("COMMIT");
          return result;
        } catch (error) {
          raw.exec("ROLLBACK");
          throw error;
        }
      };
    },
  };
}

function createDb() {
  ensureDirs();
  const raw = new DatabaseSync(DB_PATH);
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA foreign_keys = ON");

  const db = wrapDb(raw);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT '',
      total_draws INTEGER NOT NULL DEFAULT 12,
      cols INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'draft',
      theme TEXT NOT NULL DEFAULT 'light',
      foil_preset TEXT NOT NULL DEFAULT 'silver',
      foil_image TEXT NOT NULL DEFAULT '',
      show_remaining INTEGER NOT NULL DEFAULT 1,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prizes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      grade TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      is_last_one INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      number INTEGER NOT NULL,
      prize_id TEXT NOT NULL,
      scratched INTEGER NOT NULL DEFAULT 0,
      scratched_at TEXT,
      UNIQUE (product_id, slot_index),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (prize_id) REFERENCES prizes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_prizes_product ON prizes(product_id);
    CREATE INDEX IF NOT EXISTS idx_slots_product ON slots(product_id);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_title TEXT NOT NULL DEFAULT 'Dottery',
      show_price INTEGER NOT NULL DEFAULT 1,
      show_progress INTEGER NOT NULL DEFAULT 1,
      hide_soldout INTEGER NOT NULL DEFAULT 0,
      default_show_remaining INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scratch_snapshots (
      product_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      image TEXT NOT NULL,
      number INTEGER,
      sealed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (product_id, slot_index),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scratch_snapshots_product ON scratch_snapshots(product_id);
  `);

  const settingsRow = db.prepare(`SELECT id FROM settings WHERE id = 1`).get();
  if (!settingsRow) {
    db.prepare(
      `INSERT INTO settings (id, shop_title, show_price, show_progress, hide_soldout, default_show_remaining, updated_at)
       VALUES (1, 'Dottery', 1, 1, 0, 1, ?)`
    ).run(new Date().toISOString());
  }

  const prizeColumns = db.prepare(`PRAGMA table_info(prizes)`).all();
  if (!prizeColumns.some((col) => col.name === "cost")) {
    db.exec(`ALTER TABLE prizes ADD COLUMN cost REAL NOT NULL DEFAULT 0`);
  }

  return db;
}

module.exports = {
  createDb,
  ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  DB_PATH,
};
