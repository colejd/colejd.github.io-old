//#Perlin Noise Field
//
// Appropriated from http://haptic-data.com/toxiclibsjs/examples/perlin-noise-canvas
// Licensed under GPL 2.1
//
//Perlin Noise Field is an example showing how to use `toxi.math.noise.PerlinNoise`
//for animating vectors or creating procedural textures.

var canvas = document.getElementById('perlin-canvas');
var ctx = canvas.getContext('2d');
var perlin = new toxi.math.noise.PerlinNoise();
var bounds = new toxi.geom.Rect();
var lastPos = new toxi.geom.Vec2D();
var gui;
var offset = 0;
var options;
var streams = [];
var palette;

palette = [
    toxi.color.TColor.newHex('1c0f17'),
    toxi.color.TColor.newHex('271d2e'),
    toxi.color.TColor.newHex('2c3857'),
    toxi.color.TColor.newHex('155e73').setBrightness(0.9),
    toxi.color.TColor.newHex('e8ca59'),
    toxi.color.TColor.newHex('891b1b')
];

options = {
    running: true,
    numStreams: 50,
    distort: 0, //"Progression": waviness along waves
    strength: 0, //Directional
    scalar: 0.05, //Meta-amplitude
    step: 1 //speed
};

determineDirectionality();
setCanvasSize();

ctx.fillStyle = "#151515";
ctx.strokeStyle = "#ff0000";
ctx.lineWidth = 1.5;

/*
//setup gui
dat.GUI.autoPlace = false;
gui = new dat.GUI();
gui.add(options, 'running').onChange(function(){
    if( options.running ){
        draw();
    }
});
gui.add(options,'numStreams', 1, 4500, 1.0).name("# Streams").onChange(throttleStreams);
gui.add(options,'step',0.25,10,0.25).name("Speed");
gui.add(options,'distort',-0.5,0.5,0.001).name("Progression");
gui.add(options,'strength',0.01,Math.PI*2,0.01).name("Directional");
gui.add(options,'scalar',0.01,0.25,0.01).name("Scalar");

gui.domElement.style.position = 'relative';
gui.domElement.style.top = '100px';
//gui.domElement.style.left = '5px';
//document.getElementById('perlin-canvas').appendChild( gui.domElement );
*/

function determineDirectionality(){
    var r = Math.random() * Math.PI;
    options.strength = r;
    //Make it zero sometimes
    if(r < 0.75){
        options.strength = 0;
    }
    
    //var scalarTrigger = Math.random() * Math.PI;
    //if(scalarTrigger < 0.75){
    //    var meta = Math.random() % 0.75;
    //    options.scalar = meta;
    //}

}

function throttleStreams(){
    //throttle streams if the gui has changed
    while(options.numStreams > streams.length){
        streams.push( createStream() );
    }
    while(options.numStreams < streams.length){
        streams.shift();
    }
}

throttleStreams();


function setCanvasSize(){
    canvas.style.width="100%";
    canvas.style.height="100%";
    canvas.width = window.innerWidth;
    canvas.height= window.innerHeight * 0.05;
    bounds.set( 0, 0, canvas.width, canvas.height );
}
function createStream(){
    var vec = getRandomVector();
    vec.color = palette[ Math.floor(Math.random()*palette.length) ].toRGBACSS();
    return vec;
}
//get a random point on the canvas, with a random color
function getRandomVector(){
    return new toxi.geom.Vec2D(Math.random(), Math.random()).scaleSelf(canvas.width,canvas.height);
}
//call draw for the first time once load is complete
window.onload = draw;
var pt = new toxi.geom.Vec2D();

//update the canvas
function draw(){
    var i = 0,
        l = streams.length,
        stream;

    offset += options.distort;
    //Fade the window
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    //ctx.fillStyle = "rgba(0.082,0.082,0.082,0.05)"; //short tails
    ctx.fillRect(0,0,canvas.width,canvas.height);
    for(; i<l; i++ ){
        stream = streams[i];
        ctx.strokeStyle = stream.color;
        lastPos.set(stream);
        pt.set(stream).scaleSelf(options.scalar).addSelf(0, offset);
        //var pt = stream.scale( options.scalar ).addSelf( 0, offset);
        var noise = perlin.noise( pt.x, pt.y ) - 0.5;
        var angle = options.strength * noise;
        var dir = toxi.geom.Vec2D.fromTheta( angle );

        stream.addSelf( dir.normalizeTo(options.step*3) );
        ctx.beginPath();
        ctx.moveTo(lastPos.x,lastPos.y);
        ctx.lineTo(stream.x,stream.y);
        ctx.closePath();
        ctx.stroke();
        if( !bounds.containsPoint(stream) ){
            stream.set( getRandomVector() );
        }
    }
    //using `requestAnimationFrame` with a [polyfill](http://paulirish.com/2011/requestanimationframe-for-smart-animating/)
    if( options.running ){
        window.requestAnimationFrame(draw);
    }
}

window.addEventListener('resize', setCanvasSize, false );
