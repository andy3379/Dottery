(function () {
  "use strict";

  var DB_KEY = "dottery-pages-db";
  var AUTH_KEY = "dottery-pages-admin";
  var ADMIN_PASSWORD = "dottery";
  var THEMES = ["light", "warm", "cool", "dark", "rose"];
  var FOIL_PRESETS = ["silver", "gold", "color"];
  var LAYOUT = { slotSize: 88, gap: 24, zoomTargetSize: 300, zoomPadding: 0.88 };

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId(size) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var out = "";
    for (var i = 0; i < size; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function shuffle(array) {
    var items = array.slice();
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function computeOptimalCols(slotCount, aspect) {
    if (slotCount <= 1) return 1;
    var ratio = aspect > 0 ? aspect : 1;
    var minCols = 2;
    if (slotCount > 12) minCols = 4;
    if (slotCount > 36) minCols = 8;
    var maxCols = slotCount;
    var targetCols = Math.round(Math.sqrt(slotCount * ratio));
    targetCols = clamp(targetCols, minCols, maxCols);
    for (var i = 0; i < 12; i++) {
      var rows = Math.ceil(slotCount / targetCols);
      var gridAspect = targetCols / Math.max(rows, 1);
      if (gridAspect < ratio * 0.92 && targetCols < maxCols) {
        targetCols += 1;
      } else if (gridAspect > ratio * 1.08 && targetCols > minCols) {
        targetCols -= 1;
      } else {
        break;
      }
    }
    return targetCols;
  }

  function defaultSettings() {
    return {
      shopTitle: "Dottery",
      showPrice: true,
      showProgress: true,
      hideSoldOut: false,
      defaultShowRemaining: true,
      updatedAt: nowIso(),
    };
  }

  function coverSvg(bg, fg) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">' +
      '<rect width="600" height="400" fill="' + bg + '"/>' +
      '<circle cx="300" cy="200" r="96" fill="' + fg + '"/>' +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function seedDb() {
    var db = { products: [], settings: defaultSettings(), snapshots: {} };
    var stamp = nowIso();
    var product = {
      id: makeId(10),
      name: "Dottery No.1",
      description: "共 12 抽，全數刮完可獲得最後賞。",
      coverImage: coverSvg("#1f2430", "#e8b34b"),
      price: 150,
      category: "示範",
      totalDraws: 12,
      status: "draft",
      theme: "dark",
      foilPreset: "gold",
      foilImage: "",
      showRemaining: true,
      publishedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
      prizes: [
        { id: makeId(10), grade: "A", name: "A賞 公仔", image: "", quantity: 1, cost: 0, isLastOne: false, sortOrder: 0 },
        { id: makeId(10), grade: "B", name: "B賞 掛軸", image: "", quantity: 2, cost: 0, isLastOne: false, sortOrder: 1 },
        { id: makeId(10), grade: "C", name: "C賞 壓克力立牌", image: "", quantity: 3, cost: 0, isLastOne: false, sortOrder: 2 },
        { id: makeId(10), grade: "D", name: "D賞 徽章", image: "", quantity: 6, cost: 0, isLastOne: false, sortOrder: 3 },
        { id: makeId(10), grade: "", name: "最後賞 簽名板", image: "", quantity: 1, cost: 0, isLastOne: true, sortOrder: 9999 },
      ],
      slots: [],
    };
    db.products.push(product);
    publishProduct(db, product.id);
    return db;
  }

  function loadDb() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products) && parsed.settings) {
          return parsed;
        }
      }
    } catch (_e) {}
    var db = seedDb();
    saveDb(db);
    return db;
  }

  function saveDb(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (_e) {}
  }

  function findProduct(db, id) {
    for (var i = 0; i < db.products.length; i++) {
      if (db.products[i].id === id) return db.products[i];
    }
    return null;
  }

  function sortedPrizes(product) {
    return product.prizes.slice().sort(function (a, b) {
      var lastDiff = (a.isLastOne ? 1 : 0) - (b.isLastOne ? 1 : 0);
      if (lastDiff !== 0) return lastDiff;
      var orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.grade).localeCompare(String(b.grade));
    });
  }

  function regularPrizes(product) {
    return sortedPrizes(product).filter(function (p) {
      return !p.isLastOne;
    });
  }

  function lastOnePrize(product) {
    var found = product.prizes.filter(function (p) {
      return p.isLastOne;
    });
    return found.length ? prizePublic(found[0], product.id) : null;
  }

  function prizePublic(prize, productId) {
    return {
      id: prize.id,
      productId: productId,
      grade: prize.grade,
      name: prize.name,
      image: prize.image,
      quantity: prize.quantity,
      cost: Number(prize.cost) || 0,
      isLastOne: Boolean(prize.isLastOne),
      sortOrder: prize.sortOrder,
    };
  }

  function prizeById(product, prizeId) {
    for (var i = 0; i < product.prizes.length; i++) {
      if (product.prizes[i].id === prizeId) return product.prizes[i];
    }
    return null;
  }

  function getScratchedCount(product) {
    return product.slots.filter(function (s) {
      return s.scratched;
    }).length;
  }

  function productPublic(product) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      coverImage: product.coverImage,
      price: product.price,
      category: product.category,
      totalDraws: product.totalDraws,
      slotCount: product.totalDraws,
      cols: computeOptimalCols(product.totalDraws),
      status: product.status,
      theme: product.theme,
      foilPreset: product.foilPreset,
      foilImage: product.foilImage,
      showRemaining: Boolean(product.showRemaining),
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  function remainingByPrize(product) {
    return regularPrizes(product).map(function (prize) {
      var numbers = product.slots
        .filter(function (slot) {
          return slot.prizeId === prize.id;
        })
        .map(function (slot) {
          return slot.number;
        })
        .sort(function (a, b) {
          return a - b;
        });
      var remaining = product.slots.filter(function (slot) {
        return slot.prizeId === prize.id && !slot.scratched;
      }).length;
      return {
        id: prize.id,
        name: prize.name,
        image: prize.image,
        quantity: prize.quantity,
        remaining: remaining,
        numbers: numbers,
      };
    });
  }

  function winningNumbers(product) {
    return product.slots
      .slice()
      .sort(function (a, b) {
        return a.number - b.number;
      })
      .map(function (slot) {
        var prize = prizeById(product, slot.prizeId) || {};
        return {
          number: slot.number,
          scratched: Boolean(slot.scratched),
          prizeId: slot.prizeId,
          grade: prize.grade,
          name: prize.name,
          image: prize.image,
        };
      });
  }

  function slotPrizeFull(product, slot) {
    var prize = prizeById(product, slot.prizeId) || {};
    return {
      id: slot.prizeId,
      grade: prize.grade,
      name: prize.name,
      image: prize.image,
      isLastOne: Boolean(prize.isLastOne),
    };
  }

  function buildProductDetail(db, productId, options) {
    options = options || {};
    var product = findProduct(db, productId);
    if (!product) return null;

    var base = productPublic(product);
    var scratchedCount = getScratchedCount(product);
    var slots = [];
    var scratchLog = [];

    if (
      product.status === "published" ||
      product.status === "unpublished" ||
      options.includeSlots
    ) {
      slots = product.slots
        .slice()
        .sort(function (a, b) {
          return a.slotIndex - b.slotIndex;
        })
        .map(function (slot) {
          if (options.revealAll || slot.scratched) {
            return {
              slotIndex: slot.slotIndex,
              scratched: Boolean(slot.scratched),
              scratchedAt: slot.scratchedAt,
              number: slot.number,
              prize: slotPrizeFull(product, slot),
            };
          }
          return { slotIndex: slot.slotIndex, scratched: false };
        });

      scratchLog = product.slots
        .filter(function (slot) {
          return slot.scratched;
        })
        .sort(function (a, b) {
          return String(b.scratchedAt || "").localeCompare(String(a.scratchedAt || ""));
        })
        .map(function (slot) {
          return {
            slotIndex: slot.slotIndex,
            number: slot.number,
            scratchedAt: slot.scratchedAt,
            prize: slotPrizeFull(product, slot),
          };
        });
    }

    var detail = base;
    detail.prizes = sortedPrizes(product).map(function (p) {
      return prizePublic(p, product.id);
    });
    detail.lastOne = lastOnePrize(product);
    detail.scratchedCount = scratchedCount;
    detail.remainingDraws = Math.max(0, product.totalDraws - scratchedCount);
    detail.remaining = remainingByPrize(product).map(function (item) {
      item.drawn = Math.max(0, item.quantity - item.remaining);
      return item;
    });
    detail.winningNumbers = winningNumbers(product);
    detail.slots = slots;
    detail.scratchLog = scratchLog;
    detail.layout = {
      slotSize: LAYOUT.slotSize,
      gap: LAYOUT.gap,
      zoomTargetSize: LAYOUT.zoomTargetSize,
      zoomPadding: LAYOUT.zoomPadding,
    };
    return detail;
  }

  function validatePublish(product) {
    var regular = product.prizes.filter(function (p) {
      return !p.isLastOne;
    });
    var lastOnes = product.prizes.filter(function (p) {
      return p.isLastOne;
    });

    if (lastOnes.length > 1) return "只能設定一個最後賞";
    if (lastOnes.length === 1 && !lastOnes[0].name) return "最後賞需有名稱";
    if (regular.length === 0) return "至少需要一個獎項";

    for (var i = 0; i < regular.length; i++) {
      if (!regular[i].name) return "每個獎項需有名稱";
      if (regular[i].quantity < 1) return "獎項數量至少為 1";
    }

    var total = regular.reduce(function (sum, p) {
      return sum + p.quantity;
    }, 0);
    if (total !== product.totalDraws) {
      return "獎項數量加總（" + total + "）需等於總抽數（" + product.totalDraws + "）";
    }
    return null;
  }

  function publishProduct(db, productId) {
    var product = findProduct(db, productId);
    if (!product) return { error: "找不到商品", status: 404 };
    if (product.status === "published") return { error: "商品已上架", status: 400 };

    var error = validatePublish(product);
    if (error) return { error: error, status: 400 };

    var regular = regularPrizes(product);
    var expected = regular.reduce(function (sum, p) {
      return sum + p.quantity;
    }, 0);

    if (
      product.status === "unpublished" &&
      product.slots.length > 0 &&
      expected === product.totalDraws &&
      product.slots.length === product.totalDraws
    ) {
      product.status = "published";
      product.updatedAt = nowIso();
      saveDb(db);
      return { product: buildProductDetail(db, productId, { includeSlots: true, revealAll: true }) };
    }

    var bag = [];
    regular.forEach(function (prize) {
      for (var i = 0; i < prize.quantity; i++) bag.push(prize.id);
    });

    var shuffledPrizes = shuffle(bag);
    var numbers = shuffle(
      Array.from({ length: product.totalDraws }, function (_v, i) {
        return i + 1;
      })
    );

    product.slots = [];
    for (var i = 0; i < product.totalDraws; i++) {
      product.slots.push({
        id: makeId(12),
        slotIndex: i,
        number: numbers[i],
        prizeId: shuffledPrizes[i],
        scratched: false,
        scratchedAt: null,
      });
    }

    var stamp = nowIso();
    product.status = "published";
    product.publishedAt = stamp;
    product.updatedAt = stamp;
    saveDb(db);
    return { product: buildProductDetail(db, productId, { includeSlots: true, revealAll: true }) };
  }

  function resetBoard(db, productId) {
    var product = findProduct(db, productId);
    if (!product) return { error: "找不到商品", status: 404 };
    if (product.slots.length === 0) return { error: "尚未產生面板", status: 400 };

    product.slots.forEach(function (slot) {
      slot.scratched = false;
      slot.scratchedAt = null;
    });
    product.updatedAt = nowIso();
    saveDb(db);
    return { product: buildProductDetail(db, productId, { includeSlots: true, revealAll: true }) };
  }

  function findSlot(product, slotIndex) {
    for (var i = 0; i < product.slots.length; i++) {
      if (product.slots[i].slotIndex === slotIndex) return product.slots[i];
    }
    return null;
  }

  function slotResultPrize(product, slot) {
    var prize = prizeById(product, slot.prizeId) || {};
    return {
      id: slot.prizeId,
      grade: prize.grade,
      name: prize.name,
      image: prize.image,
      isLastOne: false,
    };
  }

  function claimSlot(db, productId, slotIndex) {
    var product = findProduct(db, productId);
    if (!product) return { error: "找不到商品", status: 404 };
    if (product.status !== "published") return { error: "商品未上架", status: 400 };

    var slot = findSlot(product, slotIndex);
    if (!slot) return { error: "找不到格子", status: 404 };

    var scratchedCount = getScratchedCount(product);
    return {
      result: {
        slotIndex: slot.slotIndex,
        number: slot.number,
        scratched: Boolean(slot.scratched),
        prize: slotResultPrize(product, slot),
        lastOneAwarded: null,
        remaining: remainingByPrize(product),
        scratchedCount: scratchedCount,
        remainingDraws: Math.max(0, product.totalDraws - scratchedCount),
      },
    };
  }

  function deleteSnapshot(db, productId, slotIndex) {
    var store = db.snapshots[productId];
    if (store) delete store[String(slotIndex)];
  }

  function scratchSlot(db, productId, slotIndex) {
    var product = findProduct(db, productId);
    if (!product) return { error: "找不到商品", status: 404 };
    if (product.status !== "published") return { error: "商品未上架", status: 400 };

    var slot = findSlot(product, slotIndex);
    if (!slot) return { error: "找不到格子", status: 404 };

    var scratchedCount = getScratchedCount(product);
    var isLastSlot = scratchedCount === product.totalDraws - 1 && !slot.scratched;
    var lastOne = lastOnePrize(product);

    if (!slot.scratched) {
      slot.scratched = true;
      slot.scratchedAt = nowIso();
      deleteSnapshot(db, productId, slotIndex);
      saveDb(db);
    }

    var nextCount = getScratchedCount(product);
    var result = {
      slotIndex: slot.slotIndex,
      number: slot.number,
      scratched: true,
      prize: slotResultPrize(product, slot),
      lastOneAwarded: null,
      remaining: remainingByPrize(product),
      scratchedCount: nextCount,
      remainingDraws: Math.max(0, product.totalDraws - nextCount),
    };
    if (isLastSlot && lastOne) result.lastOneAwarded = lastOne;
    return { result: result };
  }

  function getScratchSnapshots(db, productId) {
    var product = findProduct(db, productId);
    if (!product || product.status !== "published") {
      return { error: "找不到商品", status: 404 };
    }
    var store = db.snapshots[productId] || {};
    var snapshots = {};
    Object.keys(store).forEach(function (index) {
      var row = store[index];
      snapshots[index] = {
        width: row.width,
        height: row.height,
        image: row.image,
        number: row.number != null ? row.number : null,
        sealed: Boolean(row.sealed),
        updatedAt: row.updatedAt,
      };
    });
    return { snapshots: snapshots };
  }

  function saveScratchSnapshot(db, productId, slotIndex, payload) {
    var product = findProduct(db, productId);
    if (!product || product.status !== "published") {
      return { error: "找不到商品", status: 404 };
    }
    var slot = findSlot(product, slotIndex);
    if (!slot) return { error: "找不到格子", status: 404 };
    if (slot.scratched) return { error: "格子已刮開", status: 400 };

    var width = Number(payload.width);
    var height = Number(payload.height);
    var image = String(payload.image || "");
    if (
      !Number.isInteger(width) ||
      width <= 0 ||
      !Number.isInteger(height) ||
      height <= 0 ||
      !image
    ) {
      return { error: "快照資料無效", status: 400 };
    }

    var updatedAt = nowIso();
    if (!db.snapshots[productId]) db.snapshots[productId] = {};
    db.snapshots[productId][String(slotIndex)] = {
      width: width,
      height: height,
      image: image,
      number: payload.number != null ? Number(payload.number) : null,
      sealed: payload.sealed ? true : false,
      updatedAt: updatedAt,
    };
    saveDb(db);

    return {
      result: {
        slotIndex: slotIndex,
        width: width,
        height: height,
        number: payload.number != null ? Number(payload.number) : null,
        sealed: Boolean(payload.sealed),
        updatedAt: updatedAt,
      },
    };
  }

  function saveSettings(db, input) {
    var current = db.settings || defaultSettings();
    db.settings = {
      shopTitle: String(input.shopTitle != null ? input.shopTitle : current.shopTitle).trim() || "Dottery",
      showPrice: input.showPrice != null ? Boolean(input.showPrice) : current.showPrice,
      showProgress: input.showProgress != null ? Boolean(input.showProgress) : current.showProgress,
      hideSoldOut: input.hideSoldOut != null ? Boolean(input.hideSoldOut) : current.hideSoldOut,
      defaultShowRemaining:
        input.defaultShowRemaining != null
          ? Boolean(input.defaultShowRemaining)
          : current.defaultShowRemaining,
      updatedAt: nowIso(),
    };
    saveDb(db);
    return db.settings;
  }

  function normalizePrizeInput(input, index) {
    return {
      id: input.id || makeId(10),
      grade: String(input.grade || "").trim(),
      name: String(input.name || "").trim(),
      image: String(input.image || "").trim(),
      quantity: Math.max(0, Number(input.quantity) || 0),
      cost: Math.max(0, Number(input.cost) || 0),
      isLastOne: Boolean(input.isLastOne),
      sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : index,
    };
  }

  function replacePrizes(db, product, prizesInput, lastOneInput) {
    var prizes = (prizesInput || [])
      .filter(function (p) {
        return !p.isLastOne;
      })
      .map(function (p, index) {
        return normalizePrizeInput(p, index);
      });

    var lastOne = null;
    if (lastOneInput && (lastOneInput.name || lastOneInput.image)) {
      lastOne = normalizePrizeInput(
        Object.assign({}, lastOneInput, {
          quantity: 1,
          isLastOne: true,
          sortOrder: 9999,
        }),
        9999
      );
    }

    product.prizes = prizes.map(function (prize, index) {
      return {
        id: prize.id,
        grade: prize.grade,
        name: prize.name,
        image: prize.image,
        quantity: prize.quantity,
        cost: prize.cost,
        isLastOne: false,
        sortOrder: index,
      };
    });

    if (lastOne) {
      product.prizes.push({
        id: lastOne.id,
        grade: lastOne.grade || "",
        name: lastOne.name,
        image: lastOne.image,
        quantity: 1,
        cost: lastOne.cost,
        isLastOne: true,
        sortOrder: 9999,
      });
    }
  }

  function countTopPrizesRemaining(remaining) {
    if (!remaining || !remaining.length) return { left: 0, total: 0 };
    return remaining.slice(0, 2).reduce(
      function (acc, item) {
        acc.left += Number(item.remaining) || 0;
        acc.total += Number(item.quantity) || 0;
        return acc;
      },
      { left: 0, total: 0 }
    );
  }

  function periodStartIso(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  function parseDateRange(fromStr, toStr) {
    if (!fromStr || !toStr) return null;
    var from = new Date(fromStr + "T00:00:00");
    var to = new Date(toStr + "T23:59:59.999");
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
    if (from > to) return null;
    return { fromIso: from.toISOString(), untilIso: to.toISOString() };
  }

  function aggregateScratchPnL(db, sinceIso, untilIso) {
    var revenue = 0;
    var cost = 0;
    var scratches = 0;
    var byProduct = {};

    function bucket(product) {
      if (!byProduct[product.id]) {
        byProduct[product.id] = {
          productId: product.id,
          productName: product.name,
          revenue: 0,
          cost: 0,
          profit: 0,
          scratches: 0,
        };
      }
      return byProduct[product.id];
    }

    db.products.forEach(function (product) {
      var price = Number(product.price) || 0;
      var scratchedSlots = product.slots.filter(function (slot) {
        if (!slot.scratched || !slot.scratchedAt) return false;
        if (slot.scratchedAt < sinceIso) return false;
        if (untilIso && slot.scratchedAt > untilIso) return false;
        return true;
      });

      scratchedSlots.forEach(function (slot) {
        var prize = prizeById(product, slot.prizeId) || {};
        var prizeCost = Number(prize.cost) || 0;
        revenue += price;
        cost += prizeCost;
        scratches += 1;
        var item = bucket(product);
        item.revenue += price;
        item.cost += prizeCost;
        item.scratches += 1;
      });

      var lastOne = product.prizes.filter(function (p) {
        return p.isLastOne;
      })[0];
      if (lastOne && Number(lastOne.cost)) {
        var totalScratched = getScratchedCount(product);
        if (product.totalDraws > 0 && totalScratched === product.totalDraws) {
          var lastAt = product.slots.reduce(function (max, slot) {
            return slot.scratchedAt && slot.scratchedAt > max ? slot.scratchedAt : max;
          }, "");
          var inRange = lastAt >= sinceIso && (!untilIso || lastAt <= untilIso);
          if (inRange) {
            var lastOneCost = Number(lastOne.cost) || 0;
            cost += lastOneCost;
            bucket(product).cost += lastOneCost;
          }
        }
      }
    });

    Object.keys(byProduct).forEach(function (key) {
      byProduct[key].profit = byProduct[key].revenue - byProduct[key].cost;
    });

    return {
      revenue: revenue,
      cost: cost,
      profit: revenue - cost,
      scratches: scratches,
      byProduct: byProduct,
    };
  }

  function buildDashboard(db, options) {
    options = options || {};
    var totalDraws = 0;
    var totalScratched = 0;
    var totalRevenue = 0;
    var publishedCount = 0;
    var draftCount = 0;
    var unpublishedCount = 0;
    var soldOutCount = 0;

    var allTimePnL = aggregateScratchPnL(db, "1970-01-01T00:00:00.000Z");
    var totalCost = allTimePnL.cost;

    var periods = {
      7: aggregateScratchPnL(db, periodStartIso(7)),
      30: aggregateScratchPnL(db, periodStartIso(30)),
    };

    var customPnL = null;
    var customRange = parseDateRange(options.from, options.to);
    if (customRange) {
      customPnL = aggregateScratchPnL(db, customRange.fromIso, customRange.untilIso);
    }

    var sorted = db.products.slice().sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });

    var products = sorted.map(function (raw) {
      var product = productPublic(raw);
      var scratchedCount = raw.status === "draft" ? 0 : getScratchedCount(raw);
      var remainingDraws = Math.max(0, product.totalDraws - scratchedCount);
      var sellThrough = product.totalDraws > 0 ? scratchedCount / product.totalDraws : 0;
      var revenue = scratchedCount * (Number(product.price) || 0);
      var remaining = raw.status === "draft" ? [] : remainingByPrize(raw);
      var topPrizes = countTopPrizesRemaining(remaining);
      var done =
        raw.status !== "draft" &&
        product.totalDraws > 0 &&
        scratchedCount >= product.totalDraws;

      totalDraws += product.totalDraws;
      totalScratched += scratchedCount;
      totalRevenue += revenue;

      if (raw.status === "published") publishedCount += 1;
      if (raw.status === "draft") draftCount += 1;
      if (raw.status === "unpublished") unpublishedCount += 1;
      if (done) soldOutCount += 1;

      return {
        id: product.id,
        name: product.name,
        status: product.status,
        price: product.price,
        totalDraws: product.totalDraws,
        scratchedCount: scratchedCount,
        remainingDraws: remainingDraws,
        sellThrough: sellThrough,
        revenue: revenue,
        totalCost: (allTimePnL.byProduct[product.id] || {}).cost || 0,
        totalProfit: (allTimePnL.byProduct[product.id] || {}).profit || 0,
        period7: periods[7].byProduct[product.id] || null,
        period30: periods[30].byProduct[product.id] || null,
        periodCustom: customPnL ? customPnL.byProduct[product.id] || null : null,
        topPrizes: topPrizes,
        publishedAt: product.publishedAt,
        done: done,
      };
    });

    var activity = [];
    db.products.forEach(function (product) {
      product.slots.forEach(function (slot) {
        if (!slot.scratched) return;
        var prize = prizeById(product, slot.prizeId) || {};
        activity.push({
          productId: product.id,
          productName: product.name,
          slotIndex: slot.slotIndex,
          number: slot.number,
          scratchedAt: slot.scratchedAt,
          prize: { grade: prize.grade, name: prize.name },
        });
      });
    });
    activity.sort(function (a, b) {
      return String(b.scratchedAt || "").localeCompare(String(a.scratchedAt || ""));
    });
    var recentActivity = activity.slice(0, 12);

    var now = Date.now();
    var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    var alerts = [];

    products.forEach(function (product) {
      if (product.status !== "published") return;
      var publishedAt = product.publishedAt ? Date.parse(product.publishedAt) : NaN;
      if (
        product.totalDraws > 0 &&
        product.sellThrough < 0.2 &&
        isFinite(publishedAt) &&
        now - publishedAt >= sevenDaysMs
      ) {
        alerts.push({
          type: "slow",
          productId: product.id,
          productName: product.name,
          value: Math.round(product.sellThrough * 100) + "%",
        });
      }
      if (product.topPrizes.total > 0 && product.topPrizes.left <= 1) {
        alerts.push({
          type: "lowStock",
          productId: product.id,
          productName: product.name,
          value: product.topPrizes.left + "/" + product.topPrizes.total,
        });
      }
    });

    return {
      summary: {
        productCount: db.products.length,
        publishedCount: publishedCount,
        draftCount: draftCount,
        unpublishedCount: unpublishedCount,
        soldOutCount: soldOutCount,
        totalDraws: totalDraws,
        totalScratched: totalScratched,
        totalRevenue: totalRevenue,
        totalCost: totalCost,
        totalProfit: totalRevenue - totalCost,
        sellThrough: totalDraws > 0 ? totalScratched / totalDraws : 0,
      },
      periods: {
        7: {
          revenue: periods[7].revenue,
          cost: periods[7].cost,
          profit: periods[7].profit,
          scratches: periods[7].scratches,
        },
        30: {
          revenue: periods[30].revenue,
          cost: periods[30].cost,
          profit: periods[30].profit,
          scratches: periods[30].scratches,
        },
        custom: customPnL
          ? {
              revenue: customPnL.revenue,
              cost: customPnL.cost,
              profit: customPnL.profit,
              scratches: customPnL.scratches,
              from: options.from,
              to: options.to,
            }
          : null,
      },
      products: products,
      recentActivity: recentActivity,
      alerts: alerts,
    };
  }

  function isAuthed() {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch (_e) {
      return false;
    }
  }

  function setAuthed(value) {
    try {
      if (value) sessionStorage.setItem(AUTH_KEY, "1");
      else sessionStorage.removeItem(AUTH_KEY);
    } catch (_e) {}
  }

  function json(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function parseBody(init) {
    if (!init || init.body == null) return {};
    if (typeof init.body === "string") {
      try {
        return JSON.parse(init.body);
      } catch (_e) {
        return {};
      }
    }
    return init.body;
  }

  function parseQuery(search) {
    var out = {};
    if (!search) return out;
    search.split("&").forEach(function (part) {
      var idx = part.indexOf("=");
      if (idx === -1) return;
      out[decodeURIComponent(part.slice(0, idx))] = decodeURIComponent(part.slice(idx + 1));
    });
    return out;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("read failed"));
      };
      reader.readAsDataURL(file);
    });
  }

  function handleAdmin(db, method, segments, query, init) {
    var route = segments.join("/");

    if (method === "POST" && route === "login") {
      var body = parseBody(init);
      if (String(body.password || "") !== ADMIN_PASSWORD) {
        return json({ error: "密碼錯誤" }, 401);
      }
      setAuthed(true);
      return json({ ok: true });
    }

    if (method === "POST" && route === "logout") {
      setAuthed(false);
      return json({ ok: true });
    }

    if (method === "GET" && route === "me") {
      return json({ authenticated: isAuthed() });
    }

    if (!isAuthed()) {
      return json({ error: "未登入" }, 401);
    }

    if (method === "GET" && route === "dashboard") {
      return json(
        buildDashboard(db, {
          from: String(query.from || "").trim(),
          to: String(query.to || "").trim(),
        })
      );
    }

    if (method === "GET" && route === "settings") {
      return json(db.settings);
    }

    if (method === "PUT" && route === "settings") {
      return json(saveSettings(db, parseBody(init)));
    }

    if (method === "POST" && route === "upload") {
      var form = init && init.body;
      var file = form && typeof form.get === "function" ? form.get("file") : null;
      if (!file) return json({ error: "未上傳檔案" }, 400);
      if (!String(file.type || "").startsWith("image/")) {
        return json({ error: "僅接受圖片檔" }, 400);
      }
      if (file.size > 5 * 1024 * 1024) {
        return json({ error: "檔案過大" }, 400);
      }
      return readFileAsDataUrl(file).then(function (dataUrl) {
        return json({ url: dataUrl });
      });
    }

    if (method === "GET" && route === "products") {
      var sorted = db.products.slice().sort(function (a, b) {
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
      return json({
        products: sorted.map(function (raw) {
          var product = productPublic(raw);
          var scratchedCount = raw.status === "draft" ? 0 : getScratchedCount(raw);
          product.scratchedCount = scratchedCount;
          product.remainingDraws = Math.max(0, product.totalDraws - scratchedCount);
          product.prizeCount = raw.prizes.filter(function (p) {
            return !p.isLastOne;
          }).length;
          return product;
        }),
      });
    }

    if (method === "POST" && route === "products") {
      var input = parseBody(init);
      var stamp = nowIso();
      var totalDraws = Math.max(1, Number(input.totalDraws) || 12);
      var product = {
        id: makeId(10),
        name: String(input.name || "").trim(),
        description: String(input.description || "").trim(),
        coverImage: String(input.coverImage || "").trim(),
        price: Number(input.price) || 0,
        category: String(input.category || "").trim(),
        totalDraws: totalDraws,
        status: "draft",
        theme: THEMES.indexOf(input.theme) !== -1 ? input.theme : "light",
        foilPreset: FOIL_PRESETS.indexOf(input.foilPreset) !== -1 ? input.foilPreset : "silver",
        foilImage: String(input.foilImage || "").trim(),
        showRemaining: input.showRemaining === false ? false : true,
        publishedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
        prizes: [],
        slots: [],
      };
      db.products.push(product);
      if (Array.isArray(input.prizes)) {
        replacePrizes(db, product, input.prizes, input.lastOne || null);
      }
      saveDb(db);
      return json(buildProductDetail(db, product.id, { includeSlots: true, revealAll: true }), 201);
    }

    var idMatch = segments.length >= 2 && segments[0] === "products" ? segments[1] : null;
    if (idMatch) {
      var target = findProduct(db, idMatch);
      var action = segments[2] || null;

      if (method === "GET" && !action) {
        var detail = buildProductDetail(db, idMatch, { includeSlots: true, revealAll: true });
        if (!detail) return json({ error: "找不到商品" }, 404);
        return json(detail);
      }

      if (method === "PUT" && !action) {
        if (!target) return json({ error: "找不到商品" }, 404);
        var body = parseBody(init);
        var published = target.status === "published";

        if (published) {
          target.name = String(body.name != null ? body.name : target.name).trim();
          target.description = String(
            body.description != null ? body.description : target.description
          ).trim();
          target.coverImage = String(
            body.coverImage != null ? body.coverImage : target.coverImage
          ).trim();
          target.price = body.price != null ? Number(body.price) || 0 : target.price;
          target.category = String(
            body.category != null ? body.category : target.category
          ).trim();
          target.theme = THEMES.indexOf(body.theme) !== -1 ? body.theme : target.theme;
          target.foilPreset =
            FOIL_PRESETS.indexOf(body.foilPreset) !== -1 ? body.foilPreset : target.foilPreset;
          target.foilImage = String(
            body.foilImage != null ? body.foilImage : target.foilImage
          ).trim();
          target.showRemaining =
            body.showRemaining === false
              ? false
              : body.showRemaining === true
                ? true
                : target.showRemaining;
          target.updatedAt = nowIso();

          if (Array.isArray(body.prizes)) {
            body.prizes.forEach(function (prizeInput) {
              if (!prizeInput.id) return;
              var prize = prizeById(target, prizeInput.id);
              if (prize) prize.cost = Number(prizeInput.cost) || 0;
            });
          }
          if (body.lastOne && body.lastOne.id) {
            var lastPrize = prizeById(target, body.lastOne.id);
            if (lastPrize) lastPrize.cost = Number(body.lastOne.cost) || 0;
          }

          saveDb(db);
          return json(buildProductDetail(db, target.id, { includeSlots: true, revealAll: true }));
        }

        var nextTotal = Math.max(
          1,
          Number(body.totalDraws != null ? body.totalDraws : target.totalDraws) || 12
        );
        var poolChanged =
          nextTotal !== target.totalDraws ||
          Array.isArray(body.prizes) ||
          body.lastOne !== undefined;

        target.name = String(body.name != null ? body.name : target.name).trim();
        target.description = String(
          body.description != null ? body.description : target.description
        ).trim();
        target.coverImage = String(
          body.coverImage != null ? body.coverImage : target.coverImage
        ).trim();
        target.price = body.price != null ? Number(body.price) || 0 : target.price;
        target.category = String(body.category != null ? body.category : target.category).trim();
        target.totalDraws = nextTotal;
        target.theme = THEMES.indexOf(body.theme) !== -1 ? body.theme : target.theme;
        target.foilPreset =
          FOIL_PRESETS.indexOf(body.foilPreset) !== -1 ? body.foilPreset : target.foilPreset;
        target.foilImage = String(
          body.foilImage != null ? body.foilImage : target.foilImage
        ).trim();
        target.showRemaining =
          body.showRemaining === false
            ? false
            : body.showRemaining === true
              ? true
              : target.showRemaining;
        target.updatedAt = nowIso();

        if (Array.isArray(body.prizes) || body.lastOne !== undefined) {
          replacePrizes(
            db,
            target,
            body.prizes ||
              target.prizes.filter(function (p) {
                return !p.isLastOne;
              }),
            body.lastOne
          );
        }

        if (poolChanged) {
          target.slots = [];
        }

        saveDb(db);
        return json(buildProductDetail(db, target.id, { includeSlots: true, revealAll: true }));
      }

      if (method === "DELETE" && !action) {
        if (!target) return json({ error: "找不到商品" }, 404);
        if (target.status === "published") return json({ error: "請先下架再刪除" }, 400);
        db.products = db.products.filter(function (p) {
          return p.id !== target.id;
        });
        delete db.snapshots[target.id];
        saveDb(db);
        return json({ ok: true });
      }

      if (method === "POST" && action === "publish") {
        var published = publishProduct(db, idMatch);
        if (published.error) return json({ error: published.error }, published.status);
        return json(published.product);
      }

      if (method === "POST" && action === "unpublish") {
        if (!target) return json({ error: "找不到商品" }, 404);
        if (target.status !== "published") return json({ error: "商品未上架" }, 400);
        target.status = "unpublished";
        target.updatedAt = nowIso();
        saveDb(db);
        return json(buildProductDetail(db, target.id, { includeSlots: true, revealAll: true }));
      }

      if (method === "POST" && action === "reset") {
        var resetResult = resetBoard(db, idMatch);
        if (resetResult.error) return json({ error: resetResult.error }, resetResult.status);
        return json(resetResult.product);
      }
    }

    return json({ error: "not found" }, 404);
  }

  function handlePublic(db, method, segments, init) {
    if (method === "GET" && segments.length === 1 && segments[0] === "settings") {
      return json(db.settings);
    }

    if (method === "GET" && segments.length === 1 && segments[0] === "products") {
      var published = db.products
        .filter(function (p) {
          return p.status === "published";
        })
        .sort(function (a, b) {
          return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
        });
      return json({
        products: published.map(function (raw) {
          var scratchedCount = getScratchedCount(raw);
          return {
            id: raw.id,
            name: raw.name,
            description: raw.description,
            coverImage: raw.coverImage,
            price: raw.price,
            category: raw.category,
            totalDraws: raw.totalDraws,
            scratchedCount: scratchedCount,
            remainingDraws: Math.max(0, raw.totalDraws - scratchedCount),
            theme: raw.theme,
          };
        }),
      });
    }

    if (segments[0] === "products" && segments.length >= 2) {
      var productId = segments[1];
      var product = findProduct(db, productId);

      if (method === "GET" && segments.length === 2) {
        if (!product || product.status !== "published") {
          return json({ error: "找不到商品" }, 404);
        }
        return json(buildProductDetail(db, productId, { includeSlots: true }));
      }

      if (method === "GET" && segments.length === 3 && segments[2] === "scratch-snapshots") {
        var snapshotsResult = getScratchSnapshots(db, productId);
        if (snapshotsResult.error) {
          return json({ error: snapshotsResult.error }, snapshotsResult.status);
        }
        return json(snapshotsResult);
      }

      if (segments.length === 4 && segments[2] === "slots") {
        var slotIndex = Number(segments[3]);
        return json({ error: "not found" }, 404);
      }

      if (segments.length === 5 && segments[2] === "slots") {
        var index = Number(segments[3]);
        if (!Number.isInteger(index) || index < 0) {
          return json({ error: "格子索引無效" }, 400);
        }
        var op = segments[4];

        if (method === "POST" && op === "claim") {
          var claim = claimSlot(db, productId, index);
          if (claim.error) return json({ error: claim.error }, claim.status);
          return json(claim.result);
        }

        if (method === "POST" && op === "scratch") {
          var scratch = scratchSlot(db, productId, index);
          if (scratch.error) return json({ error: scratch.error }, scratch.status);
          return json(scratch.result);
        }

        if (method === "PUT" && op === "scratch-snapshot") {
          var saved = saveScratchSnapshot(db, productId, index, parseBody(init) || {});
          if (saved.error) return json({ error: saved.error }, saved.status);
          return json(saved.result);
        }
      }
    }

    return json({ error: "not found" }, 404);
  }

  function extractApiPath(input) {
    var url = "";
    if (typeof input === "string") url = input;
    else if (input && typeof input.url === "string") url = input.url;
    if (!url) return null;
    if (url.indexOf("/api/") === 0) return url;
    var marker = url.indexOf("://");
    if (marker !== -1) {
      var pathStart = url.indexOf("/", marker + 3);
      if (pathStart !== -1 && url.indexOf("/api/", pathStart) === pathStart) {
        return url.slice(pathStart);
      }
    }
    return null;
  }

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (input, init) {
    var apiPath = extractApiPath(input);
    if (!apiPath) {
      return originalFetch
        ? originalFetch(input, init)
        : Promise.reject(new TypeError("fetch unavailable"));
    }

    return Promise.resolve().then(function () {
      var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      var queryIndex = apiPath.indexOf("?");
      var pathname = queryIndex === -1 ? apiPath : apiPath.slice(0, queryIndex);
      var query = parseQuery(queryIndex === -1 ? "" : apiPath.slice(queryIndex + 1));
      var segments = pathname
        .replace(/^\/api\//, "")
        .split("/")
        .filter(Boolean)
        .map(function (segment) {
          return decodeURIComponent(segment);
        });

      var db = loadDb();

      try {
        if (segments[0] === "admin") {
          return handleAdmin(db, method, segments.slice(1), query, init);
        }
        return handlePublic(db, method, segments, init);
      } catch (error) {
        return json({ error: String((error && error.message) || error) }, 500);
      }
    });
  };
})();
