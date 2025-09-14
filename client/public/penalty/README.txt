Penalty — Edited Files (drop-in)
================================

Replace just these files in your /penalty/ folder:

- penalty/index.html
  * Full-width canvas, no rotate overlays, correct vendor load order.

- penalty/js/CPreloader.js
  * Removes vendor logo; percent-only preloader.

- penalty/js/CInterface.js
  * Null-safe (prevents getStartPos* crash).
  * Hides Exit, Pause, Mute, Score, and 0/15 widgets.

ONE-LINE CHANGE you must do manually in your existing CMain.js so the game starts directly:

  // BEFORE
  this._onRemovePreloader = function(){
    this.gotoMenu();
  };

  // AFTER
  this._onRemovePreloader = function(){
    this.gotoGame();
  };

(Optional) To speed up loading, short-circuit sound preloading inside CMain.js if present:
  this._loadSounds = function(){
    if (this._onAllResourcesLoaded){ this._onAllResourcesLoaded(); return; }
  };

Finally, ensure these URLs return JavaScript (not HTML):
  /penalty/js/sprite_lib.js
  /penalty/js/CLang.js
  /penalty/js/CGame.js
