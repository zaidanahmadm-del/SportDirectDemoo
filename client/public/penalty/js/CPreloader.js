/* Lightweight preloader without vendor logo */
function CPreloader(){
    var _oText = null;
    var _iTotResources = 0;
    var _iCurResources = 0;

    this._init = function(){
        _iTotResources = (s_oSpriteLibrary && s_oSpriteLibrary.getNumSprites) ? s_oSpriteLibrary.getNumSprites() : 1;

        _oText = new createjs.Text("0%","24px Arial","#ffffff");
        _oText.textAlign = "center";
        _oText.x = CANVAS_WIDTH/2;
        _oText.y = CANVAS_HEIGHT/2;
        s_oStage.addChild(_oText);

        if (s_oSpriteLibrary && s_oSpriteLibrary.setLoadedCallback){
            s_oSpriteLibrary.setLoadedCallback( this.resourceLoaded );
        }
        if (s_oMain && s_oMain.preloaderReady){
            s_oMain.preloaderReady();
        }
    };

    this.resourceLoaded = function(){
        _iCurResources++;
        var perc = Math.min(100, Math.floor((_iCurResources/_iTotResources)*100));
        _oText.text = perc + "%";
        try { s_oStage.update(); } catch(e){}

        if (_iCurResources === _iTotResources){
            setTimeout(function(){ if (s_oMain && s_oMain._onRemovePreloader) s_oMain._onRemovePreloader(); }, 0);
        }
    };

    this.unload = function(){
        try { s_oStage.removeChild(_oText); } catch(e){}
    };

    this._init();
}
