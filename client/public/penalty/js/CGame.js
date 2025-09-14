function CGame(){
    var _oInterface = null;
    var _iGoals = 0;

    this._init = function(){
        _oInterface = new CInterface();

        // This is a stub goal trigger for integration.
        // Replace with the vendor's real goal callback in your copy.
        var hit = new createjs.Shape();
        hit.graphics.beginFill("rgba(0,0,0,0.001)").drawRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        hit.on("click", ()=>{ this._onGoal(); });
        s_oStage.addChild(hit);
    };

    this._onGoal = function(){
        _iGoals++;
        if (_iGoals >= 1){
            try { window.parent && window.parent.postMessage({type:"PENALTY_GOAL"}, "*"); } catch(e){}
        }
    };

    this.pause = function(bVal){};
    this.unload = function(){ s_oStage.removeAllChildren(); };

    this._init();
}
