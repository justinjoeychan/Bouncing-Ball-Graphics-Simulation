/**
 * Justin Joey Chan.
 */

var gl;
var canvas;
var shaderProgram;
var vertexPositionBuffer;

var days=0;


// Create a place to store sphere geometry
var sphereVertexPositionBuffer;

//Create a place to store normals for shading
var sphereVertexNormalBuffer;

// View parameters
var eyePt = vec3.fromValues(0.0,-1.0,100.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);

// Create the normal
var nMatrix = mat3.create();

// Create ModelView matrix
var mvMatrix = mat4.create();

//Create Projection matrix
var pMatrix = mat4.create();

var mvMatrixStack = [];

// Vector used in matrix transformations.
var transformVec = vec3.create();

// Currently Pressed key map
var currentlyPressedKeys = {};

// The number of ticks from program start.
var time = 0;

// Number of particles.
var sphereNum = 0;

// Lists used to store particle information
var pos = [];
var vel = [];
var birth = []; 

// Force values.
var gravity = vec3.fromValues(0, -0.0059, 0);
var friction = 0.99999;

//-----------------------------------------------------------------
//Color conversion  helper functions
function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16)}
function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16)}
function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16)}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}


//-------------------------------------------------------------------------
/**
 * Populates buffers with data for spheres
 */
function setupSphereBuffers() {
    
    var sphereSoup=[];
    var sphereNormals=[];
    var numT=sphereFromSubdivision(6,sphereSoup,sphereNormals);
    console.log("Generated ", numT, " triangles"); 
    //console.log(sphereSoup);
    console.log("Generated ", sphereNormals.length/3, " normals"); 
    //console.log(sphereNormals);
    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);      
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereSoup), gl.STATIC_DRAW);
    sphereVertexPositionBuffer.itemSize = 3;
    sphereVertexPositionBuffer.numItems = numT*3;
    console.log(sphereSoup.length/9);
    
    // Specify normals to be able to do lighting calculations
    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals),
                  gl.STATIC_DRAW);
    sphereVertexNormalBuffer.itemSize = 3;
    sphereVertexNormalBuffer.numItems = numT*3;
    
    console.log("Normals ", sphereNormals.length/3);     
}

//-------------------------------------------------------------------------
/**
 * Draws a sphere from the sphere buffer
 */
function drawSphere() {
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize, 
                         gl.FLOAT, false, 0, 0);

 // Bind normal buffer
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
                           sphereVertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);
 gl.drawArrays(gl.TRIANGLES, 0, sphereVertexPositionBuffer.numItems);      
}

//-------------------------------------------------------------------------
/**
 * Draws a single particle'
 * @param {int} i The index of the particle to be drawn.
 */
function drawParticle(i) {
    vec3.copy(transformVec, pos[i]);
    mat4.translate(mvMatrix, mvMatrix, transformVec);
    
    var scale = 0.1;
    vec3.set(transformVec, scale, scale, scale);
    mat4.scale(mvMatrix, mvMatrix, transformVec);
    
    setMatrixUniforms();
    drawSphere();
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
  
  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader;
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupShaders(vshader,fshader) {
  vertexShader = loadShaderFromDOM(vshader);
  fragmentShader = loadShaderFromDOM(fshader);
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformDiffuseMaterialColor = gl.getUniformLocation(shaderProgram, "uDiffuseMaterialColor");
  shaderProgram.uniformAmbientMaterialColor = gl.getUniformLocation(shaderProgram, "uAmbientMaterialColor");
  shaderProgram.uniformSpecularMaterialColor = gl.getUniformLocation(shaderProgram, "uSpecularMaterialColor");

  shaderProgram.uniformShininess = gl.getUniformLocation(shaderProgram, "uShininess");    
}


//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32Array} a diffuse material color
 * @param {Float32Array} a ambient material color
 * @param {Float32Array} a specular material color 
 * @param {Float32} the shininess exponent for Phong illumination
 */
function uploadMaterialToShader(dcolor, acolor, scolor,shiny) {
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColor, dcolor);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColor, acolor);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColor, scolor);
    
  gl.uniform1f(shaderProgram.uniformShininess, shiny);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function uploadLightsToShader(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s); 
}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupBuffers() {
    setupSphereBuffers();     
}

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() { 
    var light_on = [1.0,1.0,1.0];
    var light_off = [0.0,0.0,0.0];
    var aLight;
    var dLight;
    var sLight;
    var lightPos=[20,20,20];
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    mat4.perspective(pMatrix,degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);

    // We want to look down -z, so create a lookat point in that direction    
    vec3.add(viewPt, eyePt, viewDir);
    // Then generate the lookat matrix and initialize the MV matrix to that view
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);    
 
    mvPushMatrix();
    vec3.set(transformVec,20,20,20);
    mat4.scale(mvMatrix, mvMatrix,transformVec);
    
    //Get material color
    R = 244.0/255.0;
    G = 188.0/255.0;
    B = 66.0/255.0;
    
    //Get shiny
    var shiny = 100;
    // Get light position
    lightPos[0] = 20;
    lightPos[1] = 20;
    lightPos[2] = 20;

    //Go!
    
    uploadLightsToShader(lightPos,light_off,light_on,light_on);
    uploadMaterialToShader([R,G,B],[R,G,B],[1.0,1.0,1.0],shiny);
    
    // Draw each particle
    for (var i = 0; i < sphereNum; i++) {
        mvPushMatrix();
        drawParticle(i);
        mvPopMatrix();
    }
    
    mvPopMatrix();
}

