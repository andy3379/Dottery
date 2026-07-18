(function () {
  "use strict";

  function createBoardInfo(options) {
    const revealModal = document.getElementById("revealModal");
    const revealCard = document.getElementById("revealCard");
    const revealFx = document.getElementById("revealFx");
    const revealNumber = document.getElementById("revealNumber");
    const revealImage = document.getElementById("revealImage");
    const revealGrade = document.getElementById("revealGrade");
    const revealName = document.getElementById("revealName");
    const revealBack = document.getElementById("revealBack");
    const revealNext = document.getElementById("revealNext");
    const boardProgress = document.getElementById("boardProgress");
    const boardPrizePanel = document.getElementById("boardPrizePanel");
    const boardPrizeHead = document.getElementById("boardPrizeHead");
    const boardPrizeList = document.getElementById("boardPrizeList");

    let product = options.product;
    let revealBusy = false;

    function formatPctLabel(ratio) {
      if (!ratio || ratio <= 0) return "0%";
      const raw = (ratio * 100).toFixed(3);
      const trimmed = raw.replace(/\.?0+$/, "");
      return `${trimmed}%`;
    }

    function allocatePctLabels(rows) {
      rows.forEach((row) => {
        row.pctLabel = formatPctLabel(row.stockRatio);
      });
    }

    function renderProgress() {
      if (!boardProgress) return;
      const scratched = Number(product.scratchedCount) || 0;
      const total = Number(product.totalDraws) || 0;
      boardProgress.textContent = `${scratched}/${total}`;
      boardProgress.classList.toggle("is-done", total > 0 && scratched >= total);
    }

    function prizeNumberRanges(numbers) {
      if (!numbers || !numbers.length) return [];
      const sorted = [...new Set(numbers.map(Number))].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      if (!sorted.length) return [];
      const ranges = [];
      let start = sorted[0];
      let prev = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const n = sorted[i];
        if (n === prev + 1) {
          prev = n;
          continue;
        }
        ranges.push(start === prev ? { start } : { start, end: prev });
        start = n;
        prev = n;
      }
      ranges.push(start === prev ? { start } : { start, end: prev });
      return ranges;
    }

    function formatRangeLabel(range) {
      return range.end == null ? String(range.start) : `${range.start}–${range.end}`;
    }

    function numbersForPrize(prizeId) {
      const winning = product.winningNumbers || [];
      const forPrize = winning.filter((item) => item.prizeId === prizeId);
      if (forPrize.length) {
        return forPrize
          .filter((item) => !item.scratched)
          .map((item) => item.number);
      }
      const fromRemaining = (product.remaining || []).find((item) => item.id === prizeId);
      return fromRemaining?.numbers?.length ? fromRemaining.numbers : [];
    }

    function buildPrizeRows() {
      const remainingDraws = Math.max(0, Number(product.remainingDraws) || 0);
      const prizeMap = Object.fromEntries(
        (product.prizes || []).map((prize) => [prize.id, prize])
      );
      const rows = [];

      (product.remaining || []).forEach((item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const left = Math.max(0, Number(item.remaining) || 0);
        const ratio = remainingDraws > 0 ? left / remainingDraws : 0;
        const stockRatio = quantity > 0 ? left / quantity : 0;
        const fallback = prizeMap[item.id];
        rows.push({
          grade: item.grade || fallback?.grade || "",
          name: item.name || fallback?.name || "",
          image: item.image || fallback?.image || "",
          numbers: numbersForPrize(item.id),
          quantity,
          left,
          ratio,
          stockRatio,
        });
      });

      if (product.lastOne) {
        const left = remainingDraws > 0 ? 1 : 0;
        rows.push({
          grade: product.lastOne.grade || "",
          name: product.lastOne.name || "",
          image: product.lastOne.image || "",
          numbers: [],
          quantity: 1,
          left,
          ratio: remainingDraws > 0 ? 1 / remainingDraws : 0,
          stockRatio: left,
          isLastOne: true,
        });
      }

      allocatePctLabels(rows);
      return rows;
    }

    function renderPrizePanel() {
      if (!boardPrizePanel || !boardPrizeHead || !boardPrizeList) return;

      const show = product.showRemaining !== false;
      boardPrizePanel.hidden = !show;
      boardPrizePanel.classList.toggle("is-visible", show);
      document.body.classList.toggle("has-board-prize", show);

      if (!show) {
        boardPrizeHead.replaceChildren();
        boardPrizeList.replaceChildren();
        window.dispatchEvent(new Event("resize"));
        return;
      }

      boardPrizeHead.replaceChildren();
      const title = document.createElement("div");
      title.className = "board-prize__title";
      title.textContent = product.name || product.id || "";
      boardPrizeHead.appendChild(title);

      const rows = buildPrizeRows();
      boardPrizeList.replaceChildren();

      rows.forEach((row) => {
        const item = document.createElement("div");
        item.className = `board-prize__row${row.left <= 0 ? " is-empty" : ""}${
          row.isLastOne ? " is-last-one" : ""
        }`;

        const media = document.createElement("div");
        media.className = "board-prize__media";
        if (row.image) {
          const img = document.createElement("img");
          img.className = "board-prize__img";
          img.src = row.image;
          img.alt = "";
          img.draggable = false;
          media.appendChild(img);
        } else {
          const empty = document.createElement("div");
          empty.className = "board-prize__img--empty";
          media.appendChild(empty);
        }
        item.appendChild(media);

        const body = document.createElement("div");
        body.className = "board-prize__body";

        const top = document.createElement("div");
        top.className = "board-prize__row-top";

        const name = document.createElement("span");
        name.className = "board-prize__name";
        const label = row.grade ? `${row.grade} ${row.name || ""}`.trim() : row.name || "";
        name.textContent = label;
        top.appendChild(name);

        const prob = document.createElement("span");
        prob.className = "board-prize__prob";
        prob.textContent = row.pctLabel;
        top.appendChild(prob);

        body.appendChild(top);

        const ranges = prizeNumberRanges(row.numbers);
        if (ranges.length) {
          const numbers = document.createElement("div");
          numbers.className = "board-prize__numbers";
          const numLabel = document.createElement("span");
          numLabel.className = "board-prize__num-label";
          numLabel.textContent = "中獎號碼:";
          numbers.appendChild(numLabel);
          const maxChips = 8;
          const visible = ranges.length > maxChips ? ranges.slice(0, maxChips - 1) : ranges;
          visible.forEach((range) => {
            const chip = document.createElement("span");
            chip.className = "board-prize__num";
            chip.textContent = formatRangeLabel(range);
            numbers.appendChild(chip);
          });
          if (ranges.length > maxChips) {
            const more = document.createElement("span");
            more.className = "board-prize__num board-prize__num--more";
            more.textContent = `+${ranges.length - visible.length}`;
            numbers.appendChild(more);
          }
          body.appendChild(numbers);
        }

        const fracRow = document.createElement("div");
        fracRow.className = "board-prize__frac-row";

        const frac = document.createElement("span");
        frac.className = "board-prize__frac";
        frac.textContent = `剩餘: ${row.left}/${row.quantity}`;
        fracRow.appendChild(frac);

        const track = document.createElement("div");
        track.className = "board-prize__track";
        const fill = document.createElement("div");
        fill.className = "board-prize__fill";
        fill.style.width = `${Math.max(0, Math.min(100, row.stockRatio * 100))}%`;
        if (row.left <= 0) fill.classList.add("is-empty");
        track.appendChild(fill);
        fracRow.appendChild(track);

        body.appendChild(fracRow);
        item.appendChild(body);
        boardPrizeList.appendChild(item);
      });

      window.dispatchEvent(new Event("resize"));
    }

    function syncRevealActions() {
      if (!revealNext) return;
      const canNext =
        typeof options.canRevealNext === "function"
          ? options.canRevealNext()
          : Math.max(0, Number(product.remainingDraws) || 0) > 0;
      revealNext.disabled = !canNext;
      revealNext.hidden = !canNext;
    }

    function closeReveal() {
      if (!revealModal) return;
      revealModal.hidden = true;
      if (revealFx) revealFx.replaceChildren();
      if (revealCard) revealCard.className = "reveal-modal__card";
      revealBusy = false;
    }

    function showReveal(result) {
      if (!revealModal) return;
      const prize = result.prize || {};
      const level = ScratchEffects.prizeLevel(prize);
      revealNumber.textContent = String(result.number);
      if (prize.grade) {
        revealGrade.hidden = false;
        revealGrade.textContent = prize.grade;
      } else {
        revealGrade.hidden = true;
        revealGrade.textContent = "";
      }
      revealName.textContent = prize.name || "";

      if (prize.image) {
        revealImage.hidden = false;
        revealImage.src = prize.image;
      } else {
        revealImage.hidden = true;
        revealImage.removeAttribute("src");
      }

      revealCard.className = `reveal-modal__card level-${level}`;
      syncRevealActions();
      revealModal.hidden = false;
      revealBusy = false;
      ScratchEffects.celebrate(revealFx, level);

      if (result.lastOneAwarded) {
        setTimeout(() => {
          revealNumber.textContent = "";
          if (result.lastOneAwarded.grade) {
            revealGrade.hidden = false;
            revealGrade.textContent = result.lastOneAwarded.grade;
          } else {
            revealGrade.hidden = true;
            revealGrade.textContent = "";
          }
          revealName.textContent = result.lastOneAwarded.name || "";
          if (result.lastOneAwarded.image) {
            revealImage.hidden = false;
            revealImage.src = result.lastOneAwarded.image;
          }
          revealCard.className = "reveal-modal__card level-2";
          ScratchEffects.celebrate(revealFx, 2);
        }, 900);
      }
    }

    async function handleRevealBack() {
      if (revealBusy || !revealModal || revealModal.hidden) return;
      revealBusy = true;
      closeReveal();
      if (typeof options.onRevealBack === "function") {
        await options.onRevealBack();
      }
      revealBusy = false;
    }

    async function handleRevealNext() {
      if (revealBusy || !revealModal || revealModal.hidden) return;
      if (revealNext && revealNext.disabled) return;
      revealBusy = true;
      closeReveal();
      if (typeof options.onRevealNext === "function") {
        await options.onRevealNext();
      }
      revealBusy = false;
    }

    if (revealBack) {
      revealBack.addEventListener("click", handleRevealBack);
    }
    if (revealNext) {
      revealNext.addEventListener("click", handleRevealNext);
    }
    if (revealModal) {
      revealModal.addEventListener("click", (event) => {
        if (event.target === revealModal) handleRevealBack();
      });
    }

    function update(nextProduct, result) {
      product = nextProduct;
      renderProgress();
      renderPrizePanel();
      if (result) showReveal(result);
    }

    renderProgress();
    renderPrizePanel();

    return { update, showReveal, closeReveal, render: renderProgress };
  }

  window.BoardInfo = {
    create: createBoardInfo,
  };
})();
