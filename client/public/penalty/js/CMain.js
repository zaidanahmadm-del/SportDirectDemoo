function CMain(){
    var _oPreloader = null;
    var _bUpdate = false;
    var _iState = 0;
    var _oGame = null;
    var _oMenu = null;

    this.initContainer = function(){
        _oPreloader = new CPreloader();
    };

    this.preloaderReady = function(){
        this._loadImages();
    };

    this._loadImages = function(){
        s_oSpriteLibrary.init( this._onImagesLoaded );
    };

    this._onImagesLoaded = function(){
        s_oMain._onRemovePreloader();
    };

    this._onRemovePreloader = function(){
        this.gotoGame();
    };

    this.gotoMenu = function(){
        _iState = 1;
        _oMenu = {};
    };

    this.gotoGame = function(){
        _iState = 3;
        _oGame = new CGame();
        _bUpdate = true;
    };

    this.update = function(){
        if(_bUpdate && s_oStage){
            s_oStage.update();
        }
    };

    s_oMain = this;
    s_oStage = new createjs.Stage(document.getElementById("canvas"));
    createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED;
    createjs.Ticker.framerate = 30;
    createjs.Ticker.addEventListener("tick", this.update);
    this.initContainer();
}
var s_oStage = null;
var s_oMain = null;
var s_oSpriteLibrary = new CSpriteLibrary();
