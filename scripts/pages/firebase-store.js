import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const GATE_EMAIL = "gate@dottery.app";
const PIN_LENGTH = 6;
const IMAGE_INLINE_LIMIT = 4096;

const firebaseConfig = {
  apiKey: "AIzaSyAFL6YEQKqdCyvPLUX_2BVXXO4UZ4NdNVQ",
  authDomain: "dottery-e6d2a.firebaseapp.com",
  projectId: "dottery-e6d2a",
  storageBucket: "dottery-e6d2a.firebasestorage.app",
  messagingSenderId: "561960736402",
  appId: "1:561960736402:web:8d71c7395ac78e8445b84b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const store = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const GATE_CSS = [
  ".fbgate{position:fixed;inset:0;z-index:2147483000;background:#ffffff;color:#171717;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16vh 1.25rem 2rem;gap:2.75rem;-webkit-user-select:none;user-select:none;touch-action:manipulation;}",
  ".fbgate__dots{display:flex;align-items:center;justify-content:center;gap:1.15rem;min-height:1.25rem;}",
  ".fbgate__dot{width:12px;height:12px;border-radius:50%;border:1.5px solid #171717;background:transparent;transition:background 120ms ease,border-color 120ms ease;}",
  ".fbgate__dot.is-filled{background:#171717;border-color:#171717;}",
  ".fbgate__dots.is-shake{animation:fbgate-shake .35s ease;}",
  "@keyframes fbgate-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}",
  ".fbgate__keypad{width:100%;max-width:292px;display:grid;grid-template-columns:repeat(3,1fr);gap:1rem 1.2rem;justify-items:center;}",
  ".fbgate.is-loading .fbgate__keypad{visibility:hidden;}",
  ".fbgate__key{width:74px;height:74px;border-radius:50%;border:none;background:#e8e8ed;color:#171717;display:grid;place-items:center;padding:0;box-shadow:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 90ms ease,transform 90ms ease;}",
  ".fbgate__key:hover{background:#dedee4;}",
  ".fbgate__key:active{background:#c7c7cc;transform:scale(.94);}",
  ".fbgate__digit{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;font-size:1.95rem;font-weight:400;line-height:1;color:#171717;}",
  ".fbgate__icon{display:inline-flex;width:1.65rem;height:1.65rem;color:#171717;}",
  ".fbgate__icon svg{width:100%;height:100%;}",
  ".fbgate__spacer{width:74px;height:74px;}",
  "@media (max-width:380px){.fbgate{padding-top:12vh;gap:2.25rem;}.fbgate__keypad{max-width:272px;gap:.85rem 1rem;}.fbgate__key,.fbgate__spacer{width:68px;height:68px;}.fbgate__digit{font-size:1.75rem;}}",
].join("\n");

const DELETE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H9l-6 6 6 6h12a2 2 0 002-2V8a2 2 0 00-2-2z"/><path d="M16 10l-4 4M12 10l4 4"/></svg>';

let gateEl = null;
let dotEls = [];
let dotsRowEl = null;
let digits = "";
let busy = false;
let keyHandler = null;

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = GATE_CSS;
  document.head.appendChild(style);
}

function syncDots() {
  dotEls.forEach((dot, index) => {
    dot.classList.toggle("is-filled", index < digits.length);
  });
}

function shakeDots() {
  dotsRowEl.classList.remove("is-shake");
  void dotsRowEl.offsetWidth;
  dotsRowEl.classList.add("is-shake");
}

async function submitPin() {
  busy = true;
  try {
    await signInWithEmailAndPassword(auth, GATE_EMAIL, digits);
  } catch (_e) {
    shakeDots();
    window.setTimeout(() => {
      digits = "";
      syncDots();
      busy = false;
    }, 340);
  }
}

function pushDigit(digit) {
  if (busy || digits.length >= PIN_LENGTH) return;
  digits += digit;
  syncDots();
  if (digits.length === PIN_LENGTH) submitPin();
}

