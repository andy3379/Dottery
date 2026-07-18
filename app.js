(function () {
  "use strict";

  ProductStore.loadCurrent()
    .then((product) => {
      if (!product) return;

      if (new URLSearchParams(window.location.search).get("preview") === "1") {
        document.documentElement.classList.add("is-preview");
        const homeLink = document.querySelector(".home-link");
        if (homeLink) homeLink.hidden = true;
      }

      const boardInfo = BoardInfo.create({ product });
      const mapView = MapView.create({
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
      window.Dottery = { product, mapView, boardInfo };
    })
    .catch(() => {
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
