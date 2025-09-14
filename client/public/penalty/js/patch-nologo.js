
/* Replace any 'logo' sprite with tiny transparent image so preloader draws nothing */
(function () {
  function replaceLogoSprite() {
    if (window.s_oSpriteLibrary && typeof s_oSpriteLibrary.addSprite === "function") {
      var _orig = s_oSpriteLibrary.addSprite.bind(s_oSpriteLibrary);
      s_oSpriteLibrary.addSprite = function (id, path) {
        try {
          if (String(id).toLowerCase().indexOf("logo") !== -1) {
            return _orig(id, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=");
          }
        } catch (e) {}
        return _orig(id, path);
      };
      return true;
    }
    return false;
  }
  if (!replaceLogoSprite()) {
    var iid = setInterval(function () { if (replaceLogoSprite()) clearInterval(iid); }, 50);
    setTimeout(function () { clearInterval(iid); }, 5000);
  }
})();
