(function () {
  "use strict";

  var settled = false;

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function requestFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.webkitRequestFullScreen) return el.webkitRequestFullScreen();
    return null;
  }

  function detach() {
    document.removeEventListener("pointerup", onGesture, true);
    document.removeEventListener("click", onGesture, true);
    document.removeEventListener("keydown", onGesture, true);
  }

  function settle() {
    settled = true;
    detach();
  }

  function onFullscreenChange() {
    if (fullscreenElement()) {
      settle();
    }
  }

  function onGesture(event) {
    if (settled || !event.isTrusted) return;
    if (fullscreenElement()) {
      settle();
      return;
    }
    try {
      var result = requestFullscreen();
      if (result && typeof result.then === "function") {
        result.then(settle, function () {});
      }
    } catch (_e) {}
  }

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("pointerup", onGesture, true);
  document.addEventListener("click", onGesture, true);
  document.addEventListener("keydown", onGesture, true);
})();
