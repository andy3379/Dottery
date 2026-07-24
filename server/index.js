"use strict";

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { nanoid } = require("nanoid");
const { createDb, ROOT, UPLOADS_DIR } = require("./db");
const { getAdminPin } = require("./helpers");
const { createAdminRouter } = require("./routes/admin");
const { createPublicRouter } = require("./routes/public");

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD =
  process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);

const db = createDb();
const app = express();
const sessions = new Map();

function sessionCookie(sid, maxAge) {
  let value = `dottery_sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax`;
  if (IS_PROD) value += "; Secure";
  if (maxAge != null) value += `; Max-Age=${maxAge}`;
  return value;
}

const PUBLIC_FILES = [
  "home.html",
  "home.css",
  "home.js",
  "page-transition.css",
  "page-transition-prep.js",
  "page-transition.js",
  "fullscreen-auto.js",
  "price-calc.js",
  "board.html",
  "styles.css",
  "app.js",
  "board-info.js",
  "product-config.js",
  "board-engine.js",
  "map-view.js",
  "scratch-card.js",
  "scratch-persist.js",
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
    res.setHeader("Set-Cookie", sessionCookie(sid));
  }
  req.session = sessions.get(sid);
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (req.session === null) {
      sessions.delete(sid);
      res.setHeader("Set-Cookie", sessionCookie("", 0));
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
app.use("/api/admin", createAdminRouter(db));

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

app.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`Dottery http://localhost:${PORT}\n`);
  process.stdout.write(`Admin  http://localhost:${PORT}/admin  pin=${getAdminPin(db)}\n`);
});
