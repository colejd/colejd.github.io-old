//Hit detection options
var hitOptions = {
    segments: true
    , stroke: true
    , fill: true
    , tolerance: 2
};


//Number of segments in the rubber band
var segments = 20;

//Flag that is raised when the mouse enters the collider and is lowered when it leaves
var collisionDetected = false;

//Current amount of twang energy in the system
var twangAmount = 0.0;
//Cap on the amplitude of the waveform
var maxAmplitude = 40;
//The amount of time it will take for twang to dissipate
var twangSeconds = 1;
//Minimum length of event delta to activate twang
var minTwangVelocity = 0;
//Speed of the waveform propagation
var twangCycleSpeed = 15; //20

var canvas = document.getElementById('rubberBandWidget');
var context = canvas.getContext('2d');

var testPath;
var wavePath;

function resizePath(){
    if(testPath != null) {
        testPath.remove();
    }

    var w = $(window).width();
    var h = $(window).height();
    view.viewSize = new Size(w, h);
    console.log(h);
    view.draw();

    var sidebar = document.getElementById("sidebar");
    var sidebarDims = sidebar.getBoundingClientRect();
    var documentDims = canvas.getBoundingClientRect();

    var p1 = new Point(sidebarDims.right, 0);
    var p2 = new Point(sidebarDims.right, h);

    console.log(documentDims);

    testPath = makeInterpolatedPath(segments, p1, p2);
    testPath.strokeColor = '#e86231';
    testPath.strokeWidth = 2;
    testPath.fullySelected = false;
    testPath.opacity = 0;

    wavePath = testPath.clone();
    wavePath.opacity = 1;
}


function lerp(value1, value2, amount) {
    amount = amount < 0 ? 0 : amount;
    amount = amount > 1 ? 1 : amount;
    return value1 + (value2 - value1) * amount;
};

function makeInterpolatedPath(numPoints, point1, point2){
    var path = new Path();
    for (var i = 0; i < numPoints; i++) {
        var x = lerp(point1.x, point2.x, i / numPoints);
        var y = lerp(point1.y, point2.y, i / numPoints);
        path.add(new Point(x, y));
    }
    return path;
}

function pathFromEventDelta(event) {
    var path = new Path();
    path.add(event.lastPoint);
    path.add(event.point);
    return path;
}

function detectCollisionsInterpolated(event, path) {
    var hitResult;
    var deltaLength = event.delta.length;
    if (deltaLength <= hitOptions.tolerance) {
        hitResult = path.hitTest(event.point, hitOptions);
    } else {
        //If the delta is longer than the tolerance, we need to test every point
        //along the delta path (ideally every <tolerance> pixels)
        var eventPath = pathFromEventDelta(event);
        var intersections = path.getIntersections(eventPath);
        if (intersections.length > 0) {
            hitResult = intersections[0];
        }
    }

    return hitResult;

}

function onMouseMove(event) {
    //var hitResult = testPath.hitTest(event.point, hitOptions);
    var hitResult = detectCollisionsInterpolated(event, wavePath);
    if (hitResult) {
        if (collisionDetected == false) {
            collisionDetected = true;
            //Do one-time-per-pluck event here
            addTwang(event, wavePath, hitResult.point.x, hitResult.point.y);
        }
    } else {
        collisionDetected = false;
    }
}

function addTwang(event, path, x, y) {

    var twangForce = event.delta.length;
    if (twangForce > minTwangVelocity) {
        //Get twang force multiplier as a value between 0 and 1
        //100+ pixel delta length will produce a value of 1
        if (twangForce > 100) {
            twangForce = 100;
        }
        twangForce = twangForce / 100;

        //Add the new force to the current energy in the rubber band,
        //capped at maxAmplitude
        twangAmount += twangForce * maxAmplitude;
        if (twangAmount > maxAmplitude) {
            twangAmount = maxAmplitude;
        }
        //console.log(twangAmount);
    }
}

function onFrame(event) {
    if (twangAmount > 0) {
        var energyLoss = (maxAmplitude / twangSeconds) * event.delta;
        twangAmount -= energyLoss;
        if (twangAmount < 0) twangAmount = 0;
        for (var i = 1; i < wavePath.segments.length - 1; i++) {
            var segment = wavePath.segments[i];

            // A cylic value between -1 and 1
            var sinus = Math.sin(event.time * twangCycleSpeed + i);

            if (i == 1 || i == wavePath.segments.length - 1) {
                sinus = sinus * 0.65;
            }

            // Change the y position of the segment point:
            segment.point.x = sinus * (twangAmount) + testPath.segments[i].point.x;
        }
        wavePath.smooth();
    }
}

$(document).ready(function (e) {
    $(window).resize(resizePath);
    resizePath();

});
