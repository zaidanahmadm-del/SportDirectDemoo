
/**
 * Patch-All (single file):
 * - disable rotate overlays (DOM + in-canvas)
 * - remove vendor preloader logo (intercept sprite add)
 * - force start in gameplay (gotoGame)
 * - verbose console logs to verify it's running
 */
(function () {
  console.log("[PenaltyPatch] Loaded");

  // 1) Hide any DOM rotate overlays
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

  // 2) Intercept logo sprite to remove vendor loading image
  function interceptLogoSprite() {
    try {
      if (window.s_oSpriteLibrary && typeof s_oSpriteLibrary.addSprite === "function") {
        if (!window.__LOGO_PATCHED__) {
          var _orig = s_oSpriteLibrary.addSprite.bind(s_oSpriteLibrary);
          window.__LOGO_PATCHED__ = true;
          s_oSpriteLibrary.addSprite = function (id, path) {
            if (String(id).toLowerCase().indexOf("logo") !== -1) {
              console.log("[PenaltyPatch] Replacing logo sprite");
              return _orig(id, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=");
            }
            return _orig(id, path);
          };
        }
        return true;
      }
    } catch (e) {}
    return false;
  }

  // 3) Disable orientation handler and unpause game if called
  function disableOrientation() {
    try { window.ENABLE_CHECK_ORIENTATION = false; } catch(e) {}
    try {
      if (window.s_oMain && typeof s_oMain.onOrientationChange === "function") {
        s_oMain.onOrientationChange = function () {
          try { if (window.s_oGame && typeof s_oGame.pause === "function") s_oGame.pause(false); } catch(e){}
          try { if (window._oOrientContainer) _oOrientContainer.visible = false; } catch(e){}
          hideDomOverlays();
        };
        console.log("[PenaltyPatch] Orientation handler disabled");
        return true;
      }
    } catch(e){}
    return false;
  }

  // 4) Force start in game (skip menu)
  function forceStart() {
    try {
      if (window.s_oMain && typeof s_oMain.gotoGame === "function") {
        if (!window.__CTL_FORCED_START__) {
          window.__CTL_FORCED_START__ = true;
          console.log("[PenaltyPatch] Forcing gotoGame()");
          s_oMain.gotoGame();
        }
        return true;
      }
    } catch(e){}
    return false;
  }

  function tick() {
    hideDomOverlays();
    interceptLogoSprite();
    disableOrientation();
    forceStart();
  }

  // Run immediately and for a bit afterwards to catch late initializers
  tick();
  var n = 0;
  var iid = setInterval(function () {
    tick();
    n++;
    if (n > 100) clearInterval(iid);
  }, 80);

  window.addEventListener("load", tick);
  document.addEventListener("DOMContentLoaded", tick, { once: true });

})();
