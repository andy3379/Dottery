"use strict";

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { nanoid } = require("nanoid");
const { createDb, ROOT, UPLOADS_DIR } = require("./db");
const { createAdminRouter } = require("./routes/admin");
const { createPublicRouter } = require("./routes/public");

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dottery";

const db = createDb();
const app = express();
const sessions = new Map();

const PUBLIC_FILES = [
  "home.html",
  "home.css",
  "home.js",
  "board.html",
  "styles.css",
  "app.js",
  "board-info.js",
  "product-config.js",
  "board-engine.js",
  "map-view.js",
  "scratch-card.js",
  "scratch-texture.js",
  "scratch-effects.js",
  "index.html",
];

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let sid = cookies.dottery_sid;
  if (!sid || !sessions.has(sid)) {
    sid = nanoid(24);
    sessions.set(sid, {});
    res.setHeader(
      "Set-Cookie",
      `dottery_sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax`
    );
  }
  req.session = sessions.get(sid);
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (req.session === null) {
      sessions.delete(sid);
      res.setHeader(
        "Set-Cookie",
        "dottery_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
      );
    } else {
      sessions.set(sid, req.session);
    }
    return originalJson(body);
  };
  next();
}

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(sessionMiddleware);

app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/api", createPublicRouter(db));
app.use("/api/admin", createAdminRouter(db, { adminPassword: ADMIN_PASSWORD }));

app.use("/admin", express.static(path.join(ROOT, "admin")));
app.get(["/admin", "/admin/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "admin", "index.html"));
});

app.get("/", (_req, res) => {
  res.redirect(302, "/shop");
});

app.get("/shop", (_req, res) => {
  res.sendFile(path.join(ROOT, "home.html"));
});

app.get("/board", (_req, res) => {
  res.sendFile(path.join(ROOT, "board.html"));
});

PUBLIC_FILES.forEach((file) => {
  app.get(`/${file}`, (_req, res) => {
    res.sendFile(path.join(ROOT, file));
  });
});

app.listen(PORT, () => {
  process.stdout.write(`Dottery http://localhost:${PORT}\n`);
  process.stdout.write(`Admin  http://localhost:${PORT}/admin  password=${ADMIN_PASSWORD}\n`);
});
