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



////////////////////////////////////////////////
// The 'app' object

var app = {};


app.prepare = function() {
    this.prepareAnalyser();
    this.prepareMisc();
    this.prepareRender();
}

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
}

app.prepareMisc = function() {
    // variables
    // max frequency of interest
    this.maxShowingFrequency = 15000;
    
    // set sample rate
    let sampleRate = this.audioCtx.sampleRate
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
}


app.connected =  function(stream) {
    let audioCtx = this.audioCtx;
    let source = audioCtx.createMediaStreamSource(stream);
    source.connect(this.analyser);
    this.visualize();
}

app.registerRenderer = function(renderer, selected = false) {
    this.styleRenderers[renderer.id] = renderer;
    addOption($("#style"), renderer.id, renderer.desc, selected);
    if (selected) {
	this.currentRenderer = renderer;
    }
}

app.prepareRender = function() {
    let self = this;
    // select elements

    /////////////////////////////////////
    // size

    let width = 800;
    this.width = width;
    
    let height = 400;
    this.height = height;


    // distance between each frame
    let zStep = -2;
    this.zStep = zStep;

    // webGLRenderer

    let webGLRenderer = new THREE.WebGLRenderer();
    this.webGLRenderer = webGLRenderer;
    
    webGLRenderer.setSize(width, height);
    document.getElementById('three').appendChild(webGLRenderer.domElement);

    // camera

    let camera = new THREE.PerspectiveCamera(15, width / height, 1, width * 3);
    this.camera = camera;

    // styleRenderers
    
    let styleRenderers = {}

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
    
    // self.currentRenderer = self.currentRenderer || lineRenderer;
    // self.currentRenderer.cameraControl.set(camera);
    
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
	
	if (self.scene) {
	    console.log('clear scene');
	    deepDispose(self.scene);
	    self.scene = undefined;
	}
	
	self.visualize();
    }

    $("#fftsize,#nlines,#style").change(onchangeFunction);

    $("#smoothing").change(function(e) {
	let smoothing = Number($("#smoothing").val());
	app.analyser.smoothingTimeConstant = smoothing;
    });

}

app.visualize = function() {
    let self = this;

    let frameLength = app.analyser.fftSize / app.audioCtx.sampleRate;
    $("#frameLength").text(frameLength.toFixed(4));

    self.analyser.fftSize = Number($("#fftsize").val());  
    self.nShapes = Number($("#nlines").val());

    let drawStyle = $("#style").val();

    self.currentRenderer = self.styleRenderers[drawStyle];

    self.currentRenderer.begin(self);
}


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
    camera.position.x = this.poi.x +
	this.distance * Math.sin(this.angleY);
    camera.position.y = this.poi.y +
	this.distance * Math.sin(this.angleX) * Math.cos(this.angleY);
    camera.position.z = this.poi.z +
	this.distance * Math.cos(this.angleX) * Math.cos(this.angleY);

    camera.rotation.x = -this.angleX;
    camera.rotation.y = this.angleY;
}

CameraControl.prototype.up = function(camera) {
    this.angleX += this.angleStep;
    if (this.angleX > this.maxAngleX) this.angleX = this.maxAngleX;
    this.set(camera);
}
CameraControl.prototype.down = function(camera) {
    this.angleX -= this.angleStep;
    if (this.angleX < this.minAngleX) this.angleX = this.minAngleX;
    this.set(camera);
}
CameraControl.prototype.right = function(camera) {
    this.angleY += this.angleStep;
    if (this.angleY > this.maxAngleY) this.angleY = this.maxAngleY;
    this.set(camera);
}
CameraControl.prototype.left = function(camera) {
    this.angleY -= this.angleStep;
    if (this.angleY < this.minAngleY) this.angleY = this.minAngleY;
    this.set(camera);
}


////////////////////////////////////////////////
// Renderer

function Renderer(id, desc) {
    this.id = id;
    this.desc = desc;
}

Renderer.prototype.cameraControl = new CameraControl;

Renderer.prototype.begin = function() { }

Renderer.renderers = [];

////////////////////
// Line Renderer

function LineRenderer(id, desc) {
    this.base = Renderer;
    this.base(id, desc);
}

LineRenderer.prototype = new Renderer;

LineRenderer.prototype.makeMaterial = function(color) {
    return new THREE.LineBasicMaterial({
	color: color
    });  
}

