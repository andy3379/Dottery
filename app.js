(function () {
  "use strict";

  if (!document.getElementById("viewport")) return;

  let disposed = false;
  let mapView = null;
  let unsubPriceCalc = null;

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (unsubPriceCalc) {
      unsubPriceCalc();
      unsubPriceCalc = null;
    }
    if (mapView && typeof mapView.destroy === "function") {
      mapView.destroy();
    }
    mapView = null;
    if (window.Dottery) window.Dottery = null;
  }

  window.addEventListener("dottery:page-dispose", dispose, { once: true });

  ProductStore.loadCurrent()
    .then((product) => {
      if (disposed || !product) return;

      const detailImage = document.getElementById("boardDetailImage");
      if (detailImage && product.detailImage) {
        detailImage.src = product.detailImage;
        detailImage.hidden = false;
      }

      if (new URLSearchParams(window.location.search).get("preview") === "1") {
        document.documentElement.classList.add("is-preview");
        const homeLink = document.querySelector(".home-link");
        if (homeLink) homeLink.hidden = true;
      }

      const boardInfo = BoardInfo.create({
        product,
        canRevealNext: () => (mapView ? mapView.hasOpenableSlots() : false),
        onRevealBack: () => mapView && mapView.exitScratch(),
        onRevealNext: () => mapView && mapView.enterRandomScratch(),
      });

      mapView = MapView.create({
        product,
        onSlotClaimed(_result, nextProduct) {
          boardInfo.update(nextProduct);
        },
        onSlotRevealed(result, nextProduct) {
          if (result.product) {
            Object.assign(nextProduct, result.product);
          }
          boardInfo.update(nextProduct, result);
        },
      });

      mapView.mount();

      (function mountPriceCalc() {
        const root = document.getElementById("priceCalc");
        const codeEl = document.getElementById("priceCalcCode");
        const amountEl = document.getElementById("priceCalcAmount");
        if (!root || !window.PriceCalc) return;

        function render(session) {
          if (disposed) return;
          const active = Boolean(session && session.active);
          root.hidden = !active;
          if (!active) return;
          if (codeEl) codeEl.textContent = session.code;
          if (amountEl) amountEl.textContent = PriceCalc.formatAmount(session.total);
        }

        render(PriceCalc.get());
        unsubPriceCalc = PriceCalc.subscribe(render);
      })();

      window.Dottery = { product, mapView, boardInfo };
    })
    .catch(() => {
      if (disposed) return;
      if (new URLSearchParams(window.location.search).get("preview") === "1") {
        return;
      }
      if (window.PageTransition) {
        PageTransition.navigate("/shop", "to-shop");
      } else {
        window.location.replace("/shop");
      }
    });
})();
