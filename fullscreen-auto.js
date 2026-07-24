(function () {
  "use strict";

  var STORAGE_KEY = "dottery-fs";
  var settled = false;
  var leaving = false;

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function wantsFullscreen() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (_e) {
      return false;
    }
  }

  function setWantsFullscreen(on) {
    try {
      if (on) sessionStorage.setItem(STORAGE_KEY, "1");
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (_e) {}
  }

  function requestFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.webkitRequestFullScreen) return el.webkitRequestFullScreen();
    return null;
  }

  function detach() {
    document.removeEventListener("pointerdown", onGesture, true);
    document.removeEventListener("pointerup", onGesture, true);
    document.removeEventListener("click", onGesture, true);
    document.removeEventListener("touchend", onGesture, true);
    document.removeEventListener("keydown", onGesture, true);
  }

  function settle() {
    settled = true;
    detach();
  }

  function onFullscreenChange() {
    if (fullscreenElement()) {
      setWantsFullscreen(true);
      settle();
      return;
    }
    if (!leaving) {
      setWantsFullscreen(false);
    }
  }

  function onGesture(event) {
    if (settled || !event.isTrusted) return;
    if (!wantsFullscreen()) {
      settle();
      return;
    }
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

  function markLeavingHard() {
    leaving = true;
    if (fullscreenElement() || wantsFullscreen()) {
      setWantsFullscreen(true);
    }
  }

  function markLeavingSoft() {
    if (fullscreenElement() || wantsFullscreen()) {
      setWantsFullscreen(true);
    }
  }

  function armRestore() {
    if (settled || !wantsFullscreen() || fullscreenElement()) return;
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("pointerup", onGesture, true);
    document.addEventListener("click", onGesture, true);
    document.addEventListener("touchend", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
  }

  window.addEventListener("dottery:before-page-leave", markLeavingSoft);
  window.addEventListener("pagehide", markLeavingHard);

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  if (fullscreenElement()) {
    setWantsFullscreen(true);
    settle();
  } else {
    armRestore();
  }
})();
