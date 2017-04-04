//Starts on document load
$(function () {
    var $canvas = $("#gameboy-canvas");
    if ($canvas.length !== 0) { //If we found it, go
        var gb = new GameBoy($canvas);
    } else {
        console.error("No element with id \"gameboy-canvas\" was found.");
    }
});

//Expects a JQuery object representing the container this will render into.
function GameBoy($canvas){
    
    State = {
    
    }
    
}