function popDigit() {
  if (busy || !digits.length) return;
  digits = digits.slice(0, -1);
  syncDots();
}

function buildGate() {
  injectStyles();
  gateEl = document.createElement("div");
  gateEl.className = "fbgate is-loading";

  dotsRowEl = document.createElement("div");
  dotsRowEl.className = "fbgate__dots";
  dotEls = Array.from({ length: PIN_LENGTH }, () => {
    const dot = document.createElement("span");
    dot.className = "fbgate__dot";
    dotsRowEl.appendChild(dot);
    return dot;
  });
  gateEl.appendChild(dotsRowEl);

  const keypad = document.createElement("div");
  keypad.className = "fbgate__keypad";
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].forEach((key) => {
    if (key === "") {
      const spacer = document.createElement("div");
      spacer.className = "fbgate__spacer";
      keypad.appendChild(spacer);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fbgate__key";
    if (key === "del") {
      const icon = document.createElement("span");
      icon.className = "fbgate__icon";
      icon.innerHTML = DELETE_ICON;
      button.appendChild(icon);
      button.addEventListener("click", popDigit);
    } else {
      const digit = document.createElement("span");
      digit.className = "fbgate__digit";
      digit.textContent = key;
      button.appendChild(digit);
      button.addEventListener("click", () => pushDigit(key));
    }
    keypad.appendChild(button);
  });
  gateEl.appendChild(keypad);

  document.body.appendChild(gateEl);
}

function showKeypad() {
  gateEl.classList.remove("is-loading");
  if (keyHandler) return;
  keyHandler = (event) => {
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      pushDigit(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      popDigit();
    }
  };
  document.addEventListener("keydown", keyHandler);
}

function removeGate() {
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
  if (gateEl) {
    gateEl.remove();
    gateEl = null;
  }
}

function waitForAuth() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) {
        stop();
        resolve(user);
      } else {
        showKeypad();
      }
    });
  });
}

function hashString(value) {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = ((h2 * 31) ^ c) >>> 0;
  }
  return h1.toString(36) + h2.toString(36) + value.length.toString(36);
}

function extractImage(value, images) {
  if (typeof value !== "string") return value;
  if (value.indexOf("data:") !== 0 || value.length <= IMAGE_INLINE_LIMIT) return value;
  const id = hashString(value);
  images[id] = value;
  return "@img:" + id;
}

function resolveImage(value, images) {
  if (typeof value !== "string" || value.indexOf("@img:") !== 0) return value;
  return images[value.slice(5)] || "";
}

function defaultSettings() {
  return {
    shopTitle: "Dottery",
    showPrice: true,
    showProgress: true,
    hideSoldOut: false,
    defaultShowRemaining: true,
    updatedAt: new Date().toISOString(),
  };
}

function buildDocs(db) {
  const docs = {};
  const images = {};
  docs["meta/settings"] = { j: JSON.stringify(db.settings || defaultSettings()) };
  (db.products || []).forEach((product) => {
    const clone = JSON.parse(JSON.stringify(product));
    clone.coverImage = extractImage(clone.coverImage, images);
    clone.detailImage = extractImage(clone.detailImage, images);
    clone.foilImage = extractImage(clone.foilImage, images);
    (clone.prizes || []).forEach((prize) => {
      prize.image = extractImage(prize.image, images);
    });
    docs["products/" + product.id] = { j: JSON.stringify(clone) };
  });
  Object.keys(db.snapshots || {}).forEach((productId) => {
    const perProduct = db.snapshots[productId] || {};
    Object.keys(perProduct).forEach((index) => {
      docs["snapshots/" + productId + "__" + index] = {
        j: JSON.stringify({ productId, slotIndex: index, snap: perProduct[index] }),
      };
    });
  });
  Object.keys(images).forEach((id) => {
    docs["images/" + id] = { j: images[id] };
  });
  return docs;
}

const lastWritten = {};
let flushTimer = null;
let flushChain = Promise.resolve();
let syncDotEl = null;
let syncDotTimer = null;

