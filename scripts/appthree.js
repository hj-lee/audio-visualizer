// (function () {

$(function() {
    // fork getUserMedia for multiple browser versions, for those
    // that need prefixes
    navigator.getUserMedia = (navigator.getUserMedia ||
                              navigator.webkitGetUserMedia ||
                              navigator.mozGetUserMedia ||
                              navigator.msGetUserMedia);

    // prepare
    app.prepare();
    
    if (navigator.getUserMedia) {
	navigator.getUserMedia (
	    // constraints - only audio needed for this app
	    {
		audio: true
	    },

	    // Success callback
	    function (stream) {
		app.connected(stream);
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
});


///////////////////////////////////////////////////////
// Functions

// add option to select
function addOption(select, id, text, selected = false) {
    var opt = $('<option/>', {
	value: id,
	text: text
    });
    if (selected) {
	opt.attr('selected', 'selected');
    }
    select.append(opt);
}


// free geometries of the obj
// (manual geometry.dispose() call required.)
function deepDispose(obj) {
    if (obj.traverse) {
	obj.traverse(function(subObj) {
	    if(subObj.geometry) subObj.geometry.dispose();
	    if(obj.id != subObj.id && subObj.dispose) subObj.dispose();
	});
    }
    if (obj.dispose) obj.dispose();
}

// free materials
function disposeMaterials(materials) {
    if (materials) {
	materials.forEach(function(m) { if(m.dispose) m.dispose(); });
    }
}


////////////////////////////////////////////////
// The 'app' object

var app = {};


app.prepare = function() {
    this.prepareAnalyser();
    this.prepareMisc();
    this.prepareRender();
};

app.prepareAnalyser = function() {
    // set up forked web audio context, for multiple browsers
    // window. is needed otherwise Safari explodes
    let audioCtx = new (window.AudioContext ||
			window.webkitAudioContext)();

    this.audioCtx = audioCtx;

    // analyser
    let analyser = audioCtx.createAnalyser();
    this.analyser = analyser;
    
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.0;
};

app.prepareMisc = function() {
    // variables
    // max frequency of interest
    this.maxShowingFrequency = 20000;
    
    // set sample rate
    let sampleRate = this.audioCtx.sampleRate;
    $("#sampleRate").text(sampleRate);
    
    // add fftsize options
    {
	let suggestFft = sampleRate / 15;
	console.log('suggestFft: '+ suggestFft);
	let fftSelect = $("#fftsize");

	let found = false;
	for (let fft = 512; fft <= 32768; fft *= 2) {
	    let selected = false;
	    if (!found && fft > suggestFft) {
		selected = true;
		found = true;
	    }
	    addOption(fftSelect, fft, fft, selected);    
	}
    }
};


app.connected =  function(stream) {
    let audioCtx = this.audioCtx;
    let source = audioCtx.createMediaStreamSource(stream);
    source.connect(this.analyser);
    this.visualize();
};

app.registerRenderer = function(renderer, selected = false) {
    this.styleRenderers[renderer.id] = renderer;
    addOption($("#style"), renderer.id, renderer.desc, selected);
    if (selected) {
	this.currentRenderer = renderer;
    }
};

app.prepareRender = function() {
    let self = this;
    // select elements

    /////////////////////////////////////
    // size

    let width = Math.min(800, $(window).width());
    this.width = width;
    
    let height = Math.floor(width/2);
    this.height = height;


    // webGLRenderer
    let webGLRenderer = new THREE.WebGLRenderer();
    this.webGLRenderer = webGLRenderer;
    
    webGLRenderer.setSize(width, height);
    document.getElementById('three').appendChild(webGLRenderer.domElement);

    // camera
    let camera = new THREE.PerspectiveCamera(15, width / height, 1, width * 15);
    this.camera = camera;

    // styleRenderers
    
    let styleRenderers = {};

    this.styleRenderers = styleRenderers;

    ////////
    {
	Renderer.renderers.forEach(function(r) {
	    self.registerRenderer(r);
	});
	let stopRenderer = new Renderer("stop", "Stop");
	stopRenderer.cameraControl = undefined;
	self.registerRenderer(stopRenderer);
    }

    /////////////////////////////////////////////////////
    // camera control
    
    document.addEventListener('keydown', function(event) {
	let code = event.code;
	if (self.currentRenderer && self.currentRenderer.cameraControl) {
	    let cc = self.currentRenderer.cameraControl;
	    if (code == 'KeyW') {
		cc.up(camera);
	    }
	    else if (code == 'KeyS') {
		cc.down(camera);
	    }
	    else if (code == 'KeyA') {
		cc.left(camera);
	    }
	    else if (code == 'KeyD') {
		cc.right(camera);
	    }
	}
    });
    
    // event listeners to change settings

    function onchangeFunction() {
	window.cancelAnimationFrame(self.drawVisual);

	if (self.currentRenderer && self.currentRenderer.cleanUp) {
	    self.currentRenderer.cleanUp();
	}	
	self.visualize();
    }

    $("#fftsize,#nlines,#style").change(onchangeFunction);

    $("#smoothing").change(function(e) {
	let smoothing = Number($("#smoothing").val());
	self.analyser.smoothingTimeConstant = smoothing;
    });

};

app.visualize = function() {
    let self = this;
    
    self.analyser.fftSize = Number($("#fftsize").val());  
    self.nShapes = Number($("#nlines").val())+1;

    let frameLength = self.analyser.fftSize / self.audioCtx.sampleRate;
    $("#frameLength").text(frameLength.toFixed(4));

    let audioFrameRate = 1 / frameLength;
    $("#audioFrameRate").text(audioFrameRate.toFixed(2));
    
    
    let drawStyle = $("#style").val();

    self.currentRenderer = self.styleRenderers[drawStyle];

    self.currentRenderer.begin(self);
};


////////////////////////////////////////////////
// CameraControl

function CameraControl(poi, distance, angleX, angleY) {
    let width = 800;
    let height = 400;
    this.poi = poi || new THREE.Vector3(width/2, height/3, -150); 
    this.distance = distance || 2.1 * width;
    this.angleX = angleX || Math.PI/6;
    this.angleY = angleY || 0;

    this.angleStep = 3 * Math.PI / 180;
    this.minAngleX = 0;
    this.maxAngleX = Math.PI/2;
    this.minAngleY = -Math.PI/2;
    this.maxAngleY = Math.PI/2;
}

CameraControl.prototype.set = function(camera) {
    if (this.angleX > this.maxAngleX) this.angleX = this.maxAngleX;
    if (this.angleX < this.minAngleX) this.angleX = this.minAngleX;
    if (this.angleY > this.maxAngleY) this.angleY = this.maxAngleY;
    if (this.angleY < this.minAngleY) this.angleY = this.minAngleY;
    
    camera.position.x = this.poi.x +
	this.distance * Math.sin(this.angleY);
    camera.position.y = this.poi.y +
	this.distance * Math.sin(this.angleX) * Math.cos(this.angleY);
    camera.position.z = this.poi.z +
	this.distance * Math.cos(this.angleX) * Math.cos(this.angleY);

    camera.rotation.x = -this.angleX;
    camera.rotation.y = this.angleY;
};

CameraControl.prototype.up = function(camera) {
    this.angleX += this.angleStep;
    this.set(camera);
};

CameraControl.prototype.down = function(camera) {
    this.angleX -= this.angleStep;
    this.set(camera);
};

CameraControl.prototype.right = function(camera) {
    this.angleY += this.angleStep;
    this.set(camera);
};

CameraControl.prototype.left = function(camera) {
    this.angleY -= this.angleStep;
    this.set(camera);
};


////////////////////////////////////////////////
// Renderer

function Renderer(id, desc) {
    this.id = id;
    this.desc = desc;
}

Renderer.prototype.cameraControl = new CameraControl;

Renderer.prototype.begin = function() { };

Renderer.renderers = [];

////////////////////
// Line Renderer

function LineRenderer(id, desc) {
    let base = Renderer;
    base.call(this, id, desc);
    this.base = base;
}

LineRenderer.prototype = new Renderer;

// distance between each frame
LineRenderer.prototype.zStep = -10;

LineRenderer.prototype.cleanUp = function() {
    // dispose scene objects
    if (this.scene) {
	console.log('clear scene');
	deepDispose(this.scene);
	this.scene = undefined;
    }

    // dispose old oldMaterials
    disposeMaterials(this.oldMaterials);
    this.oldMaterials = undefined;
    
    // dispose material
    if (this.material) this.material.dispose();
    this.material = undefined;

    this.data = undefined;
};

LineRenderer.prototype.makeMaterial = function(color) {
    return new THREE.LineBasicMaterial({
	color: color
    });
};


LineRenderer.prototype.makeObject =
    function(prevVectorArry, vectorArray, material)
{
    let geometry = new THREE.Geometry();
    geometry.vertices = vectorArray;
    return new THREE.Line(geometry, material);
};

///////////////
// LineRenderer begin

LineRenderer.prototype.begin = function(app) {
    let self = this;
    this.app = app;
    this.prepare();
    
    function draw() {
	app.drawVisual = requestAnimationFrame(draw);
	self.draw();
    }
    draw();
};

LineRenderer.prototype.getBufferLength = function() {
    return this.analyser.frequencyBinCount;
};

LineRenderer.prototype.setCameraPOI = function() {
    this.cameraControl.poi
	= new THREE.Vector3(this.width/2, this.height/3, -50);
    this.cameraControl.distance = 2.1 * this.width;
};

LineRenderer.prototype.prepare = function() {
    let app = this.app;

    this.scene = new THREE.Scene();
    
    let analyser = app.analyser;
    this.analyser = analyser;

    this.webGLRenderer = app.webGLRenderer;
    this.camera = app.camera;

    let nShapes = app.nShapes;
    this.nShapes = nShapes;
    
    this.width = app.width;
    this.height = app.height;
    this.maxShowingFrequency = app.maxShowingFrequency;

    
    // let bufferLength = analyser.frequencyBinCount;

    let bufferLength = this.getBufferLength();
    
    this.bufferLength = bufferLength;

    // for easy clean-up
    this.data = {};
    
    this.data.dataArray = new Uint8Array(bufferLength);  
    
    this.data.objectArray = new Array(nShapes);

    // camera
    this.setCameraPOI();
    this.cameraControl.set(this.camera);
    
    this.material = this.material || this.makeMaterial(0xffffff);

    this.prepareMaterials();

    ////////
    let maxDrawFreq = this.maxShowingFrequency /
	(analyser.context.sampleRate / analyser.fftSize);
    maxDrawFreq = Math.min(maxDrawFreq, bufferLength);
    this.maxDrawFreq = maxDrawFreq;

    this.lxFactor = this.width / Math.log(this.width);

    
    this.checkFrameRate = 50;
    ////////
    // draw() sets
    this.frameCnt = 0;
    this.prevTime = performance.now();
    this.arrayIdx = 0;
};

LineRenderer.prototype.prepareMaterials = function() {
    let nShapes = this.nShapes;

    // dispose old oldMaterials
    if (this.oldMaterials) {
	this.oldMaterials.forEach(function(m) { if(m.dispose) m.dispose(); });
    }

    // rebuild oldMaterials
    this.oldMaterials = new Array(nShapes);
    for(let i = 0; i < nShapes; i++) {
	let addColor = Math.floor(256 * (i/nShapes));
	if (i % 2 == 0)
	    addColor = Math.floor(256 * 256 * 256 * ((nShapes-i)/nShapes));
	let c = 256 * 125 + addColor;
	this.oldMaterials[i] = this.makeMaterial(c);
    }
};

LineRenderer.prototype.changeLastMaterial = function() {
    let self = this;
    let nShapes = self.nShapes;
    let prevObj = self.data.objectArray[(self.arrayIdx + nShapes -1) % nShapes];
    if (prevObj) {
      	prevObj.material = self.oldMaterials[self.arrayIdx];
    }
};

LineRenderer.prototype.getData = function(dataArray) {
    this.analyser.getByteFrequencyData(dataArray);    
};

LineRenderer.prototype.changeX = function(x) {
    return Math.log(1+x) * this.lxFactor;
};

LineRenderer.prototype.drawLoop
    = function(dataArray, vectorArray, maxDrawFreq, unitWidth)
{
    let self = this;
    let x = 0;
    // let geometry = new THREE.Geometry();
	
    // lx closeness check
    let preLx = -100;
    let maxLy = -1000;
    let cnt = 0;

    for(let i = 0; i < maxDrawFreq; i++) {
	let y = (self.getY) ? (self.getY(i)) : dataArray[i];
	let z = (self.getZ) ? (self.getZ(i)) : 0;
	
	let lx = x;
	let ly = y;
	let lz = z;
	
	if (self.changeX) lx = self.changeX(x);
	if (self.changeY) ly = self.changeY(y);
	if (self.changeZ) lz = self.changeZ(z);
	
	// skip close log(1+x) positions, pick max y
	if (lx - preLx >= 0.9) {
	    vectorArray.push(
		new THREE.Vector3(lx, ly, lz)
	    );
	    
	    preLx = lx;
	    cnt = 0;
	    maxLy = -1000;
	} else {
	    cnt++;
	    maxLy = Math.max(maxLy, ly);
	}
	x += unitWidth;
    }
};

LineRenderer.prototype.draw = function () {
    let self = this;
    
    let analyser = self.analyser;
    let nShapes = self.nShapes;
    let scene = self.scene;

    let bufferLength = self.bufferLength;
    let dataArray = self.data.dataArray;
    let objectArray = self.data.objectArray;
    let material = self.material;

    let maxDrawFreq = self.maxDrawFreq;
    let width = self.width;

    self.frameCnt++;
    if (self.frameCnt % self.checkFrameRate == 0) {
	let now = performance.now();
	let rate = self.checkFrameRate / (now - self.prevTime) * 1e3;
	$("#frameRate").text(rate.toFixed(2));
	self.prevTime = now;
	
    }

    {
	// remove old object
	let oldObj = objectArray[(self.arrayIdx + 1)%nShapes];
	if (oldObj) {
	    scene.remove(oldObj);
	    deepDispose(oldObj);
	}
	// move objects backward
	scene.children.forEach(function(obj) {
	    if(scene.id != obj.id) {
		obj.translateZ(self.zStep);
	    }
	});
	// change material of last object
	if (self.changeLastMaterial) self.changeLastMaterial();
    }

    // analyser.getByteFrequencyData(dataArray);

    self.getData(dataArray);
    
    let unitWidth = (width / maxDrawFreq);
    
    let vectorArray = new Array();

    {
	self.drawLoop(dataArray, vectorArray, maxDrawFreq, unitWidth);
	let obj = self.makeObject(
	    self.data.prevVectorArry,
	    vectorArray,
	    material
	);
	if (obj) {
	    objectArray[self.arrayIdx] = obj;
	    scene.add(obj);
	}
    }
    
    self.webGLRenderer.render(scene, app.camera);

    self.data.prevVectorArry = vectorArray;
    self.arrayIdx = (self.arrayIdx + 1) % nShapes;
    
};


Renderer.lineRenderer = new LineRenderer("line", "Line");
Renderer.renderers.push(Renderer.lineRenderer);

//////////////////
// MeshRenderer

function MeshRenderer(id, desc) {
    let base = LineRenderer;
    base.call(this, id, desc);
    this.base = base;
}

MeshRenderer.prototype = new LineRenderer;

MeshRenderer.prototype.makeMaterial = function(color) {
    return new THREE.MeshBasicMaterial({
	color: color
    });  
};

/////////////////


Renderer.frontmeshRenderer =
    new MeshRenderer("frontmesh", "Front Mesh");

Renderer.frontmeshRenderer.makeObject =
    function(prevVectorArry, vectorArray, material)
{
    let geometry = new THREE.Geometry();
    for(let i = 0; i < vectorArray.length; i++) {
	let vertex = vectorArray[i];
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
};

Renderer.renderers.push(Renderer.frontmeshRenderer);

////////////////

Renderer.upmeshRenderer = new MeshRenderer("upmesh", "Up Mesh");

Renderer.upmeshRenderer.makeObject =
    function(prevVectorArry, vectorArray, material)
{
    if (prevVectorArry) {
	let geometry = new THREE.Geometry();
	for(let i = 0; i < vectorArray.length; i++) {
	    prevVectorArry[i].z = this.zStep;
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
};

Renderer.renderers.push(Renderer.upmeshRenderer);

// bar

Renderer.barRenderer = new MeshRenderer("bar", "Bar");

Renderer.barRenderer.prepareMaterials = function() {
    // Object.getPrototypeOf(this).prepareMaterials.call(this);
    if (!this.barMaterials) {
	let barMaterials = new Array(256/4);
	for(let i = 0; i < barMaterials.length; i++) {
	    let base = 80 * 256;
	    if (i%2 == 0) base = 80;
	    let c = i * 4 * 256 * 256 + base;
	    // let c = (120 + i * 2) *(1+256+256*256);
	    barMaterials[i] = new THREE.MeshBasicMaterial({
		color: c
	    });
	}
	this.barMaterials = barMaterials;
    }
};

Renderer.barRenderer.changeLastMaterial = undefined;

Renderer.barRenderer.cleanUp = function() {
    Object.getPrototypeOf(this).cleanUp.call(this);
    // MeshRenderer.prototype.cleanUp.call(this);
    disposeMaterials(this.barMaterials);
    this.barMaterials = undefined;
};

Renderer.barRenderer.makeObject =
    function(prevVectorArry, vectorArray, material)
{
    let geometryArray = new Array(256/4);
    for(let i = 0; i < geometryArray.length; i++) {
	geometryArray[i] = new THREE.Geometry();
    }
    let group = new THREE.Group();
    let max = 0;
    for(let i = 0; i < vectorArray.length-1; i++) {
	let vertex = vectorArray[i];
	let nextVertex = vectorArray[i+1];

	let idx = Math.floor(vertex.y/4);
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
	
	let i4 = geometryArray[idx].vertices.length - 4;
	geometryArray[idx].faces.push(
	    new THREE.Face3(i4+2, i4+1, i4+0)
	);
	geometryArray[idx].faces.push(
	    new THREE.Face3(i4+3, i4+1, i4+2)
	);
    }
    // if (max > 255) max = 255;
    // return new THREE.Mesh(geometry, barMaterials[Math.floor(max/4)]);
    for(let i = 0; i < geometryArray.length; i++) {
	if (geometryArray[i].vertices.length > 0) {
	    group.add(
		new THREE.Mesh(geometryArray[i], this.barMaterials[i])
	    );
	}
	// geometryArray[i].dispose();
    }
    return group;
};

Renderer.barRenderer.skipMaterialChange = true;

Renderer.renderers.push(Renderer.barRenderer);

//////
// WaveRenderer

function WaveRenderer(id, desc) {
    let base = LineRenderer;
    base.call(this, id, desc);
    this.base = base;
}

WaveRenderer.prototype = new LineRenderer;

WaveRenderer.prototype.zStep = -10;

WaveRenderer.prototype.setCameraPOI = function() {
    this.cameraControl.poi
	= new THREE.Vector3(this.width/2, 0, -50);
    this.cameraControl.distance = 2.1 * this.width;    
};

WaveRenderer.prototype.getBufferLength = function() {
    return this.analyser.fftSize;
};

WaveRenderer.prototype.prepare = function() {
    this.base.prototype.prepare.call(this);
    this.maxDrawFreq = this.bufferLength;
};

WaveRenderer.prototype.getData = function(dataArray) {
    this.analyser.getByteTimeDomainData(dataArray);
};

WaveRenderer.prototype.changeX = undefined;

WaveRenderer.prototype.changeY = function(y) {
    return (y-127.5)*(this.height/256);
};

Renderer.waveRenderer = new WaveRenderer("wave","Sine Wave");

Renderer.renderers.push(Renderer.waveRenderer);


//////////////////////////////////////////////////////
// KissFFTRenderer

function KissFFTRenderer(id, desc) {
    let base = WaveRenderer;
    base.call(this, id, desc);
    this.base = base;
}

KissFFTRenderer.prototype = new WaveRenderer;

KissFFTRenderer.prototype.prepare = function() {
    // no need to reset maxDrawFreq
    LineRenderer.prototype.prepare.call(this);

    let fftSize = this.analyser.fftSize;
    this.data.floatData = new Float32Array(fftSize);
    this.data.fftproc = new KissFFT(fftSize);
    this.normalizeFactor = this.height / 10 / Math.sqrt(fftSize);

    this.material3 = new Array(3);
    let material3 = this.material3;
    material3[0] = this.makeMaterial(0xffffff);
    material3[1] = this.makeMaterial(0x00ff00);
    material3[2] = this.makeMaterial(0x0000ff);
};

KissFFTRenderer.prototype.cleanUp = function() {
    disposeMaterials(this.material3);
    this.material3 = undefined;
    
    this.base.prototype.cleanUp.call(this);
};

KissFFTRenderer.prototype.getData = function(dataArray) {
    // get time domain data
    this.base.prototype.getData.call(this, dataArray);
    let size = this.bufferLength;
    let input = this.data.floatData;
    for (let i = 0; i < size; i++) {
	input[i] = (dataArray[i]-127.5);
	if (Math.abs(input[i]) < 0.6) input[i] = 0;
	input[i] /= 256.0;
    }
    this.data.out = this.data.fftproc.forward(input);
};

KissFFTRenderer.prototype.getY = function(i) {
    return this.data.out[i*2];
};

KissFFTRenderer.prototype.getZ = function(i) {
    return this.data.out[i*2+1];
};

KissFFTRenderer.prototype.changeX = LineRenderer.prototype.changeX;
KissFFTRenderer.prototype.changeY = undefined;

// KissFFTRenderer.prototype.changeLastMaterial = undefined; 

KissFFTRenderer.prototype.changeLastMaterial = function() {
    let self = this;
    let nShapes = self.nShapes;
    let prevObj = self.data.objectArray[(self.arrayIdx + nShapes -1) % nShapes];
    if (prevObj) {
      	// prevObj.material = self.oldMaterials[self.arrayIdx];
	prevObj.traverse(function(o) {
	    o.material = self.oldMaterials[self.arrayIdx];
	});
    }
};


KissFFTRenderer.prototype.zStep = -10;

KissFFTRenderer.prototype.makeObject =
    function(prevVectorArry, vectorArray, material)
{
    let nlines = 1;
    let group = new THREE.Group();
    let geos = new Array(nlines);
    for(let i = 0; i < nlines; i++) {
	geos[i] = new THREE.Geometry();
    }

    function transform(v) {
	// return v * 0.5;
	return Math.sign(v) * Math.log(1+Math.abs(v)) * 20;
    }

    let yarr = new Array(3);
    let preX = 0;
    for(let i = 0; i < vectorArray.length; i++) {
	let vertex = vectorArray[i];
	let x = vertex.x;
	let y = vertex.y;
	let z = vertex.z;
	
	let abs = Math.sqrt(y*y + z*z);

	yarr[0] = transform(abs);
	yarr[1] = transform(y);
	yarr[2] = transform(z);

	// for(let j = 0; j < nlines; j++) {
	//     geos[j].vertices.push(
	// 	new THREE.Vector3(x, yarr[j], 0)
	//     );
	// }
	geos[0].vertices.push(
	    new THREE.Vector3(x, yarr[0], 0)
	);
	// {
	//     geos[1].vertices.push(
	// 	new THREE.Vector3(x-0.5, 0, 0)
	//     );	    
	//     geos[1].vertices.push(
	// 	new THREE.Vector3(x, yarr[1], yarr[2])
	//     );
	//     geos[1].vertices.push(
	// 	new THREE.Vector3(x+0.5, 0, 0)
	//     );
	// }
	// {
	//     geos[1].vertices.push(
	// 	new THREE.Vector3(x-1, 0, 0)
	//     );	    
	//     geos[1].vertices.push(
	// 	new THREE.Vector3(x, yarr[1], 0)
	//     );
	//     geos[1].vertices.push(
	// 	new THREE.Vector3(x+1, 0, 0)
	//     );
	// }
	// {
	//     geos[2].vertices.push(
	// 	new THREE.Vector3(x-1, 0, 0)
	//     );	    
	//     geos[2].vertices.push(
	// 	new THREE.Vector3(x, 0, yarr[2])
	//     );
	//     geos[2].vertices.push(
	// 	new THREE.Vector3(x+1, 0, 0)
	//     );
	// }
	preX = x;
    }

    for(let i = 0; i < nlines; i++) {
	let line = new THREE.Line(geos[i], this.material3[i]);
	group.add(line);
    }
    return group;
};


Renderer.cmpxRenderer = new KissFFTRenderer("kissline", "Line(Complex)");


Renderer.renderers.push(Renderer.cmpxRenderer);


// })();
