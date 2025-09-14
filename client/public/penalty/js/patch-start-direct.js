
/* Force game to start directly (skip CTL menu) */
(function () {
  function startIfReady() {
    try {
      if (window.s_oMain && typeof s_oMain.gotoGame === "function") {
        if (!window.__CTL_FORCED_START__) {
          window.__CTL_FORCED_START__ = true;
          s_oMain.gotoGame();
        }
        return true;
      }
    } catch (e) {}
    return false;
  }
  if (!startIfReady()) {
    var iid = setInterval(function () { if (startIfReady()) clearInterval(iid); }, 80);
    setTimeout(function () { clearInterval(iid); }, 6000);
  }
})();