function showSyncFailure(error) {
  console.error("Firestore sync failed", error);
  if (!syncDotEl) {
    syncDotEl = document.createElement("div");
    syncDotEl.style.cssText =
      "position:fixed;right:12px;bottom:12px;width:10px;height:10px;border-radius:50%;background:#dc2626;z-index:2147483001;pointer-events:none;";
    document.body.appendChild(syncDotEl);
  }
  syncDotEl.style.display = "";
  if (syncDotTimer) window.clearTimeout(syncDotTimer);
  syncDotTimer = window.setTimeout(() => {
    syncDotEl.style.display = "none";
  }, 6000);
}

async function flushWithRetry(db) {
  let delay = 1000;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await flushNow(db);
      return;
    } catch (error) {
      if (attempt === 2) {
        showSyncFailure(error);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

async function flushNow(db) {
  const docs = buildDocs(db);
  const ops = [];
  Object.keys(docs).forEach((key) => {
    const payload = docs[key];
    const serialized = JSON.stringify(payload);
    if (lastWritten[key] === serialized) return;
    const [col, id] = key.split("/");
    ops.push(
      setDoc(doc(store, col, id), payload).then(() => {
        lastWritten[key] = serialized;
      })
    );
  });
  Object.keys(lastWritten).forEach((key) => {
    if (docs[key]) return;
    const [col, id] = key.split("/");
    ops.push(
      deleteDoc(doc(store, col, id)).then(() => {
        delete lastWritten[key];
      })
    );
  });
  await Promise.all(ops);
}

const remote = {
  db: null,
  fresh: false,
  save(db) {
    remote.db = db;
    if (flushTimer) window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flushChain = flushChain.then(() => flushWithRetry(remote.db));
    }, 250);
  },
};

async function loadRemoteDb() {
  const [settingsSnap, productsSnap, imagesSnap, snapshotsSnap] = await Promise.all([
    getDoc(doc(store, "meta", "settings")),
    getDocs(collection(store, "products")),
    getDocs(collection(store, "images")),
    getDocs(collection(store, "snapshots")),
  ]);

  const images = {};
  imagesSnap.forEach((snap) => {
    images[snap.id] = String(snap.data().j || "");
    lastWritten["images/" + snap.id] = JSON.stringify({ j: images[snap.id] });
  });

  const db = { products: [], settings: defaultSettings(), snapshots: {} };

  remote.fresh = !settingsSnap.exists();
  if (settingsSnap.exists()) {
    try {
      db.settings = JSON.parse(settingsSnap.data().j);
      lastWritten["meta/settings"] = JSON.stringify({ j: settingsSnap.data().j });
    } catch (_e) {}
  }

  productsSnap.forEach((snap) => {
    try {
      const product = JSON.parse(snap.data().j);
      lastWritten["products/" + snap.id] = JSON.stringify({ j: snap.data().j });
      product.coverImage = resolveImage(product.coverImage, images);
      product.detailImage = resolveImage(product.detailImage, images);
      product.foilImage = resolveImage(product.foilImage, images);
      (product.prizes || []).forEach((prize) => {
        prize.image = resolveImage(prize.image, images);
      });
      db.products.push(product);
    } catch (_e) {}
  });

  snapshotsSnap.forEach((snap) => {
    try {
      const row = JSON.parse(snap.data().j);
      lastWritten["snapshots/" + snap.id] = JSON.stringify({ j: snap.data().j });
      if (!db.snapshots[row.productId]) db.snapshots[row.productId] = {};
      db.snapshots[row.productId][String(row.slotIndex)] = row.snap;
    } catch (_e) {}
  });

  return db;
}

async function init() {
  buildGate();
  await waitForAuth();
  remote.db = await loadRemoteDb();
  removeGate();
  if (typeof window.__dotteryRemoteAttach === "function") {
    window.__dotteryRemoteAttach(remote);
  }
}

init();
