"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const sandbox = {
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  Response: class {
    constructor(body, init) {
      this._body = body;
      this.status = (init && init.status) || 200;
      this.ok = this.status >= 200 && this.status < 300;
    }
    json() {
      return Promise.resolve(JSON.parse(this._body));
    }
  },
  Promise,
  JSON,
  Math,
  Date,
  Number,
  String,
  Boolean,
  Object,
  Array,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  TypeError,
  Error,
};
sandbox.window = sandbox;

const code = fs.readFileSync(path.join(__dirname, "pages", "api-shim.js"), "utf8");
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const fetch = sandbox.window.fetch;

async function api(pathStr, init) {
  const res = await fetch(pathStr, init);
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  let r = await api("/api/settings");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.shopTitle, "Dottery");

  r = await api("/api/products");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.products.length, 1);
  const productId = r.data.products[0].id;
  assert.strictEqual(r.data.products[0].totalDraws, 12);

  r = await api(`/api/products/${productId}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.slots.length, 12);
  assert.ok(r.data.slots.every((s) => !s.scratched && s.number === undefined));
  assert.ok(r.data.lastOne && r.data.lastOne.isLastOne);

  r = await api(`/api/products/${productId}/slots/0/claim`, { method: "POST" });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.number >= 1 && r.data.number <= 12);
  assert.strictEqual(r.data.scratched, false);

  r = await api(`/api/products/${productId}/slots/0/scratch`, { method: "POST" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.scratched, true);
  assert.strictEqual(r.data.scratchedCount, 1);
  assert.strictEqual(r.data.remainingDraws, 11);

  r = await api(`/api/products/${productId}`);
  assert.strictEqual(r.data.scratchedCount, 1);
  assert.ok(r.data.slots.find((s) => s.slotIndex === 0).scratched);

  r = await api(`/api/products/${productId}/slots/3/scratch-snapshot`, {
    method: "PUT",
    body: JSON.stringify({ width: 10, height: 10, image: "data:image/webp;base64,x", number: 5, sealed: true }),
  });
  assert.strictEqual(r.status, 200);

  r = await api(`/api/products/${productId}/scratch-snapshots`);
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.snapshots["3"]);
  assert.strictEqual(r.data.snapshots["3"].sealed, true);

  r = await api(`/api/products/${productId}/slots/3/scratch`, { method: "POST" });
  assert.strictEqual(r.status, 200);
  r = await api(`/api/products/${productId}/scratch-snapshots`);
  assert.strictEqual(r.data.snapshots["3"], undefined);

  r = await api("/api/admin/dashboard");
  assert.strictEqual(r.status, 401);

  r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: "wrong" }) });
  assert.strictEqual(r.status, 401);

  r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: "dottery" }) });
  assert.strictEqual(r.status, 200);

  r = await api("/api/admin/me");
  assert.strictEqual(r.data.authenticated, true);

  r = await api("/api/admin/dashboard");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.summary.productCount, 1);
  assert.strictEqual(r.data.summary.totalScratched, 2);
  assert.strictEqual(r.data.recentActivity.length, 2);

  r = await api("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: "測試商品",
      totalDraws: 3,
      price: 100,
      prizes: [
        { grade: "A", name: "A賞", quantity: 1 },
        { grade: "B", name: "B賞", quantity: 2 },
      ],
      lastOne: { name: "最後賞" },
    }),
  });
  assert.strictEqual(r.status, 201);
  const newId = r.data.id;
  assert.strictEqual(r.data.status, "draft");
  assert.strictEqual(r.data.prizes.filter((p) => !p.isLastOne).length, 2);

  r = await api(`/api/admin/products/${newId}/publish`, { method: "POST" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.status, "published");
  assert.strictEqual(r.data.slots.length, 3);
  assert.ok(r.data.slots.every((s) => s.prize && s.prize.name));

  r = await api("/api/products");
  assert.strictEqual(r.data.products.length, 2);

  r = await api(`/api/admin/products/${newId}/unpublish`, { method: "POST" });
  assert.strictEqual(r.status, 200);
  r = await api("/api/products");
  assert.strictEqual(r.data.products.length, 1);

  r = await api(`/api/admin/products/${newId}`, { method: "DELETE" });
  assert.strictEqual(r.status, 200);

  r = await api(`/api/admin/products/${productId}/reset`, { method: "POST" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.scratchedCount, 0);

  r = await api("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify({ shopTitle: "測試商店" }),
  });
  assert.strictEqual(r.data.shopTitle, "測試商店");

  r = await api("/api/admin/logout", { method: "POST" });
  assert.strictEqual(r.status, 200);
  r = await api("/api/admin/me");
  assert.strictEqual(r.data.authenticated, false);

  process.stdout.write("所有測試通過\n");
}

main().catch((error) => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exit(1);
});