/**
 * Reflects a vector based on the normal of the surface the vector is reflected from.
 * @param {vec3} a The vector to be reflected
 * @param {vec3} b The surface normal
 */
function reflectVec(a, b) {
    var reflected = vec3.create();
        
    vec3.scale(reflected, b, vec3.dot(b, a));
    vec3.scale(reflected, reflected, 2);
    vec3.sub(a, a, reflected);
}

/**
 * Updates the position of velocity of each particle.
 */
function update() {
    for (var i = 0; i < sphereNum; i++) {
        // Update velocity using drag and gravity
        var elapsed = time - birth[i];
        vec3.scale(vel[i], vel[i], Math.pow(friction, elapsed))
        vec3.add(vel[i], vel[i], gravity);

        // Update position vector using velocity
        vec3.add(pos[i], pos[i], vel[i]);

        // x-axis wall collisions
        if (pos[i][0] > 1.2) {
            var posXNorm = vec3.fromValues(-1, 0, 0);
            reflectVec(vel[i], posXNorm);
            pos[i][0] = 1.2;
        }
        else if (pos[i][0] < -1.2) {
            var negXNorm = vec3.fromValues(1, 0, 0);
            reflectVec(vel[i], negXNorm);
            pos[i][0] = -1.2;
        }

        // y-axis wall collisions
        if (pos[i][1] > 1.2) {
            var posYNorm = vec3.fromValues(0, -1, 0);
            reflectVec(vel[i], posYNorm);
            pos[i][1] = 1.2;
        }
        else if (pos[i][1] < -1.2) {
            var negYNorm = vec3.fromValues(0, 1, 0);
            reflectVec(vel[i], negYNorm);
            pos[i][1] = -1.2;
        }
    
        // z-axis wall collisions
        if (pos[i][2] > 1.2) {
            var posZNorm = vec3.fromValues(0, 0, -1);
            reflectVec(vel[i], posZNorm);
            pos[i][2] = 1.2;
        }
        else if (pos[i][2] < -1.2) {
            var negZNorm = vec3.fromValues(0, 0, 1);
            reflectVec(vel[i], negZNorm);
            pos[i][2] = -1.2;
        }
    }
    
    // Increment time
    time += 1;
}

/**
 * Adds a single sphere.
 */
function addSphere() {
    sphereNum += 1;
    
    // Generate random position of particle
    var x = Math.random() * 2.4 - 1.2;
    var y = Math.random() * 2.4 - 1.2;
    var z = Math.random() * 2.4 - 1.2;
    
    pos.push(vec3.fromValues(x, y, z));
    
    // Generate random velocity of particle
    x = Math.random() * 0.1 + 0.05;
    y = Math.random() * 0.1 + 0.05;
    z = Math.random() * 0.1 + 0.05;
    
    vel.push(vec3.fromValues(x, y, z));
    
    // Keep track of where this sphere was created
    birth.push(time);
}

/**
 * Adds n number of particles
 * @param {int} n Number of spheres to be added
 */
function addSpheres(n) {
    var numToAdd = n;
    
    if ((sphereNum + numToAdd) > 400) {
        numToAdd = 400 - sphereNum;
    }
    
    for (var i = 0; i < numToAdd; i++) {
        addSphere();
    }
    
    document.getElementById("sphereNum").value = sphereNum;
}

/**
 * Empty the lists containing particle information and set number of spheres to 0.
 */
function sphereReset() {
    sphereNum = 0;
    pos = [];
    vel = [];
    birth = [];

    document.getElementById("sphereNum").value = sphereNum;
}

//----------------------------------------------------------------------------------
/**
 * Animation to be called from tick. Updates globals and performs animation for each tick.
 */
function setGouraudShader() {
    console.log("Setting Gouraud Shader");
    setupShaders("shader-gouraud-phong-vs","shader-gouraud-phong-fs");
}

//----------------------------------------------------------------------------------
// Code to handle user interaction
function handleKeyDown(event) {
    currentlyPressedKeys[event.key] = true;
    if (currentlyPressedKeys["n"]) {
        // key N, add new spheres
        var n = parseInt(document.getElementById("numSphere").value);
        addSpheres(n);
    }
    if (currentlyPressedKeys["r"]) {
        // key R, reset sphere count to 0
        sphereReset();
    }
}

function handleKeyUp(event) {
    currentlyPressedKeys[event.key] = false;
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders("shader-gouraud-phong-vs","shader-gouraud-phong-fs");
  setupBuffers();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  tick();
}

//----------------------------------------------------------------------------------
/**
 * Tick called for every animation frame.
 */
function tick() {
    requestAnimFrame(tick);
    update();
    draw();
}

