(function (global) {
  "use strict";

  const STORAGE_KEY = "dottery-price-calc";
  const listeners = new Set();

  function normalizePrize(prize) {
    if (!prize || typeof prize !== "object") return null;
    return {
      id: prize.id != null ? String(prize.id) : "",
      grade: prize.grade != null ? String(prize.grade) : "",
      name: prize.name != null ? String(prize.name) : "",
      image: prize.image != null ? String(prize.image) : "",
    };
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const prize = normalizePrize(raw.prize);
    const lastOne = normalizePrize(raw.lastOne);
    return {
      key: String(raw.key || ""),
      productId: String(raw.productId || ""),
      productName: String(raw.productName || ""),
      slotIndex: Number(raw.slotIndex),
      number: raw.number != null ? raw.number : null,
      unitPrice: Number(raw.unitPrice) || 0,
      prize: prize,
      lastOne: lastOne,
    };
  }

  function normalizeSession(data) {
    if (!data || !data.active || !data.code) return null;
    const billed = Array.isArray(data.billed) ? data.billed.map(String) : [];
    const items = Array.isArray(data.items)
      ? data.items.map(normalizeItem).filter(Boolean)
      : [];
    return {
      active: true,
      code: String(data.code),
      total: Number(data.total) || 0,
      scratchCount: Number(data.scratchCount) || 0,
      billed: billed,
      items: items,
    };
  }

  function emptySession(code) {
    return {
      active: true,
      code: code || generateCode(),
      total: 0,
      scratchCount: 0,
      billed: [],
      items: [],
    };
  }

  function read() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeSession(JSON.parse(raw));
    } catch (_) {
      return null;
    }
  }

  function write(data) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function notify() {
    const data = read();
    listeners.forEach((fn) => {
      try {
        fn(data);
      } catch (_) {}
    });
  }

  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function formatAmount(value) {
    return `$${(Number(value) || 0).toFixed(2)}`;
  }

  function start() {
    write(emptySession());
    notify();
    return read();
  }

  function ensureStarted() {
    const existing = read();
    if (existing) return existing;
    return start();
  }

  function end() {
    const receipt = read();
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    notify();
    return receipt;
  }

  function get() {
    return read();
  }

  function recordScratch(productId, slotIndex, unitPrice, details) {
    let data = read();
    if (!data) data = emptySession();

    const key = `${productId}:${slotIndex}`;
    if (data.billed.indexOf(key) !== -1) return data;

    const info = details && typeof details === "object" ? details : {};
    const item = normalizeItem({
      key: key,
      productId: productId,
      productName: info.productName,
      slotIndex: slotIndex,
      number: info.number,
      unitPrice: unitPrice,
      prize: info.prize,
      lastOne: info.lastOneAwarded || info.lastOne,
    });

    data.billed.push(key);
    data.items.push(item);
    data.scratchCount += 1;
    data.total =
      Math.round((data.total + (Number(unitPrice) || 0)) * 100) / 100;
    write(data);
    notify();
    return read();
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.add(fn);
    return function () {
      listeners.delete(fn);
    };
  }

  global.PriceCalc = {
    start,
    ensureStarted,
    end,
    get,
    recordScratch,
    formatAmount,
    subscribe,
  };
})(window);
