
/* Disable CTL orientation overlay & any pause it triggers */
(function () {
  function hideDomOverlays() {
    var ids = [
      "block_mobile","block_landscape","block_portrait",
      "rotate_landscape","rotate_device","orientation_msg"
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = "none";
        el.style.visibility = "hidden";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    });
  }

  function patch() {
    try {
      window.ENABLE_CHECK_ORIENTATION = false;
    } catch(e) {}

    if (window.s_oMain) {
      try {
        if (typeof s_oMain.onOrientationChange === "function") {
          s_oMain.onOrientationChange = function () {
            try { if (window.s_oGame && typeof s_oGame.pause === "function") s_oGame.pause(false); } catch(e){}
            try { if (window._oOrientContainer) _oOrientContainer.visible = false; } catch(e){}
          };
        }
      } catch (e) {}
    }
    hideDomOverlays();
  }

  var tries = 0;
  var iid = setInterval(function () {
    patch();
    tries++;
    if (tries > 60) clearInterval(iid);
  }, 100);
  window.addEventListener("load", patch);
  document.addEventListener("DOMContentLoaded", patch, { once: true });
})();
