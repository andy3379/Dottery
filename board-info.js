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
    const revealClose = document.getElementById("revealClose");
    const boardProgress = document.getElementById("boardProgress");

    let product = options.product;

    function renderProgress() {
      if (!boardProgress) return;
      const scratched = Number(product.scratchedCount) || 0;
      const total = Number(product.totalDraws) || 0;
      boardProgress.textContent = `${scratched}/${total}`;
      boardProgress.classList.toggle("is-done", total > 0 && scratched >= total);
    }

    function closeReveal() {
      if (!revealModal) return;
      revealModal.hidden = true;
      if (revealFx) revealFx.replaceChildren();
      if (revealCard) revealCard.className = "reveal-modal__card";
    }

    function showReveal(result) {
      if (!revealModal) return;
      const prize = result.prize || {};
      const level = ScratchEffects.prizeLevel(prize.grade);
      revealNumber.textContent = String(result.number);
      revealGrade.textContent = prize.grade || "";
      revealName.textContent = prize.name || "";

      if (prize.image) {
        revealImage.hidden = false;
        revealImage.src = prize.image;
      } else {
        revealImage.hidden = true;
        revealImage.removeAttribute("src");
      }

      revealCard.className = `reveal-modal__card level-${level}`;
      revealModal.hidden = false;
      ScratchEffects.celebrate(revealFx, level);

      if (result.lastOneAwarded) {
        setTimeout(() => {
          revealNumber.textContent = "";
          revealGrade.textContent = result.lastOneAwarded.grade || "最後賞";
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

    if (revealClose) {
      revealClose.addEventListener("click", closeReveal);
    }
    if (revealModal) {
      revealModal.addEventListener("click", (event) => {
        if (event.target === revealModal) closeReveal();
      });
    }

    function update(nextProduct, result) {
      product = nextProduct;
      renderProgress();
      if (result) showReveal(result);
    }

    renderProgress();

    return { update, showReveal, render: renderProgress };
  }

  window.BoardInfo = {
    create: createBoardInfo,
  };
})();
