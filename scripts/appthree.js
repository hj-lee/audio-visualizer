// fork getUserMedia for multiple browser versions, for those
// that need prefixes

// (function () {
  
navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

// set up forked web audio context, for multiple browsers
// window. is needed otherwise Safari explodes

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();


var source;
var stream;

console.log(audioCtx.sampleRate)

// set up the analyser node

var analyser = audioCtx.createAnalyser();
analyser.minDecibels = -90;
analyser.maxDecibels = -10;

analyser.smoothingTimeConstant = 0.0;

// select elements

var fftSizeSelect = document.getElementById("fftsize");
var nlinesSelect = document.getElementById("nlines");
var styleSelect = document.getElementById("style");
var smoothingSelect = document.getElementById("smoothing");

// span elements

var sampleRateElm = document.getElementById("sampleRate");
var frameLengthElm = document.getElementById("frameLength");

//

var drawVisual;

// connect audio to analyser

if (navigator.getUserMedia) {
   console.log('getUserMedia supported.');
   navigator.getUserMedia (
      // constraints - only audio needed for this app
      {
         audio: true
      },

      // Success callback
      function(stream) {
        source = audioCtx.createMediaStreamSource(stream);
        console.log('success callback - ' + source.context.sampleRate);

	sampleRateElm.innerText = source.context.sampleRate;
	
         source.connect(analyser);

      	 visualize();
      },

      // Error callback
      function(err) {
         console.log('The following gUM error occured: ' + err);
      }
   );
} else {
   console.log('getUserMedia not supported on your browser!');
}

/////////////////////////////////////
// three.js

WIDTH = 800;
HEIGHT = 400;

// max frequency of interest
MAX_FREQ = 15000;

// distance between each frame
ZSTEP = -2;


// renderer

var renderer = new THREE.WebGLRenderer();
renderer.setSize(WIDTH, HEIGHT);
document.getElementById('three').appendChild(renderer.domElement);

// camera

var camera = new THREE.PerspectiveCamera(15, WIDTH / HEIGHT, 1, WIDTH * 3);

DISTANCE_FACTOR = 2.1


var angleX = Math.PI/4;
var angleY = 0;

function setCameraAngle(angleX, angleY) {
  camera.position.x = WIDTH/2 + WIDTH * DISTANCE_FACTOR * Math.sin(angleY);
  camera.position.y = HEIGHT/3 + WIDTH * DISTANCE_FACTOR * Math.sin(angleX) * Math.cos(angleY);
  camera.position.z = ZSTEP*75 + WIDTH * DISTANCE_FACTOR * Math.cos(angleX) * Math.cos(angleY);


  camera.rotation.x = - angleX;
  camera.rotation.y = angleY;
}  

setCameraAngle(angleX, angleY);

ANGLE_STEP = Math.PI / 60;

MIN_ANGLE_X = 0;
MAX_ANGLE_X = Math.PI/2;
MIN_ANGLE_Y = -Math.PI/2;
MAX_ANGLE_Y = Math.PI/2;


document.addEventListener('keydown', function(event) {
  var code = event.code;
  if (code == 'KeyW') {
    angleX += ANGLE_STEP;
    if (angleX > MAX_ANGLE_X) angleX = MAX_ANGLE_X;
    setCameraAngle(angleX, angleY);
  }
  else if (code == 'KeyS') {
    angleX -= ANGLE_STEP;
    if (angleX < MIN_ANGLE_X) angleX = MIN_ANGLE_X;
    setCameraAngle(angleX, angleY);
  }
  else if (code == 'KeyA') {
    angleY -= ANGLE_STEP;
    if (angleY < MIN_ANGLE_Y) angleY = MIN_ANGLE_Y;
    setCameraAngle(angleX, angleY);
  }
  else if (code == 'KeyD') {
    angleY += ANGLE_STEP;
    if (angleY > MAX_ANGLE_Y) angleY = MAX_ANGLE_Y;
    setCameraAngle(angleX, angleY);
  }
});


// scene draw

var scene;


var drawStyleFunctions = {}
drawStyleFunctions["line"] = {}
drawStyleFunctions["frontmesh"] = {}
drawStyleFunctions["upmesh"] = {}
drawStyleFunctions["off"] = {}

drawStyleFunctions["line"].makeMaterial = function(color) {
  return new THREE.LineBasicMaterial({
    color: color
  });  
};
drawStyleFunctions["frontmesh"].makeMaterial = function(color) {
  return new THREE.MeshBasicMaterial({
    color: color
  });  
};
drawStyleFunctions["upmesh"].makeMaterial =
  drawStyleFunctions["frontmesh"].makeMaterial;


drawStyleFunctions["line"].makeObject =
  function(prevVectorArry, vectorArray, material)
{
  var geometry = new THREE.Geometry();
  geometry.vertices = vectorArray;
  return new THREE.Line(geometry, material);
}

drawStyleFunctions["frontmesh"].makeObject =
  function(prevVectorArry, vectorArray, material)
{
  var geometry = new THREE.Geometry();
  for(var i = 0; i < vectorArray.length; i++) {
    var vertex = vectorArray[i];
    geometry.vertices.push(
      new THREE.Vector3(vertex.x, 0, 0)
    );
    vertex.y += 2;
    geometry.vertices.push(vertex);
    if (i>0) {
      geometry.faces.push(
	new THREE.Face3(i*2, i*2-1, i*2-2)
      );
      geometry.faces.push(
	new THREE.Face3(i*2+1, i*2-1, i*2)
      );
    }
  }
  return new THREE.Mesh(geometry, material);
}

