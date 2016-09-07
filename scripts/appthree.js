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

//set up the different audio nodes we will use for the app

var analyser = audioCtx.createAnalyser();
analyser.minDecibels = -90;
analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.0;
  

var fftSizeSelect = document.getElementById("fftsize");
var nlinesSelect = document.getElementById("nlines");

var sampleRateElm = document.getElementById("sampleRate");

var drawVisual;

//main block for doing the audio recording

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

var scene = new THREE.Scene();


function visualize() {

  // var visualSetting = visualSelect.value;
  // console.log(visualSetting);

  analyser.fftSize = Number(fftSizeSelect.value);
  var NARRAY = Number(nlinesSelect.value);
  // var NARRAY = 100;
  var bufferLength = analyser.frequencyBinCount;
  console.log(bufferLength);
  var dataArray = new Uint8Array(bufferLength);
  
  var arrayIdx = 0;

  var lines = new Array(NARRAY);

  // scene.traverse(function(obj) {
  //   if(scene.id != obj.id) scene.remove(obj);
  // });
  var oldMaterials = new Array(NARRAY);
  for(var i = 0; i < NARRAY; i++) {
    var addColor = Math.floor(256 * (i/NARRAY));
    if (i % 2 == 0) addColor = Math.floor(256 * 256 * 256 * (i/NARRAY));
    var c = 256 * 125 + addColor;
    oldMaterials[i] = new THREE.LineBasicMaterial({
      color: c
    });
  }

  function draw() {
    drawVisual = requestAnimationFrame(draw);

    var oldLine = lines[(arrayIdx + 1)%NARRAY];
    if (oldLine) {
      scene.remove(oldLine);
      oldLine.geometry.dispose();
      delete(oldLine);
    }
    scene.traverse(function(obj) {
      if(scene.id != obj.id) {
	obj.translateZ(-2);
      }
    });
    var prevLine = lines[(arrayIdx + NARRAY -1)%NARRAY];
    if (prevLine) {
      prevLine.material = oldMaterials[arrayIdx];
    }
    
    analyser.getByteFrequencyData(dataArray);

    var barHeight;
    var maxDrawFreq = 15000 / (source.context.sampleRate / analyser.fftSize);
    maxDrawFreq = Math.min(maxDrawFreq, bufferLength);
    var barWidth = (WIDTH / maxDrawFreq) * 1;

    {

      var x = 0;
      var color = 250;
      var lineWidth = 3;
      // console.log(color)

      var geometry = new THREE.Geometry();
      
      var preLx = -100;
      var maxLy = 0;
      var cnt = 0;
      
      for(var i = 0; i < maxDrawFreq; i++) {
        barHeight = dataArray[i];
	
        var y = barHeight;

	var lx = x;
	var ly = y;

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
      
      lines[arrayIdx] = line;
      scene.add(line);
    }

    // console.log('render');
    renderer.render(scene, camera);
    
    arrayIdx = (arrayIdx + 1) % NARRAY
  };

  draw();

}

// event listeners to change visualize and voice settings

// visualSelect.onchange = 

fftSizeSelect.onchange = function() {
  window.cancelAnimationFrame(drawVisual);
  visualize();
}

nlinesSelect.onchange = fftSizeSelect.onchange;

// })();
