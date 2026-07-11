(function () {
  "use strict";

  ProductStore.loadCurrent()
    .then((product) => {
      if (!product) return;

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
      window.location.replace("/shop");
    });
})();
