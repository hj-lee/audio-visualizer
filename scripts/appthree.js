// (function () {

// fork getUserMedia for multiple browser versions, for those
// that need prefixes

navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);


////////////////////////////////////////////////


////////////////////////////////////////////////
// The 'app' object

var app = {};

app.connected =  function(stream) {
    // set up forked web audio context, for multiple browsers
    // window. is needed otherwise Safari explodes
    
    var audioCtx = new (window.AudioContext ||
			window.webkitAudioContext)();
    this.audioCtx = audioCtx;
    
    var source = audioCtx.createMediaStreamSource(stream);

    // analyser
    var analyser = audioCtx.createAnalyser();
    this.analyser = analyser;
    
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.0;
    source.connect(analyser);
}

app.prepare = function() {
    var self = this;
    // select elements

    var fftSizeSelect = document.getElementById("fftsize");
    this.fftSizeSelect = fftSizeSelect;
    var nlinesSelect = document.getElementById("nlines");
    this.nlinesSelect = nlinesSelect;
    var styleSelect = document.getElementById("style");
    this.styleSelect = styleSelect;
    var smoothingSelect = document.getElementById("smoothing");

    // span elements

    var sampleRateElm = document.getElementById("sampleRate");
    var frameLengthElm = document.getElementById("frameLength");
    this.frameLengthElm = frameLengthElm;

    //

    // var drawVisual;

    /////////////////////////////////////
    // three.js

    var WIDTH = 800;
    this.width = WIDTH;
    
    var HEIGHT = 400;
    this.height = HEIGHT;

    // max frequency of interest
    this.MAX_FREQ = 15000;

    // distance between each frame
    var ZSTEP = -2;
    this.ZSTEP = ZSTEP;

    // renderer

    var renderer = new THREE.WebGLRenderer();
    this.renderer = renderer;
    
    renderer.setSize(WIDTH, HEIGHT);
    document.getElementById('three').appendChild(renderer.domElement);

    // camera

    var camera = new THREE.PerspectiveCamera(15, WIDTH / HEIGHT, 1, WIDTH * 3);
    this.camera = camera;

    DISTANCE_FACTOR = 2.1


    var angleX = Math.PI/6;
    var angleY = 0;

    function setCameraAngle(angleX, angleY) {
	camera.position.x = WIDTH/2 + WIDTH * DISTANCE_FACTOR * Math.sin(angleY);
	camera.position.y = HEIGHT/3 + WIDTH * DISTANCE_FACTOR * Math.sin(angleX) * Math.cos(angleY);
	camera.position.z = ZSTEP*75 + WIDTH * DISTANCE_FACTOR * Math.cos(angleX) * Math.cos(angleY);


	camera.rotation.x = - angleX;
	camera.rotation.y = angleY;
    }  

    setCameraAngle(angleX, angleY);

    var ANGLE_STEP = Math.PI / 60;

    var MIN_ANGLE_X = 0;
    var MAX_ANGLE_X = Math.PI/2;
    var MIN_ANGLE_Y = -Math.PI/2;
    var MAX_ANGLE_Y = Math.PI/2;


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

    // var scene;
    
    var oldMaterials;
    this.oldMaterials = oldMaterials;

    var drawStyleFunctions = {}

    this.drawStyleFunctions = drawStyleFunctions;
    
    // common functions
    function lineMaterial(color) {
	return new THREE.LineBasicMaterial({
	    color: color
	});  
    }

    function meshMaterial(color) {
	return new THREE.MeshBasicMaterial({
	    color: color
	});  
    }

    // line

    drawStyleFunctions["line"] = {}

    drawStyleFunctions["line"].makeMaterial = lineMaterial;

    drawStyleFunctions["line"].makeObject =
	function(prevVectorArry, vectorArray, material)
    {
	var geometry = new THREE.Geometry();
	geometry.vertices = vectorArray;
	return new THREE.Line(geometry, material);
    }

    // frontmesh

    drawStyleFunctions["frontmesh"] = {}

    drawStyleFunctions["frontmesh"].makeMaterial = meshMaterial;

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

    // upmesh

    drawStyleFunctions["upmesh"] = {}

    drawStyleFunctions["upmesh"].makeMaterial = meshMaterial;

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

    // bar


    barMaterials = new Array(256/4);
    for(var i = 0; i < barMaterials.length; i++) {
	var base = 80 * 256;
	if (i%2 == 0) base = 80;
	var c = i * 4 * 256 * 256 + base;
	// var c = (120 + i * 2) *(1+256+256*256);
	barMaterials[i] = new THREE.MeshBasicMaterial({
	    color: c
	});
    }

    drawStyleFunctions["bar"] = {}
    drawStyleFunctions["bar"].makeMaterial = meshMaterial;

    drawStyleFunctions["bar"].makeObject =
	function(prevVectorArry, vectorArray, material)
    {
	var geometryArray = new Array(256/4);
	for(var i = 0; i < geometryArray.length; i++) {
	    geometryArray[i] = new THREE.Geometry();
	}
	var group = new THREE.Group();
	var max = 0;
	for(var i = 0; i < vectorArray.length-1; i++) {
	    var vertex = vectorArray[i];
	    var nextVertex = vectorArray[i+1];

	    var idx = Math.floor(vertex.y/4);
	    idx = Math.min(idx, geometryArray.length-1);

	    vertex.y += 2;
	    
	    geometryArray[idx].vertices.push(
		new THREE.Vector3(vertex.x, 0, 0)
	    );
	    geometryArray[idx].vertices.push(vertex);
	    geometryArray[idx].vertices.push(
		new THREE.Vector3(nextVertex.x, 0, 0)
	    );
	    geometryArray[idx].vertices.push(
		new THREE.Vector3(nextVertex.x, vertex.y, 0)
	    );
	    
	    var i4 = geometryArray[idx].vertices.length - 4;
	    geometryArray[idx].faces.push(
		new THREE.Face3(i4+2, i4+1, i4+0)
	    );
	    geometryArray[idx].faces.push(
		new THREE.Face3(i4+3, i4+1, i4+2)
	    );
	}
	// if (max > 255) max = 255;
	// return new THREE.Mesh(geometry, barMaterials[Math.floor(max/4)]);
	for(var i = 0; i < geometryArray.length; i++) {
	    if (geometryArray[i].vertices.length > 0) {
		group.add(new THREE.Mesh(geometryArray[i], barMaterials[i]));
	    }
	    geometryArray[i].dispose();
	}
	return group;
    }
    drawStyleFunctions["bar"].skipMaterialChange = true;


    ///////////////////////////////////////
    // rendering


    // event listeners to change settings

    function onchangeFunction() {
	window.cancelAnimationFrame(self.drawVisual);
	if (self.scene) {
	    var objs = new Array();
	    self.scene.traverse(function(obj) {
		if(obj.id != self.scene.id) objs.push(obj);
	    });
	    var obj;
	    for(obj in objs) {
		self.scene.remove(obj);
		deepDispose(obj);
	    }
	    self.scene = undefined;
	    objs = undefined;
	}
	
	self.visualize(app);
    }

    fftSizeSelect.onchange = onchangeFunction;

    nlinesSelect.onchange = onchangeFunction;

    styleSelect.onchange = onchangeFunction;

    smoothingSelect.onchange = function(e) {
	var smoothing = Number(smoothingSelect.value);
	app.analyser.smoothingTimeConstant = smoothing;
    }
    
}