drawStyleFunctions["upmesh"].makeObject =
  function(prevVectorArry, vectorArray, material)
{
  if (prevVectorArry) {
    var geometry = new THREE.Geometry();
    for(var i = 0; i < vectorArray.length; i++) {
      prevVectorArry[i].z = ZSTEP;
      geometry.vertices.push(vectorArray[i]);
      geometry.vertices.push(prevVectorArry[i]);
      if (i>0) {
      geometry.faces.push(
	new THREE.Face3(i*2, i*2-1, i*2-2)
      );
      geometry.faces.push(
	new THREE.Face3(i*2+1, i*2-1, i*2)
      );
      }
    }
    return new THREE.Mesh(geometry, material);
  }
}



function visualize() {
  analyser.fftSize = Number(fftSizeSelect.value);  
  var NARRAY = Number(nlinesSelect.value);
  var bufferLength = analyser.frequencyBinCount;
  console.log(bufferLength);
  var drawStyle = styleSelect.value;

  // stop rendering
  if (drawStyle == "off") return;
  
  var frameLength = analyser.fftSize / audioCtx.sampleRate;
  frameLengthElm.innerText = frameLength;

  
  var dataArray = new Uint8Array(bufferLength);  

  var objectArray = new Array(NARRAY);
  
  scene = new THREE.Scene();

  var material;
  material = drawStyleFunctions[drawStyle].makeMaterial(0xffffff);

  var oldMaterials = new Array(NARRAY);
  for(var i = 0; i < NARRAY; i++) {
    var addColor = Math.floor(256 * (i/NARRAY));
    if (i % 2 == 0)
      addColor = Math.floor(256 * 256 * 256 * ((NARRAY-i)/NARRAY));
    var c = 256 * 125 + addColor;
    oldMaterials[i] = drawStyleFunctions[drawStyle].makeMaterial(c);
  }

  // draw() sets
  var arrayIdx = 0;
  var prevVectorArry;

  function draw() {
    drawVisual = requestAnimationFrame(draw);

    {
      // remove old object
      var oldObj = objectArray[(arrayIdx + 1)%NARRAY];
      if (oldObj) {
	scene.remove(oldObj);
	oldObj.geometry.dispose();
	delete(oldObj);
      }
      // move objects backward
      scene.traverse(function(obj) {
	if(scene.id != obj.id) {
	  obj.translateZ(ZSTEP);
	}
      });
      // change last object material
      var prevObj = objectArray[(arrayIdx + NARRAY -1) % NARRAY];
      if (prevObj) {
	prevObj.material = oldMaterials[arrayIdx];
      }
    }
    
    analyser.getByteFrequencyData(dataArray);

    var maxDrawFreq = MAX_FREQ / (source.context.sampleRate / analyser.fftSize);
    maxDrawFreq = Math.min(maxDrawFreq, bufferLength);
    var unitWidth = (WIDTH / maxDrawFreq);
    
    var vectorArray = new Array();

    {
      var x = 0;

      // var geometry = new THREE.Geometry();
      
      // lx closeness check
      var preLx = -100;
      var maxLy = 0;
      var cnt = 0;
      
      for(var i = 0; i < maxDrawFreq; i++) {
        var y = dataArray[i];

	var lx = x;
	var ly = y;

	// 6.8 =~ Math.log(WIDTH)
	lx = Math.log(1+x) * WIDTH / 6.8
        // ly = Math.log(1+barHeight) * 35;

	// skip close log(1+x) positions, pick max y
	if (lx - preLx >= 1.0) {
	  vectorArray.push(
	    new THREE.Vector3(lx, Math.max(maxLy,ly), 0)
	  );
	  
	  preLx = lx;
	  cnt = 0;
	  maxLy = 0;
	} else {
	  cnt++;
	  maxLy = Math.max(maxLy, ly);
	}
	
        x += unitWidth;
      }
      var obj = drawStyleFunctions[drawStyle].makeObject(
	prevVectorArry,
	vectorArray,
	material
      );
      if (obj) {
	objectArray[arrayIdx] = obj;
	scene.add(obj);
      }
    }
    // console.log('render');
    renderer.render(scene, camera);

    prevVectorArry = vectorArray;
    arrayIdx = (arrayIdx + 1) % NARRAY
  };

  draw();

}

// event listeners to change settings

function onchangeFunction() {
  window.cancelAnimationFrame(drawVisual);

  if (scene) {
    var objs = new Array();
    scene.traverse(function(obj) {
      if(obj.id != scene.id) objs.push(obj);
    });
    var obj;
    for(obj in objs) {
      scene.remove(obj);
      if (obj && obj.geometry) obj.geometry.dispose();
      delete(obj);
    }
    scene = undefined;
    objs = undefined;
  }
  
  visualize();
}

fftSizeSelect.onchange = onchangeFunction;
  
nlinesSelect.onchange = onchangeFunction;

styleSelect.onchange = onchangeFunction;

smoothingSelect.onchange = function(e) {
  var smoothing = Number(smoothingSelect.value);
  analyser.smoothingTimeConstant = smoothing;
}

// })();
