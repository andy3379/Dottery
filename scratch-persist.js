(function () {
  "use strict";

  const PREFIX = "dottery-scratch:";
  const saveTimers = new Map();

  function storeKey(productId) {
    return PREFIX + String(productId);
  }

  function readStore(productId) {
    try {
      const raw = localStorage.getItem(storeKey(productId));
      return raw ? JSON.parse(raw) : {};
    } catch (_error) {
      return {};
    }
  }

  function writeStore(productId, store) {
    try {
      localStorage.setItem(storeKey(productId), JSON.stringify(store));
    } catch (_error) {}
  }

  function serializeSnapshot(snap) {
    if (!snap || !snap.imageData || !snap.width || !snap.height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = snap.width;
    canvas.height = snap.height;
    canvas.getContext("2d").putImageData(snap.imageData, 0, 0);
    return {
      width: snap.width,
      height: snap.height,
      image: canvas.toDataURL("image/webp", 0.82),
    };
  }

  function deserializeSnapshot(stored) {
    if (!stored || !stored.image) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = stored.width || img.naturalWidth;
        const height = stored.height || img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve({
          width,
          height,
          imageData: ctx.getImageData(0, 0, width, height),
        });
      };
      img.onerror = () => resolve(null);
      img.src = stored.image;
    });
  }

  function bakeResidueThumb(snap, size) {
    if (!snap || !snap.imageData || !snap.width || !snap.height) return null;
    const px = Math.max(8, Math.floor(size));
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    const full = document.createElement("canvas");
    full.width = snap.width;
    full.height = snap.height;
    full.getContext("2d").putImageData(snap.imageData, 0, 0);
    ctx.beginPath();
    ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(full, 0, 0, px, px);
    return canvas;
  }

  async function fetchRemoteStore(productId) {
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/scratch-snapshots`);
      if (!response.ok) return {};
      const data = await response.json();
      return data.snapshots || {};
    } catch (_error) {
      return {};
    }
  }

  function mergeStores(local, remote) {
    const merged = { ...local };
    Object.entries(remote).forEach(([index, remoteEntry]) => {
      const localEntry = merged[index];
      if (!localEntry) {
        merged[index] = remoteEntry;
        return;
      }
      const localAt = Number(localEntry.updatedAt) || 0;
      const remoteAt = Number(remoteEntry.updatedAt) || 0;
      if (remoteAt >= localAt) {
        merged[index] = remoteEntry;
      }
    });
    return merged;
  }

  function syncSlotToApi(productId, slotIndex, snap, meta) {
    const payload = serializeSnapshot(snap);
    if (!payload) return;
    const body = {
      ...payload,
      number: meta && meta.number != null ? meta.number : null,
      sealed: Boolean(meta && meta.sealed),
    };
    fetch(
      `/api/products/${encodeURIComponent(productId)}/slots/${slotIndex}/scratch-snapshot`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }
    ).catch(() => {});
  }

  function saveSlot(productId, slotIndex, snap, meta) {
    const payload = serializeSnapshot(snap);
    if (!payload) return;
    const store = readStore(productId);
    store[String(slotIndex)] = {
      ...payload,
      number: meta && meta.number != null ? meta.number : null,
      sealed: Boolean(meta && meta.sealed),
      updatedAt: Date.now(),
    };
    writeStore(productId, store);

    const timerKey = `${productId}:${slotIndex}`;
    const existing = saveTimers.get(timerKey);
    if (existing) clearTimeout(existing);
    saveTimers.set(
      timerKey,
      setTimeout(() => {
        saveTimers.delete(timerKey);
        syncSlotToApi(productId, slotIndex, snap, meta);
      }, 800)
    );
  }

  function removeSlot(productId, slotIndex) {
    const store = readStore(productId);
    delete store[String(slotIndex)];
    writeStore(productId, store);
    const timerKey = `${productId}:${slotIndex}`;
    const existing = saveTimers.get(timerKey);
    if (existing) clearTimeout(existing);
    saveTimers.delete(timerKey);
  }

  async function loadAll(productId) {
    const local = readStore(productId);
    const remote = await fetchRemoteStore(productId);
    const merged = mergeStores(local, remote);
    writeStore(productId, merged);

    const entries = Object.entries(merged);
    const map = new Map();
    await Promise.all(
      entries.map(async ([index, stored]) => {
        const snap = await deserializeSnapshot(stored);
        if (!snap) return;
        map.set(Number(index), {
          snap,
          number: stored.number ?? null,
          sealed: Boolean(stored.sealed),
        });
      })
    );
    return map;
  }

  function flushPending(productId) {
    saveTimers.forEach((timer, key) => {
      if (!key.startsWith(`${productId}:`)) return;
      clearTimeout(timer);
      saveTimers.delete(key);
    });
  }

  window.ScratchPersist = {
    saveSlot,
    removeSlot,
    loadAll,
    flushPending,
    serializeSnapshot,
    deserializeSnapshot,
    bakeResidueThumb,
  };
})();
