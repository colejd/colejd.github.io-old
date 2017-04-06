//Starts on document load
$(function () {
    var $container = $("#reaction-diffusion-container");
    if ($container.length !== 0) { //If we found it, go
        if(!$container.hasClass("rd-loaded")){ //If it isn't spoken for
            var simulator = new ReactionDiffusionSimulator($container);
        }
    } else {
        console.error("No element with id \"reaction-diffusion-container\" was found.");
    }
});

//Expects a JQuery object representing the container this will render into.
function ReactionDiffusionSimulator($container, initImageURL) {
    //If <= 0, the object is ready to begin running.
    var loadingSemaphore = 0;

    //Presets serialized from JSON
    var presets;

    var container = $container.get(0);

    var camera, scene, renderer;
    var stats;

    var display_frag_source;
    var compute_frag_source;
    var compute_vert_source;

    var displayMesh;
    var displayMaterial;
    var displayMaterialUniforms;

    var computeRenderTargets = [];
    var computeMaterial;
    var computeUniforms;

    var passThroughMaterial;
    var passThroughUniforms;

    var computeStepsPerFrame;
    var currentTargetIndex = 0;

    var internalResolutionMultiplier = 1.0;
    var filterType = THREE.LinearFilter; //THREE.NearestFilter
    var imageType = THREE.FloatType;

    var startTime = Date.now();

    var mousePos = new THREE.Vector2();
    var mouseIsDown = false;

    var imageURL = initImageURL;

    var isMobile = mobileAndTabletCheck();

    var $stats;

    //Pseudo-constructor. Load resources, returning if we don't have anything
    //we require to run.
    (function () {

        //Early out if we don't have WebGL
        if (!webgl_detect()) {
            return exit("WebGL is not supported on this browser.");
        }

        renderer = new THREE.WebGLRenderer({
            premultipliedAlpha: false,
            preserveDrawingBuffer: false
        });
        renderer.autoClear = false;

        console.log("Renderer capabilities:");
        console.log(renderer.capabilities);

        //Early out if we don't have the extensions we need
        if (!renderer.extensions.get("OES_texture_float")) {
            return exit("No OES_texture_float support");
        }
        if (renderer.capabilities.maxVertexTextures === 0) {
            return exit("No support for vertex shader textures");
        }
        if (!renderer.extensions.get("OES_texture_float_linear")){
            return exit("No OES_texture_float_linear support");
        }
        //Check if we can use floating point render targets
        //Not supported by most browsers, may be supported even if this extension is not exposed
//        if(isMobile && !renderer.extensions.get("WEBGL_color_buffer_float")){
//            return exit("No WEBGL_color_buffer_float support");
//        }
//        if(!renderer.extensions.get("EXT_color_buffer_half_float")){
//            return exit("No EXT_color_buffer_half_float support");
//        }
//        if (renderer.capabilities.maxVaryings < 9){
//            //Does not support 9-point stencil
//        }
        if (renderer.capabilities.maxVaryings < 5){
            return exit("Does not support the number of varying vectors (>= 5) needed to function");
        }

        //Load shader strings from files
        signalLoadStarted();
        loadFiles(['reaction-diffusion/shaders/display-frag.glsl', 'reaction-diffusion/shaders/compute-frag.glsl', 'reaction-diffusion/shaders/compute-vert.glsl'], function (shaderText) {
            display_frag_source = shaderText[0];
            compute_frag_source = shaderText[1];
            compute_vert_source = shaderText[2];

            signalLoadFinished();
        }, function (url) {
            //alert('Failed to fetch "' + url + '"');
            console.error('Failed to fetch "' + url + '"');
            return exit();
        });

        //Load presets object from JSON
        signalLoadStarted();
        $.getJSON("reaction-diffusion/js/Presets.js", function (result) {
            presets = result;
            signalLoadFinished();
        });
    })();

    function exit(message){
        if(message != null){
            console.error(message);
        }
        $container.append("<div class='no-webgl-support'>\
                        <p>Your browser does not seem to support \
                        <a href='http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation'>WebGL</a>.\
                        <br> Find out how to get it <a href='http://get.webgl.org/'>here</a>.<br> (Error: " +
                        message +
                        ")</p></div>");

        return false;

    }

    //Raises the loading semaphore.
    function signalLoadStarted() {
        loadingSemaphore += 1;
    }

    //Decrements the loading semaphore and starts execution if it is fully lowered.
    function signalLoadFinished() {
        loadingSemaphore -= 1;
        if (loadingSemaphore <= 0) {
            init();
        }
    }

    //Begin execution here
    function init() {
        $container.addClass("rd-loaded");
        //Set up renderer and embed in HTML
        renderer.setSize(nearestPow2(container.offsetWidth), nearestPow2(container.offsetHeight));
        renderer.setClearColor(0x00ffff, 1); //Cyan clear color
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        //Prevent text selection when dragging the mouse outside of the canvas
        document.onselectstart = function(e) {
            if(mouseIsDown){
                e.preventDefault();
                return false;
            }
        };

        if(isMobile){
            imageType = THREE.HalfFloatType;
        }

        //Set up listener events for container
        container.onmousedown = onMouseDown;
        document.addEventListener("mouseup", onMouseUp);
        container.onmousemove = onMouseMove;
        container.onmouseout = onMouseOut;
        container.ontouchstart = onTouchStart;
        container.ontouchend = onTouchEnd;
        container.ontouchmove = onTouchMove;

        initMaterials();

        scene = new THREE.Scene();
        //Set up 1x1 orthographic camera looking along the negative z axis
        camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 10, 100);
        camera.position.z = 50; //Scoot backward 50 units

        //Make plane primitive
        var displayGeometry = new THREE.PlaneGeometry(1.0, 1.0);

        displayMesh = new THREE.Mesh(displayGeometry, displayMaterial);
        scene.add(displayMesh);

        resize(container.clientWidth, container.clientHeight);

        if(!initRenderTargetFromImage(computeRenderTargets[0], null) || !initRenderTargetFromImage(computeRenderTargets[1], null)){
            container.removeChild(renderer.domElement);
            return;
        }

        //Set up GUI
        initGUI();

        stats = new Stats();
        //document.body.appendChild(stats.dom);
        $stats = $(stats.dom).appendTo(container);
        $stats.hide();

        //doRenderPass(1);
//        applyFunctionToRenderTarget(computeRenderTargets[0], function (texture) {
//            //Seed it with the variables we want
//            //seedInitial(texture);
//            //seedCircle(texture, sizeX * 0.5, sizeY * 0.5, 200, 50);
//            seedCircle(texture, texture.width * 0.5, texture.height * 0.5, Math.min(texture.width, texture.height) * 0.33, Math.min(texture.width, texture.height) * 0.125);
//
//            //Add some bias in the center
//            seedFilledCircle(texture, texture.width * 0.5, texture.height * 0.5, Math.min(texture.width, texture.height) * 0.25, 2);
//        });

        renderLoop();
    }

    function initMaterials() {
        displayMaterialUniforms = {
            time: {
                type: "f",
                value: 1.0
            },
            resolution: {
                type: "v2",
                value: new THREE.Vector2()
            },
            displayTexture: {
                value: null
            }
        };

        displayMaterial = new THREE.ShaderMaterial({
            uniforms: displayMaterialUniforms,
            vertexShader: getPassThroughVertexShader(),
            fragmentShader: display_frag_source
        });
        displayMaterial.blending = THREE.NoBlending;

        computeUniforms = {
            sourceTexture: {
                type: "t",
                value: undefined
            },
            resolution: {
                type: "v2",
                value: new THREE.Vector2()
            },
            time: {
                type: "f",
                value: 1.0
            },
            feed: {
                type: "f",
                value: 1.0
            },
            kill: {
                type: "f",
                value: 1.0
            },
            biasStrength: {
                type: "f",
                value: 1.0
            },
            timestep: {
                type: "f",
                value: 1.0
            },
            interactPos: {
                type: "v2",
                value: new THREE.Vector2(-1, -1)
            },
            doPass: {
                type: "f",
                value: 1.0
            },
            dropperSize: {
                type: "f",
                value: 1.0
            }
        }

        computeMaterial = new THREE.ShaderMaterial({
            uniforms: computeUniforms,
            vertexShader: compute_vert_source,
            fragmentShader: compute_frag_source,
        });
        computeMaterial.blending = THREE.NoBlending;

        passThroughUniforms = {
            texture: {
                value: null
            }
        };
        passThroughMaterial = new THREE.ShaderMaterial({
            uniforms: passThroughUniforms,
            vertexShader: getPassThroughVertexShader(),
            fragmentShader: getPassThroughFragmentShader()
        });
        passThroughMaterial.blending = THREE.NoBlending;
    }

    function initGUI() {
        var computeOptions = function () {
            this.timestep = 1.0; //Keep at 1.0
            this.d_a = 0.82; //Diffusion rate of A //1
            this.d_b = 0.41; //Diffusion rate of B //0.5
            this.feed = 0.035; //0.0372 //0.025
            this.kill = 0.064; //How fast b gets removed
            this.biasStrength = 0.005;
            this.selectedPresetName = presets[0].name;

            this.iterationsPerFrame = 20;
            this.dropperSize = 20.0;
        }

        var currentOptions = new computeOptions();

        function updateValuesFromGUI() {
            //heightmapVariable.material.uniforms.erosionConstant.value = effectController.erosionConstant;
            computeUniforms.timestep.value = currentOptions.timestep;
            computeUniforms.feed.value = currentOptions.feed;
            computeUniforms.kill.value = currentOptions.kill;
            computeUniforms.biasStrength.value = currentOptions.biasStrength;
            computeUniforms.dropperSize.value = currentOptions.dropperSize;

            computeStepsPerFrame = currentOptions.iterationsPerFrame;
        }

        function applyPreset() {
            //Find the preset by the selected name
            var preset = presets.filter(function (obj) {
                return obj.name == currentOptions.selectedPresetName;
            })[0];

            //Apply the preset
            currentOptions.feed = preset.feed;
            currentOptions.kill = preset.kill;
            currentOptions.biasStrength = preset.biasStrength;

//            for (var property in preset) {
//                currentOptions[property] = property;
//            }

            updateValuesFromGUI();
        }

        var gui = new dat.GUI({ autoplace: false, width: 300 });
        gui.close();

        //Preset control
        var names = presets.map(function (preset) {
            return preset.name;
        });
        gui.add(currentOptions, "selectedPresetName", names).onChange(applyPreset);

        //Folder for preset variables
        var presetFolder = gui.addFolder('Preset Options');
        presetFolder.add(currentOptions, "feed", 0.001, 0.1, 0.001).onChange(updateValuesFromGUI).listen().name("Feed Rate");
        presetFolder.add(currentOptions, "kill", 0.001, 0.1, 0.001).onChange(updateValuesFromGUI).listen().name("Kill Rate");
        //presetFolder.add(currentOptions, "biasStrength", 0.0, 0.1, 0.001).onChange(updateValuesFromGUI).listen();

        gui.add(currentOptions, "dropperSize", 0.0, 100.0, 0.5).onFinishChange(updateValuesFromGUI).listen().name("Dropper Size");
        gui.add(currentOptions, "iterationsPerFrame", 0, 50, 1).onChange(updateValuesFromGUI).listen().name("Iterations / Frame");
        gui.add(currentOptions, "timestep", 0.0, 1.0, 0.01).onChange(updateValuesFromGUI).listen().name("Timestep");

        var clearFn = {
            clear: function () {
                clear();
            }
        };
        gui.add(clearFn, "clear").name("Clear");

        var resetFn = {
            reset: function () {
                reset();
            }
        }
        gui.add(resetFn, "reset").name("Reset");

        var showPerformanceFn = {
            showPerformance: function() {
                $stats.toggle();
            }
        }
        gui.add(showPerformanceFn, "showPerformance").name("Toggle Performance Graph");

        applyPreset();
        updateValuesFromGUI();

    }

    function resize(width, height) {
        // Set the new shape of canvas.
        $container.width(nearestPow2(width));
        $container.height(nearestPow2(height));

        // Get the real size of canvas.
        var canvasWidth = $container.width();
        var canvasHeight = $container.height();

        renderer.setSize(canvasWidth, canvasHeight);
        console.log("Renderer sized to (" + canvasWidth + ", " + canvasHeight + ")");

        // TODO: Possible memory leak?
        var primaryTarget = new THREE.WebGLRenderTarget(canvasWidth * internalResolutionMultiplier, canvasHeight * internalResolutionMultiplier, {
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            minFilter: filterType,
            magFilter: filterType,
            format: THREE.RGBAFormat,
            type: imageType
        });
        var alternateTarget = new THREE.WebGLRenderTarget(canvasWidth * internalResolutionMultiplier, canvasHeight * internalResolutionMultiplier, {
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            minFilter: filterType,
            magFilter: filterType,
            format: THREE.RGBAFormat,
            type: imageType
        });

        computeRenderTargets.push(primaryTarget);
        computeRenderTargets.push(alternateTarget);

        displayMaterialUniforms.resolution.value = new THREE.Vector2(canvasWidth * internalResolutionMultiplier, canvasHeight * internalResolutionMultiplier);
        console.log("Display texture sized to (" + displayMaterialUniforms.resolution.value.x + ", " + displayMaterialUniforms.resolution.value.y + ")");

        computeUniforms.resolution.value = new THREE.Vector2(canvasWidth * internalResolutionMultiplier, canvasHeight * internalResolutionMultiplier);
        console.log("Compute texture sized to (" + computeUniforms.resolution.value.x + ", " + computeUniforms.resolution.value.y + ")");
    }

    var renderLoop = function (time) {

        if (mouseIsDown) {
            computeUniforms.interactPos.value = mousePos;
//            applyFunctionToRenderTarget(computeRenderTargets[currentTargetIndex], function(texture) {
//                seedCircle(texture, mousePos.x, mousePos.y, 25, 5);
//                //seedFilledCircle(texture, mousePos.x, mousePos.y, 25);
//            });
        }

        doRenderPass(time);

        stats.update();
        requestAnimationFrame(renderLoop);
    }

    var doRenderPass = function (time) {
        //Update uniforms
        var elapsedSeconds = (Date.now() - startTime) / 1000.0;
        displayMaterialUniforms.time.value = 60.0 * elapsedSeconds;
        computeUniforms.time.value = 60.0 * elapsedSeconds;

        //Set the display mesh to use the compute shader
        displayMesh.material = computeMaterial;

        // Render from the current RenderTarget into the other RenderTarget, then swap.
        // Repeat however many times per frame we desire.
        for (var i = 0; i < computeStepsPerFrame; i++) {

            var nextTargetIndex = currentTargetIndex === 0 ? 1 : 0;

            computeUniforms.sourceTexture.value = computeRenderTargets[currentTargetIndex].texture; //Put current target texture into material
            renderer.render(scene, camera, computeRenderTargets[nextTargetIndex], true); //Render the scene to next target
            computeUniforms.sourceTexture.value = computeRenderTargets[nextTargetIndex].texture; //Put next target texture into material
            displayMaterialUniforms.displayTexture.value = computeRenderTargets[nextTargetIndex].texture; //Assign to display material

            currentTargetIndex = nextTargetIndex;
        }

        //Set the display mesh to use the display material and render
        displayMesh.material = displayMaterial;
        renderer.render(scene, camera);
    }

    function clear() {
        computeUniforms.doPass.value = 0.0;
        doRenderPass(0);
        doRenderPass(0);
        computeUniforms.doPass.value = 1.0;
    }

    function reset() {
        initRenderTargetFromImage(computeRenderTargets[0], imageURL);
        initRenderTargetFromImage(computeRenderTargets[1], imageURL);
    }


    function initRenderTargetFromImage(renderTarget, url) {
        imageURL = url;
        var sizeX = renderTarget.width; // / internalResolutionMultiplier;
        var sizeY = renderTarget.height; // / internalResolutionMultiplier;

        //If no URL is supplied, draw some sample shapes
        if(url == null){
            //Make a data texture
            var buffer = new Float32Array( sizeX * sizeY * 4 );
            var texture = new THREE.DataTexture( buffer, sizeX, sizeY, THREE.RGBAFormat, THREE.FloatType );
            texture.needsUpdate = true;

            //Seed it with the variables we want
            seedInitial(texture);
            //seedCircle(texture, sizeX * 0.5, sizeY * 0.5, 200, 50);
            seedCircle(texture, sizeX * 0.5, sizeY * 0.5, Math.min(sizeX, sizeY) * 0.33, Math.min(sizeX, sizeY) * 0.125);

            //Add some bias in the center
            seedFilledCircle(texture, sizeX * 0.5, sizeY * 0.5, Math.min(sizeX, sizeY) * 0.25, 2);

            //Render it to the rendertarget
            //renderer.renderTexture( texture, renderTarget );
            passThroughUniforms.texture.value = texture;
            displayMesh.material = passThroughMaterial;
            renderer.render(scene, camera, renderTarget);

            var gl = renderer.context;
            var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
              return exit("Couldn't render into framebuffer (browser likely has no undocumented or explicit support for WEBGL_color_buffer_float)");
            }
            return true;
        }

        else{
            var loader = new THREE.TextureLoader();
            loader.load(url, function (texture) {
                //Run the rest of the program
                //Initialize the texture from the imported image
                passThroughUniforms.texture.value = texture;
                displayMesh.material = passThroughMaterial;
                renderer.render(scene, camera, renderTarget);
                return true;
            });
        }

    }

    function applyFunctionToRenderTarget(renderTarget, callback) {
        //Read renderTarget into a DataTexture
        var buffer = new Float32Array(renderTarget.width * renderTarget.height * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, renderTarget.width, renderTarget.height, buffer);
        var texture = new THREE.DataTexture(buffer, renderTarget.width, renderTarget.height, THREE.RGBAFormat, THREE.FloatType);
        texture.needsUpdate = true;

        //Run the callback with the DataTexture
        callback(texture);

        //Render DataTexture into renderTarget
        passThroughUniforms.texture.value = texture;

        //var oldMaterial = displayMesh.material;
        displayMesh.material = passThroughMaterial;
        renderer.render(scene, camera, renderTarget);
        //displayMesh.material = oldMaterial;
    }

    function getNextRenderTarget(){
        return computeRenderTargets[currentTargetIndex === 0 ? 1 : 0];
    }

    function seedInitial(texture) {
        var width = texture.image.width;
        var height = texture.image.height;
        var pixels = texture.image.data;
        var px = 0;
        for (var i = 0; i < texture.image.width; i++) {
            for (var j = 0; j < texture.image.height; j++) {
                pixels[px + 0] = 1.0; //1.0; //texture is float type (0 - 1)
                pixels[px + 1] = 0.0;
                //pixels[px + 2] = 0.0;
                pixels[px + 3] = 1.0;

                px += 4;
            }
        }

    }

    function seedSquare(texture, x, y, size) {
        size = typeof size === 'undefined' ? 100 : size;
        var pixels = texture.image.data;
        var width = texture.image.width;
        var height = texture.image.height;

        var px = 0;
        for (var j = 0; j < height; j++) {
            for (var i = 0; i < width; i++) {
                if (j > (height * 0.5) && i > (width * 0.5)) {
                    //pixels[ px + 0 ] = 1.0;//1.0; //texture is float type (0 - 1)
                    //pixels[ px + 1 ] = 1.0;
                    pixels[px + 1] = i / texture.image.width; //1.0; //texture is float type (0 - 1)
                    //pixels[ px + 2 ] = 0.0;
                    //pixels[ px + 3 ] = 1.0;
                }

                px += 4;
            }
        }
    }

    function seedCircle(texture, x, y, radius, thickness, channel, value) {
        thickness = typeof thickness === 'undefined' ? 1 : thickness;
        channel = typeof channel === 'undefined' ? 1 : channel;
        value = typeof value === 'undefined' ? 1.0 : value;
        var pixels = texture.image.data;
        var width = texture.image.width;
        var height = texture.image.height;

        for (var reps = 0; reps < thickness; reps++) {
            var currentRadius = radius - reps;
            var currentOpacity = value; //1.0 - (reps / thickness);

            seedRing(texture, x, y, currentRadius, channel, currentOpacity);

        }

    }

    function seedRing(texture, x, y, radius, channel, value) {
        channel = typeof channel === 'undefined' ? 1 : channel;
        value = typeof value === 'undefined' ? 1.0 : value;
        var width = texture.image.width;
        var height = texture.image.height;
        var pixels = texture.image.data;
        var resolution = 0.1; //Set to 1 for moire patterns
        var channelWidth = 4; //RGBA

        //Draw a circle
        for (var i = 0; i < 360; i += resolution) {
            var xOffset = radius * Math.cos(i * Math.PI / 180);
            var yOffset = radius * Math.sin(i * Math.PI / 180);
            var xCoord = Math.floor(x + xOffset);
            var yCoord = Math.floor(y + yOffset);

            var index = (xCoord + yCoord * width) * 4;
            if (index >= 0 && index < width * height * channelWidth) {
                pixels[index + channel] = value;
            }


        }

    }

    function seedFilledCircle(texture, x, y, radius, channel) {
        channel = typeof channel === 'undefined' ? 1 : channel;
        var pixels = texture.image.data;
        var r = radius;
        var row = x;
        var col = y;
        var channelWidth = 4; //RGBA
        for (var i = -r; i < r; i++) {
            for (var j = -r; j < r; j++) {
                if ((i * i + j * j) < (r * r)) {
                    var index = ((row + j) + (col + i) * texture.image.width) * 4;
                    pixels[index + channel] = 0.5;
                }
            }
        }
        //seedCircle(texture, x, y, radius, radius, channel);
    }

    // INPUT HANDLING ---------------------------------------------------- //

    function onMouseDown(event) {
        var rect = container.getBoundingClientRect();
        mousePos.set(event.clientX - rect.left,
            rect.bottom - event.clientY); //(event.clientY - rect.top) to invert
        mousePos.x *= internalResolutionMultiplier;
        mousePos.y *= internalResolutionMultiplier;
        mouseIsDown = true;

        //console.log("Clicked at (" + mousePos.x + ", " + mousePos.y + ")");

    }

    function onMouseUp(event) {
        //Put the interaction position offscreen.
        mousePos.set(-1000.0, -1000.0);
        mouseIsDown = false;
    }

    function onMouseOut(event) {
        //Put the interaction position offscreen.
        mousePos.set(-1000.0, -1000.0);
    }

    function onMouseMove(event) {
        //Only update if the mouse is held down
        if (mouseIsDown) {
            var rect = container.getBoundingClientRect();
            mousePos.set(event.clientX - rect.left,
                rect.bottom - event.clientY); //(event.clientY - rect.top) to invert
            mousePos.x *= internalResolutionMultiplier;
            mousePos.y *= internalResolutionMultiplier;
        }


    }

    function onTouchStart(event) {
        if(!mouseIsDown){
            var rect = container.getBoundingClientRect();
            var touches = event.changedTouches;
            mousePos.set(touches[0].clientX - rect.left,
                rect.bottom - touches[0].clientY); //(event.clientY - rect.top) to invert
            mousePos.x *= internalResolutionMultiplier;
            mousePos.y *= internalResolutionMultiplier;
            mouseIsDown = true;
        }
    }

    function onTouchOut(event) {
        mousePos.set(-1000.0, -1000.0);
    }

    function onTouchEnd(event) {
        var touches = event.changedTouches;
        mouseIsDown = false;
        mousePos.set(-1000.0, -1000.0);

    }

    function onTouchMove(event){
        event.preventDefault();
        if(mouseIsDown){
            var rect = container.getBoundingClientRect();
            var touches = event.changedTouches;
            if(touches.length > 0){
                mousePos.set(touches[0].clientX - rect.left,
                    rect.bottom - touches[0].clientY); //(event.clientY - rect.top) to invert
                mousePos.x *= internalResolutionMultiplier;
                mousePos.y *= internalResolutionMultiplier;
            }
        }
    }

    // LOAD  STUFF ------------------------------------------------------- //
    // http://stackoverflow.com/questions/4878145/javascript-and-webgl-external-scripts
    function loadShader(type, shaderSrc) {
        var shader = gl.createShader(type);
        // Load the shader source
        gl.shaderSource(shader, shaderSrc);
        // Compile the shader
        gl.compileShader(shader);
        // Check the compile status
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) &&
            !gl.isContextLost()) {
            var infoLog = gl.getShaderInfoLog(shader);
            console.log("Error compiling shader:\n" + infoLog);
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function loadFile(url, data, callback, errorCallback) {
        // Set up an asynchronous request
        var request = new XMLHttpRequest();
        request.open("GET", url, true);

        // Hook the event that gets called as the request progresses
        request.onreadystatechange = function () {
            // If the request is "DONE" (completed or failed)
            if (request.readyState == 4) {
                // If we got HTTP status 200 (OK)
                if (request.status == 200) {
                    callback(request.responseText, data)
                } else { // Failed
                    errorCallback(url);
                }
            }
        };

        request.send(null);
    }

    function loadFiles(urls, callback, errorCallback) {
        var numUrls = urls.length;
        var numComplete = 0;
        var result = [];

        // Callback for a single file
        function partialCallback(text, urlIndex) {
            result[urlIndex] = text;
            numComplete++;

            // When all files have downloaded
            if (numComplete == numUrls) {
                callback(result);
            }
        }

        for (var i = 0; i < numUrls; i++) {
            loadFile(urls[i], i, partialCallback, errorCallback);
        }
    }


    // UTILITY FUNCTIONS -------------------------------------------- //
    function getPassThroughVertexShader() {
        return ["varying vec2 v_uv;",
                "void main() {",
                "   v_uv = uv;",
                "   gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);",
                "}"
               ].join("\n");

    }

    function getPassThroughFragmentShader() {
        return ["varying vec2 v_uv;",
                "uniform sampler2D texture;",
                "void main() {",
                " vec2 uv = v_uv;",
                "	gl_FragColor = texture2D( texture, uv );",
                "}"
                ].join("\n");

    }

    //http://stackoverflow.com/questions/11871077/proper-way-to-detect-webgl-support
    function webgl_detect() {
        if (!!window.WebGLRenderingContext) {
            var canvas = document.createElement("canvas"),
                 names = ["webgl", "experimental-webgl", "moz-webgl", "webkit-3d"],
               context = false;

            for(var i=0;i<4;i++) {
                try {
                    context = canvas.getContext(names[i]);
                    if (context && typeof context.getParameter == "function") {
                        // WebGL is enabled
                        return true;
                    }
                } catch(e) {}
            }

            // WebGL is supported, but disabled
            return false;
        }
        // WebGL not supported
        return false;
    }

    function isInitialized(){
        return $container.hasClass("rd-loaded");
    }

    function mobileAndTabletCheck() {
      var check = false;
      (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
      return check;
    };

    //https://bocoup.com/weblog/find-the-closest-power-of-2-with-javascript
    function nearestPow2(n) {
//      var m = n;
//      for(var i = 0; m > 1; i++) {
//        m = m >>> 1;
//      }
//      // Round to nearest power
//      if (n & 1 << i-1) { i++; }
//      return 1 << i;
        return n;
    }

}
