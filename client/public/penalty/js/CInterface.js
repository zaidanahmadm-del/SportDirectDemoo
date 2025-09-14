function CInterface(){
    this._oButExit = null;
    this._oButPause = null;
    this._oAudioToggle = null;
    this._oScoreText = null;
    this._oShotsText = null;
    this._oScoreContainer = null;
    this._oShotsContainer = null;

    this.getStartPosScore = function(){ return { x: CANVAS_WIDTH - 160, y: 50 }; };
    this.getStartPosShots = function(){ return { x: CANVAS_WIDTH - 160, y: 90 }; };
    this.getStartPosExit  = function(){ return { x: -9999, y: -9999 }; };
    this.getStartPosAudio = function(){ return { x: -9999, y: -9999 }; };
    this.getStartPosPause = function(){ return { x: -9999, y: -9999 }; };

    this._init = function(){
        this.refreshButtonPos();
        try {
          if (this._oButExit)      { this._oButExit.visible = false; if(this._oButExit.setVisible) this._oButExit.setVisible(false); }
          if (this._oAudioToggle)  { this._oAudioToggle.visible = false; if(this._oAudioToggle.setVisible) this._oAudioToggle.setVisible(false); }
          if (this._oButPause)     { this._oButPause.visible = false; if(this._oButPause.setVisible) this._oButPause.setVisible(false); }
          if (this._oScoreText)    { this._oScoreText.visible = false; }
          if (this._oShotsText)    { this._oShotsText.visible = false; }
          if (this._oScoreContainer) { this._oScoreContainer.visible = false; }
          if (this._oShotsContainer) { this._oShotsContainer.visible = false; }
        } catch(e){}
    };

    this.refreshButtonPos = function(){
        var ox = (typeof s_iOffsetX !== "undefined") ? s_iOffsetX : 0;
        var oy = (typeof s_iOffsetY !== "undefined") ? s_iOffsetY : 0;
        var setPos = function(node, pos){
            if (!node || !pos) return;
            if (typeof node.setPosition === "function") { node.setPosition(pos.x - ox, pos.y + oy); }
            else { node.x = pos.x - ox; node.y = pos.y + oy; }
        };
        if (this._oScoreText)    setPos(this._oScoreText, this.getStartPosScore && this.getStartPosScore());
        if (this._oShotsText)    setPos(this._oShotsText, this.getStartPosShots && this.getStartPosShots());
        if (this._oButExit)      setPos(this._oButExit, this.getStartPosExit && this.getStartPosExit());
        if (this._oAudioToggle)  setPos(this._oAudioToggle, this.getStartPosAudio && this.getStartPosAudio());
        if (this._oButPause)     setPos(this._oButPause, this.getStartPosPause && this.getStartPosPause());
    };

    this._init();
}
