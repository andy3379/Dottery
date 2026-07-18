"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function write(rel, content) {
  const target = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function copy(rel, outRel) {
  write(outRel || rel, read(rel));
}

function replaceAll(content, replacements, label) {
  let out = content;
  for (const [from, to] of replacements) {
    if (!out.includes(from)) {
      throw new Error(`[${label}] 找不到片段: ${from}`);
    }
    out = out.split(from).join(to);
  }
  return out;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

write(".nojekyll", "");

copy("scripts/pages/api-shim.js", "api-shim.js");

write(
  "index.html",
  replaceAll(
    read("home.html"),
    [
      ['href="/admin"', 'href="admin/"'],
      ['<script src="/page-transition-prep.js"></script>', '<script src="api-shim.js"></script>\n  <script src="page-transition-prep.js"></script>'],
      ['href="/home.css"', 'href="home.css"'],
      ['href="/page-transition.css"', 'href="page-transition.css"'],
      ['<script src="/page-transition.js"></script>', '<script src="page-transition.js"></script>'],
      ['<script src="/home.js"></script>', '<script src="home.js"></script>'],
    ],
    "home.html"
  )
);

write(
  "board.html",
  replaceAll(
    read("board.html"),
    [
      ['href="/shop"', 'href="index.html"'],
      ['<script src="/page-transition-prep.js"></script>', '<script src="api-shim.js"></script>\n  <script src="page-transition-prep.js"></script>'],
      ['href="/styles.css"', 'href="styles.css"'],
      ['href="/page-transition.css"', 'href="page-transition.css"'],
      ['src="/page-transition.js"', 'src="page-transition.js"'],
      ['src="/scratch-texture.js"', 'src="scratch-texture.js"'],
      ['src="/scratch-effects.js"', 'src="scratch-effects.js"'],
      ['src="/scratch-card.js"', 'src="scratch-card.js"'],
      ['src="/scratch-persist.js"', 'src="scratch-persist.js"'],
      ['src="/product-config.js"', 'src="product-config.js"'],
      ['src="/board-engine.js"', 'src="board-engine.js"'],
      ['src="/map-view.js"', 'src="map-view.js"'],
      ['src="/board-info.js"', 'src="board-info.js"'],
      ['src="/app.js"', 'src="app.js"'],
    ],
    "board.html"
  )
);

write(
  "admin/index.html",
  replaceAll(
    read("admin/index.html"),
    [
      ['href="/admin/admin.css"', 'href="admin.css"'],
      [
        '<script src="/admin/economics.js"></script>',
        '<script src="../api-shim.js"></script>\n  <script src="economics.js"></script>',
      ],
      ['<script src="/admin/prize-number-spec.js"></script>', '<script src="prize-number-spec.js"></script>'],
      ['<script src="/admin/admin.js"></script>', '<script src="admin.js"></script>'],
    ],
    "admin/index.html"
  )
);

write(
  "page-transition.js",
  replaceAll(
    read("page-transition.js"),
    [
      [
        `return target.closest('a[href^="/board"], a[href="/shop"], a[href^="/shop?"]');`,
        `return target.closest('a[href^="board.html"], a[href^="index.html"]');`,
      ],
      [
        `document.querySelectorAll('a[href^="/board"], a[href="/shop"], a[href^="/shop?"]')`,
        `document.querySelectorAll('a[href^="board.html"], a[href^="index.html"]')`,
      ],
      [
        `if (path === "/board" || path.startsWith("/board/")) return "to-board";`,
        `if (path === "board.html") return "to-board";`,
      ],
      [
        `if (path === "/shop" || path.startsWith("/shop/")) return "to-shop";`,
        `if (path === "index.html") return "to-shop";`,
      ],
      [`assets.forEach((asset) => tasks.push(warmFetch("/" + asset)));`, `assets.forEach((asset) => tasks.push(warmFetch(asset)));`],
    ],
    "page-transition.js"
  )
);

write(
  "home.js",
  replaceAll(
    read("home.js"),
    [
      [
        "return `/board?product=${encodeURIComponent(product.id)}`;",
        "return `board.html?product=${encodeURIComponent(product.id)}`;",
      ],
    ],
    "home.js"
  )
);

write(
  "product-config.js",
  replaceAll(
    read("product-config.js"),
    [
      [`PageTransition.navigate("/shop", "to-shop");`, `PageTransition.navigate("index.html", "to-shop");`],
      [`window.location.replace("/shop");`, `window.location.replace("index.html");`],
    ],
    "product-config.js"
  )
);

write(
  "app.js",
  replaceAll(
    read("app.js"),
    [
      [`PageTransition.navigate("/shop", "to-shop");`, `PageTransition.navigate("index.html", "to-shop");`],
      [`window.location.replace("/shop");`, `window.location.replace("index.html");`],
    ],
    "app.js"
  )
);

write(
  "map-view.js",
  replaceAll(
    read("map-view.js"),
    [[`const link = event.target.closest('a[href="/shop"]');`, `const link = event.target.closest('a[href="index.html"]');`]],
    "map-view.js"
  )
);

write(
  "admin/admin.js",
  replaceAll(
    read("admin/admin.js"),
    [
      [
        "href: `/board?product=${encodeURIComponent(product.id)}`,",
        "href: `../board.html?product=${encodeURIComponent(product.id)}`,",
      ],
    ],
    "admin/admin.js"
  )
);

[
  "home.css",
  "styles.css",
  "page-transition.css",
  "page-transition-prep.js",
  "board-engine.js",
  "board-info.js",
  "scratch-card.js",
  "scratch-persist.js",
  "scratch-texture.js",
  "scratch-effects.js",
].forEach((file) => copy(file));

copy("admin/admin.css");
copy("admin/economics.js");
copy("admin/prize-number-spec.js");

process.stdout.write("docs/ 建置完成\n");
