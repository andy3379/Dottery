try {
  var dir = sessionStorage.getItem("dottery-page-x");
  if (dir === "to-board" || dir === "to-shop") {
    document.documentElement.classList.add("page-x-prep", "page-x-prep--" + dir);
  }
} catch (_e) {}