LineRenderer.prototype.makeObject =
    function(prevVectorArry, vectorArray, material)
{
    let geometry = new THREE.Geometry();
    geometry.vertices = vectorArray;
    return new THREE.Line(geometry, material);
}

///////////////
// LineRenderer begin

LineRenderer.prototype.begin = function(app) {
    let self = this;
    this.app = app;
    this.prepare();
    
    // requestAnimationFrame requires function
    // this of lineRenderer.draw() is not a LineRenderer.
    function draw() {
	app.drawVisual = requestAnimationFrame(draw);
	self.draw(self);
    }
    draw();
}


LineRenderer.prototype.prepare = function() {
    let app = this.app;

    app.scene = new THREE.Scene();
    let scene = app.scene;
    
    let analyser = app.analyser;
    let nShapes = app.nShapes;

    let bufferLength = analyser.frequencyBinCount;
    this.bufferLength = bufferLength;

    this.dataArray = new Uint8Array(bufferLength);  

    this.objectArray = new Array(nShapes);

    // camera
    this.cameraControl.set(app.camera);
    
    this.material = this.makeMaterial(0xffffff);

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

    // draw() sets
    this.arrayIdx = 0;
    
}

LineRenderer.prototype.draw = function draw(self) {
    let app = self.app;
    
    let analyser = app.analyser;
    let nShapes = app.nShapes;
    let scene = app.scene;

    let bufferLength = self.bufferLength;
    let dataArray = self.dataArray;
    let objectArray = self.objectArray;
    let material = self.material;
    

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
		obj.translateZ(app.zStep);
	    }
	});
	// change material of last object
	if (!self.skipMaterialChange) {
      	    let prevObj = objectArray[(self.arrayIdx + nShapes -1) % nShapes];
      	    if (prevObj) {
      		prevObj.material = self.oldMaterials[self.arrayIdx];
      	    }
	}
    }

    analyser.getByteFrequencyData(dataArray);

    let maxDrawFreq = app.maxShowingFrequency /
	(analyser.context.sampleRate / analyser.fftSize);
    maxDrawFreq = Math.min(maxDrawFreq, bufferLength);
    
    let unitWidth = (app.width / maxDrawFreq);
    
    let vectorArray = new Array();

    {
	let x = 0;

	// let geometry = new THREE.Geometry();
	
	// lx closeness check
	let preLx = -100;
	let maxLy = 0;
	let cnt = 0;

	let lxFactor = app.width / Math.log(app.width);
	
	for(let i = 0; i < maxDrawFreq; i++) {
	    let y = dataArray[i];

	    let lx = x;
	    let ly = y;

	    lx = Math.log(1+x) * lxFactor;
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
	let obj = self.makeObject(
	    self.prevVectorArry,
	    vectorArray,
	    material
	);
	if (obj) {
	    objectArray[self.arrayIdx] = obj;
	    scene.add(obj);
	}
    }
    app.webGLRenderer.render(scene, app.camera);

    self.prevVectorArry = vectorArray;
    self.arrayIdx = (self.arrayIdx + 1) % nShapes;
    
}


Renderer.lineRenderer = new LineRenderer("line", "Line");
Renderer.renderers.push(Renderer.lineRenderer);

//////////////////
// MeshRenderer

function MeshRenderer(id, desc) {
    this.base = LineRenderer;
    this.base(id, desc);
}

MeshRenderer.prototype = new LineRenderer;

MeshRenderer.prototype.makeMaterial = function(color) {
    return new THREE.MeshBasicMaterial({
	color: color
    });  
}

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
}

Renderer.renderers.push(Renderer.frontmeshRenderer);

////////////////

Renderer.upmeshRenderer = new MeshRenderer("upmesh", "Up Mesh");

Renderer.upmeshRenderer.makeObject =
    function(prevVectorArry, vectorArray, material, app)
{
    if (prevVectorArry) {
	let geometry = new THREE.Geometry();
	for(let i = 0; i < vectorArray.length; i++) {
	    prevVectorArry[i].z = this.app.zStep;
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

Renderer.renderers.push(Renderer.upmeshRenderer);

// bar

{
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

    Renderer.barRenderer = new MeshRenderer("bar", "Bar");
    
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
		group.add(new THREE.Mesh(geometryArray[i], barMaterials[i]));
	    }
	    // geometryArray[i].dispose();
	}
	return group;
    }
    Renderer.barRenderer.skipMaterialChange = true;
    
    Renderer.renderers.push(Renderer.barRenderer);
}


//////////////////////////////////////////////////////


// })();
