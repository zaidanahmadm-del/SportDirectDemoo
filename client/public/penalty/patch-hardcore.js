
/* Penalty Hardcore Patch ... see previous cell for full comments */
(function () {
  var LOG = function(){ try { console.log.apply(console, arguments); } catch(e){} };

  function hideDomRotate() {
    var ids = ["block_mobile","block_landscape","block_portrait","rotate_landscape","rotate_device","orientation_msg"];
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

  function disableOrientation() {
    try { window.ENABLE_CHECK_ORIENTATION = false; } catch(e){}
    try {
      if (window.s_oMain) {
        if (typeof s_oMain.onOrientationChange === "function") {
          s_oMain.onOrientationChange = function() {
            try { if (window.s_oGame && s_oGame.pause) s_oGame.pause(false); } catch(e){}
            try { if (window._oOrientContainer) _oOrientContainer.visible = false; } catch(e){}
            hideDomRotate();
          };
          LOG("[PenaltyPatch] onOrientationChange disabled");
        }
      }
    } catch(e){}
  }

  function forceStart() {
    try {
      if (window.s_oMain && typeof s_oMain.gotoGame === "function") {
        if (!window.__CTL_FORCED_START__) {
          window.__CTL_FORCED_START__ = true;
          s_oMain.gotoGame();
          LOG("[PenaltyPatch] gotoGame() forced");
        }
        return true;
      }
    } catch(e){}
    return false;
  }

  function fitCanvas() {
    try {
      var canvas = document.getElementById("canvas");
      if (!canvas) return;
      var parent = canvas.parentElement || document.body;
      var pw = parent.clientWidth || window.innerWidth;
      var ph = parent.clientHeight || window.innerHeight;

      var baseW = window.CANVAS_WIDTH || 960;
      var baseH = window.CANVAS_HEIGHT || 540;
      var targetW = pw;
      var targetH = Math.round(pw * (baseH / baseW));
      if (ph && targetH > ph) {
        targetH = ph;
        targetW = Math.round(ph * (baseW / baseH));
      }
      canvas.style.width = targetW + "px";
      canvas.style.height = targetH + "px";
      canvas.style.maxWidth = "100%";
      canvas.style.display = "block";
      canvas.style.margin = "0 auto";

      var container = document.getElementById("canvas_container") || canvas.parentElement;
      if (container) {
        container.style.width = targetW + "px";
        container.style.height = targetH + "px";
        container.style.margin = "0 auto";
      }
      document.body.style.background = "#247a3f";
    } catch(e){}
  }

  function stripInterface() {
    try {
      var iface = window.s_oInterface || window._oInterface || window.oInterface;
      if (!iface) return;

      var removed = [];
      function hide(obj, name) {
        try {
          if (obj) {
            if (obj.visible !== undefined) obj.visible = false;
            if (obj.setVisible) obj.setVisible(false);
            if (obj.alpha !== undefined) obj.alpha = 0;
            if (obj.stop) try { obj.stop(); } catch(e){}
            removed.push(name);
          }
        } catch(e){}
      }

      hide(iface._oButExit, "Exit");
      hide(iface._oButPause, "Pause");
      hide(iface._oAudioToggle, "Audio");
      hide(iface._oScoreText, "ScoreText");
      hide(iface._oShotsText, "ShotsText");
      hide(iface._oShotsContainer, "ShotsContainer");
      hide(iface._oScoreContainer, "ScoreContainer");

      try {
        var stage = window.s_oStage || window.stage;
        if (stage && stage.children) {
          stage.children.forEach(function (c) {
            try {
              if (c.text && typeof c.text === "string") {
                var t = c.text.toUpperCase();
                if (t.indexOf("SCORE") !== -1 || t.indexOf("/15") !== -1) {
                  c.visible = false; removed.push("Text:"+t);
                }
              }
            } catch(e){}
          });
        }
      } catch(e){}

      if (removed.length) LOG("[PenaltyPatch] UI removed:", removed.join(", "));
    } catch(e){}
  }

  function tick() {
    hideDomRotate();
    disableOrientation();
    forceStart();
    fitCanvas();
    stripInterface();
  }

  LOG("[PenaltyPatch] Hardcore patch loaded");
  tick();
  var n = 0, iid = setInterval(function(){
    tick();
    if (++n > 120) clearInterval(iid);
  }, 100);

  window.addEventListener("resize", fitCanvas);
  window.addEventListener("orientationchange", function(){
    setTimeout(function(){ fitCanvas(); hideDomRotate(); }, 200);
  });

  window.addEventListener("load", tick);
  document.addEventListener("DOMContentLoaded", tick, { once: true });
})();
