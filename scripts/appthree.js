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

var sampleRateElm = document.getElementById("sampleRate");


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

// three.js

var div = document.getElementById('three');

WIDTH = 800;
HEIGHT = 400;
var renderer = new THREE.WebGLRenderer();
renderer.setSize(WIDTH, HEIGHT);
div.appendChild(renderer.domElement);
var camera = new THREE.PerspectiveCamera(15, WIDTH / HEIGHT, 1, 2000);
camera.position.z = 1000;
camera.position.y = HEIGHT/2+1000;
camera.position.x = WIDTH/2;
camera.rotation.x = - Math.PI/4;
var material = new THREE.LineBasicMaterial({
  color: 0xffffff
});

var scene;

// max frequency of interest
MAX_FREQ = 15000;

// distance between each frame
ZSTEP = -2;

function visualize() {
  analyser.fftSize = Number(fftSizeSelect.value);
  var NARRAY = Number(nlinesSelect.value);
  var bufferLength = analyser.frequencyBinCount;
  console.log(bufferLength);
  
  var dataArray = new Uint8Array(bufferLength);  

  var objectArray = new Array(NARRAY);
  
  var arrayIdx = 0;
  scene = new THREE.Scene();

  var oldMaterials = new Array(NARRAY);
  for(var i = 0; i < NARRAY; i++) {
    var addColor = Math.floor(256 * (i/NARRAY));
    if (i % 2 == 0) addColor = Math.floor(256 * 256 * 256 * ((NARRAY-i)/NARRAY));
    var c = 256 * 125 + addColor;
    oldMaterials[i] = new THREE.LineBasicMaterial({
      color: c
    });
  }

  function draw() {
    drawVisual = requestAnimationFrame(draw);

    {
      var oldObj = objectArray[(arrayIdx + 1)%NARRAY];
      if (oldObj) {
	scene.remove(oldObj);
	oldObj.geometry.dispose();
	delete(oldObj);
      }
      scene.traverse(function(obj) {
	if(scene.id != obj.id) {
	  obj.translateZ(ZSTEP);
	}
      });
      var prevObj = objectArray[(arrayIdx + NARRAY -1) % NARRAY];
      if (prevObj) {
	prevObj.material = oldMaterials[arrayIdx];
      }
    }
    
    analyser.getByteFrequencyData(dataArray);

    var barHeight;
    var maxDrawFreq = MAX_FREQ / (source.context.sampleRate / analyser.fftSize);
    maxDrawFreq = Math.min(maxDrawFreq, bufferLength);
    var barWidth = (WIDTH / maxDrawFreq) * 1;

    {
      var x = 0;

      var geometry = new THREE.Geometry();

      // lx closeness check
      var preLx = -100;
      var maxLy = 0;
      var cnt = 0;
      
      for(var i = 0; i < maxDrawFreq; i++) {
        barHeight = dataArray[i];
	
        var y = barHeight;

	var lx = x;
	var ly = y;

	// 6.8 =~ Math.log(WIDTH)
	lx = Math.log(1+x) * WIDTH / 6.8
        // ly = Math.log(1+barHeight) * 35;

	// skip close log(1+x) positions, pick max y
	if (lx - preLx >= 1.0) {
	  geometry.vertices.push(
	    new THREE.Vector3(lx, Math.max(maxLy,ly), 0)
	  );
	  
	  preLx = lx;
	  cnt = 0;
	  maxLy = 0;
	} else {
	  cnt++;
	  maxLy = Math.max(maxLy, ly);
	}
	
        x += barWidth;
      }
      var line = new THREE.Line(geometry, material);
      objectArray[arrayIdx] = line;
      scene.add(line);
    }

    // console.log('render');
    renderer.render(scene, camera);
    
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

// })();