function deepDispose(obj) {
    if (obj.geometry) obj.geometry.dispose();
    // group?
    if (obj.traverse) {
	obj.traverse(function(subObj) {
	    if(obj.id != subObj.id) deepDispose(subObj);
	});
    }
    if (obj.dispose) obj.dispose();
}



app.visualize = function() {
    var self = this;
    self.analyser.fftSize = Number(self.fftSizeSelect.value);  
    var NARRAY = Number(self.nlinesSelect.value);
    var bufferLength = self.analyser.frequencyBinCount;
    console.log(bufferLength);
    var drawStyle = this.styleSelect.value;

    // stop rendering
    if (drawStyle == "off") return;
    
    var frameLength = self.analyser.fftSize / self.audioCtx.sampleRate;
    self.frameLengthElm.innerText = frameLength;

    
    var dataArray = new Uint8Array(bufferLength);  

    var objectArray = new Array(NARRAY);
    
    self.scene = new THREE.Scene();

    var material;
    material = self.drawStyleFunctions[drawStyle].makeMaterial(0xffffff);

    // dispose old oldMaterials
    if (self.oldMaterials) {
	self.oldMaterials.forEach(function(m) { if(m.dispose) m.dispose(); });
    }

    // rebuild oldMaterials
    self.oldMaterials = new Array(NARRAY);
    for(var i = 0; i < NARRAY; i++) {
	var addColor = Math.floor(256 * (i/NARRAY));
	if (i % 2 == 0)
	    addColor = Math.floor(256 * 256 * 256 * ((NARRAY-i)/NARRAY));
	var c = 256 * 125 + addColor;
	self.oldMaterials[i] = self.drawStyleFunctions[drawStyle].makeMaterial(c);
    }

    // draw() sets
    var arrayIdx = 0;
    var prevVectorArry;

    function draw() {
	self.drawVisual = requestAnimationFrame(draw);

	{
	    // remove old object
	    var oldObj = objectArray[(arrayIdx + 1)%NARRAY];
	    if (oldObj) {
		self.scene.remove(oldObj);
		deepDispose(oldObj);
	    }
	    // move objects backward
	    self.scene.traverse(function(obj) {
		if(self.scene.id != obj.id) {
		    obj.translateZ(self.ZSTEP);
		}
	    });
	    // change last object material
	    if (!self.drawStyleFunctions[drawStyle].skipMaterialChange) {
      		var prevObj = objectArray[(arrayIdx + NARRAY -1) % NARRAY];
      		if (prevObj) {
      		    prevObj.material = self.oldMaterials[arrayIdx];
      		}
	    }
	}
	
	self.analyser.getByteFrequencyData(dataArray);

	var maxDrawFreq = self.MAX_FREQ / (self.analyser.context.sampleRate / self.analyser.fftSize);
	maxDrawFreq = Math.min(maxDrawFreq, bufferLength);
	var unitWidth = (self.width / maxDrawFreq);
	
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
		lx = Math.log(1+x) * self.width / 6.8
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
	    var obj = self.drawStyleFunctions[drawStyle].makeObject(
		prevVectorArry,
		vectorArray,
		material
	    );
	    if (obj) {
		objectArray[arrayIdx] = obj;
		self.scene.add(obj);
	    }
	}
	// console.log('render');
	self.renderer.render(self.scene, self.camera);

	prevVectorArry = vectorArray;
	arrayIdx = (arrayIdx + 1) % NARRAY
    };

    draw();

}

//////////////////////////////////////////////////////



if (navigator.getUserMedia) {
    navigator.getUserMedia (
	// constraints - only audio needed for this app
	{
            audio: true
	},

	// Success callback
	function (stream) {
	    app.connected(stream);
	    app.prepare();
	    app.visualize();
	}
	,

	// Error callback
	function(err) {
            console.log('The following gUM error occured: ' + err);
	}
    );
} else {
    console.log('getUserMedia not supported on your browser!');
}


// })();
