function CPreloader(){
    var _oText = null;
    var _iTotResources = 0;
    var _iCurResources = 0;

    this._init = function(){
        _iTotResources = s_oSpriteLibrary.getNumSprites ? s_oSpriteLibrary.getNumSprites() : 1;
        _oText = new createjs.Text("0%","24px Arial","#fff");
        _oText.textAlign = "center";
        _oText.x = CANVAS_WIDTH/2;
        _oText.y = CANVAS_HEIGHT/2;
        s_oStage.addChild(_oText);

        s_oSpriteLibrary.setLoadedCallback ? s_oSpriteLibrary.setLoadedCallback( this.resourceLoaded ) : null;
        if (s_oMain && s_oMain.preloaderReady) s_oMain.preloaderReady();
    };

    this.resourceLoaded = function(){
        _iCurResources++;
        var perc = Math.min(100, Math.floor((_iCurResources/_iTotResources)*100));
        _oText.text = perc + "%";
        s_oStage.update();

        if(_iCurResources === _iTotResources){
            setTimeout(function(){ s_oMain._onRemovePreloader(); }, 0);
        }
    };

    this.unload = function(){
        s_oStage.removeChild(_oText);
    };

    this._init();
}
