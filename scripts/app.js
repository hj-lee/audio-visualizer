// fork getUserMedia for multiple browser versions, for those
// that need prefixes

navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

// set up forked web audio context, for multiple browsers
// window. is needed otherwise Safari explodes

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var voiceSelect = document.getElementById("voice");
var source;
var stream;

console.log(audioCtx.sampleRate)

//set up the different audio nodes we will use for the app

var analyser = audioCtx.createAnalyser();
analyser.minDecibels = -90;
analyser.maxDecibels = -10;
analyser.smoothingTimeConstant = 0.0;

// set up canvas context for visualizer

var canvas = document.querySelector('.visualizer');
var canvasCtx = canvas.getContext("2d");

var intendedWidth = document.querySelector('.wrapper').clientWidth;

canvas.setAttribute('width',intendedWidth);

var visualSelect = document.getElementById("visual");

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

function visualize() {
  WIDTH = canvas.width;
  HEIGHT = canvas.height;

  var visualSetting = visualSelect.value;
  console.log(visualSetting);

  if(visualSetting == "sinewave") {
    analyser.fftSize = 2048;
    var NARRAY = 10
    var bufferLength = analyser.fftSize;
    console.log(bufferLength);
    var dataArrayArray = new Array(NARRAY)
    for(var i = 0; i < NARRAY; i++) {
      dataArrayArray[i] = new Uint8Array(bufferLength)
    }
    console.log(bufferLength);
    // var dataArray = new Uint8Array(bufferLength);

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    var background = 'rgb(0, 200, 200)'
    
    canvasCtx.fillStyle = background;
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    
    var arrayIdx = 0;
    
    function draw() {

      drawVisual = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArrayArray[arrayIdx]);

      if (NARRAY == 1) {
        canvasCtx.fillStyle = background;
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      
      // canvasCtx.lineWidth = 1;
      // canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

      var sliceWidth = WIDTH * 1.0 / bufferLength;
     
      
      function drawSub(idx) {
        canvasCtx.beginPath();
        var x = 0;
        for(var i = 0; i < bufferLength; i++) {
   
          var v = dataArrayArray[idx][i] / 128.0;
          var y = v * HEIGHT/2;

          if(i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        // canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
      };

      if (NARRAY > 1) {
        canvasCtx.lineWidth = 3;
        canvasCtx.strokeStyle = background;
        drawSub((arrayIdx+1)%NARRAY);
      }
      if (NARRAY > 2) {
        canvasCtx.lineWidth = 1;
        canvasCtx.strokeStyle = 'rgb(0, 250, 0)';
        drawSub((arrayIdx + NARRAY - 1)%NARRAY);
      }

      canvasCtx.lineWidth = 1;
      canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
      drawSub(arrayIdx);
      
      arrayIdx = (arrayIdx+1) % NARRAY
    }

    draw();

  } else if(visualSetting == "frequencybars") {
    analyser.fftSize = 4096;
    var NARRAY = 5
    var bufferLength = analyser.frequencyBinCount;
    console.log(bufferLength);
    var dataArrayArray = new Array(NARRAY)
    for(var i = 0; i < NARRAY; i++) {
      dataArrayArray[i] = new Uint8Array(bufferLength)
    }

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    var arrayIdx = 0;
    
    function draw() {
      drawVisual = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArrayArray[arrayIdx]);

      canvasCtx.fillStyle = 'rgb(0, 0, 0)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      var barWidth = (WIDTH / bufferLength) * 2.5;
      var barHeight;

      for(var dataIdx = 1; dataIdx <= NARRAY ; dataIdx++) {
        var idx = (arrayIdx + dataIdx) % NARRAY

        var x = 0;
        canvasCtx.beginPath();
        var color = 250;
        if (dataIdx < NARRAY) {
          color = (125/NARRAY) * dataIdx;
        }
        canvasCtx.fillStyle = 'rgb(' + color + ',' + 125 + ',' + 125 + ')';
        for(var i = 0; i < bufferLength; i++) {
          barHeight = dataArrayArray[idx][i];

          canvasCtx.fillRect(x,HEIGHT-barHeight,barWidth,1+dataIdx*5/NARRAY);

          x += barWidth + 1;
        }
      }
      arrayIdx = (arrayIdx + 1) % NARRAY
    };

    draw();

  } else if(visualSetting == "off") {
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    canvasCtx.fillStyle = "green";
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
  }

}

// event listeners to change visualize and voice settings

visualSelect.onchange = function() {
  window.cancelAnimationFrame(drawVisual);
  visualize();
}

