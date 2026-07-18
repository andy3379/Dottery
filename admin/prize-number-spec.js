(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.PrizeNumberSpec = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function shuffle(array) {
    const items = array.slice();
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  function parsePart(part, totalDraws) {
    const token = String(part || "").trim();
    if (!token) return { error: "空白片段" };

    if (token.includes("~")) {
      const bounds = token.split("~");
      if (bounds.length !== 2) return { error: `區間無效：${token}` };
      const start = Number(bounds[0].trim());
      const end = Number(bounds[1].trim());
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return { error: `區間無效：${token}` };
      }
      if (start > end) return { error: `區間無效：${token}` };
      const numbers = [];
      for (let n = start; n <= end; n++) {
        if (n < 1 || n > totalDraws) {
          return { error: `號碼 ${n} 超出範圍` };
        }
        numbers.push(n);
      }
      return { numbers };
    }

    const value = Number(token);
    if (!Number.isInteger(value)) return { error: `號碼無效：${token}` };
    if (value < 1 || value > totalDraws) return { error: `號碼 ${value} 超出範圍` };
    return { numbers: [value] };
  }

  function parse(spec, totalDraws) {
    const text = String(spec || "").trim();
    if (!text) return { numbers: [] };

    const parts = text
      .split(/[,、]/)
      .map((part) => part.trim())
      .filter(Boolean);

    const numbers = [];
    const seen = new Set();

    for (const part of parts) {
      const result = parsePart(part, totalDraws);
      if (result.error) return { error: result.error, numbers: [] };
      for (const num of result.numbers) {
        if (seen.has(num)) return { error: `號碼 ${num} 重複`, numbers: [] };
        seen.add(num);
        numbers.push(num);
      }
    }

    return { numbers };
  }

  function formatNumbers(sortedNumbers) {
    if (!sortedNumbers.length) return "";
    const parts = [];
    let start = sortedNumbers[0];
    let prev = start;

    for (let i = 1; i <= sortedNumbers.length; i++) {
      const current = sortedNumbers[i];
      if (current === prev + 1) {
        prev = current;
        continue;
      }
      parts.push(start === prev ? String(start) : `${start}~${prev}`);
      start = current;
      prev = current;
    }

    return parts.join("、");
  }

  function specsFromSlotDrafts(drafts, prizes) {
    const byPrize = {};
    (prizes || [])
      .filter((prize) => !prize.isLastOne)
      .forEach((prize) => {
        byPrize[prize.id] = [];
      });

    (drafts || []).forEach((draft) => {
      if (!byPrize[draft.prizeId]) byPrize[draft.prizeId] = [];
      byPrize[draft.prizeId].push(Number(draft.number));
    });

    const specs = {};
    Object.entries(byPrize).forEach(([prizeId, numbers]) => {
      const sorted = numbers.filter((n) => Number.isInteger(n)).sort((a, b) => a - b);
      specs[prizeId] = formatNumbers(sorted);
    });
    return specs;
  }

  function defaultSpecsFromQuantities(prizes, totalDraws) {
    const specs = {};
    let cursor = 1;
    (prizes || [])
      .filter((prize) => !prize.isLastOne)
      .forEach((prize) => {
        const quantity = Math.max(0, Number(prize.quantity) || 0);
        if (!quantity) {
          specs[prize.id] = "";
          return;
        }
        const end = cursor + quantity - 1;
        if (end > totalDraws) {
          specs[prize.id] = "";
          cursor = end + 1;
          return;
        }
        specs[prize.id] = cursor === end ? String(cursor) : `${cursor}~${end}`;
        cursor = end + 1;
      });
    return specs;
  }

  function buildSlotDrafts(prizes, specs, totalDraws, options = {}) {
    const regular = (prizes || []).filter((prize) => !prize.isLastOne);
    const pairs = [];
    const used = new Set();

    for (const prize of regular) {
      const spec = specs && specs[prize.id] != null ? specs[prize.id] : "";
      const parsed = parse(spec, totalDraws);
      if (parsed.error) {
        const label = prize.name || prize.grade || prize.id;
        return { error: `「${label}」${parsed.error}` };
      }
      if (parsed.numbers.length !== prize.quantity) {
        const label = prize.name || prize.grade || prize.id;
        return {
          error: `「${label}」號碼數量（${parsed.numbers.length}）需等於獎項數量（${prize.quantity}）`,
        };
      }
      parsed.numbers.forEach((number) => {
        pairs.push({ number, prizeId: prize.id });
        used.add(number);
      });
    }

    if (used.size !== totalDraws) {
      return { error: `號碼需涵蓋 1 至 ${totalDraws}` };
    }

    const placement =
      options.shuffle === false
        ? pairs.slice().sort((a, b) => a.number - b.number)
        : shuffle(pairs.slice());
    const drafts = placement.map((pair, index) => ({
      slotIndex: index,
      number: pair.number,
      prizeId: pair.prizeId,
    }));

    return { drafts };
  }

  return {
    parse,
    formatNumbers,
    specsFromSlotDrafts,
    defaultSpecsFromQuantities,
    buildSlotDrafts,
  };
});
