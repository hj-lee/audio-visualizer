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
		app.prepareRender();
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
});


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


////////////////////////////////////////////////
// Renderer

function Renderer(id, desc) {
    this.id = id;
    this.desc = desc;
}

Renderer.prototype.addOption = function(select, selected) {
    addOption(select, this.id, this.desc, selected);
}

function FrequencyRenderer(id, desc) {
    this.base = Renderer;
    this.base(id, desc);
}

FrequencyRenderer.prototype = new Renderer;



////////////////////////////////////////////////
// The 'app' object

var app = {};

app.prepare = function() {
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

    // variables
    // max frequency of interest
    this.maxShowingFrequency = 15000;
    
    // set sample rate
    let sampleRate = audioCtx.sampleRate
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
}


app.prepareRender = function() {
    let self = this;
    // select elements

    /////////////////////////////////////
    // three.js

    let width = 800;
    this.width = width;
    
    let height = 400;
    this.height = height;


    // distance between each frame
    let zStep = -2;
    this.zStep = zStep;

    // renderer

    let renderer = new THREE.WebGLRenderer();
    this.renderer = renderer;
    
    renderer.setSize(width, height);
    document.getElementById('three').appendChild(renderer.domElement);

    // camera

    let camera = new THREE.PerspectiveCamera(15, width / height, 1, width * 3);
    this.camera = camera;

    let distanceFactor = 2.1


    let angleX = Math.PI/6;
    let angleY = 0;

    function setCameraAngle(angleX, angleY) {
	camera.position.x = width/2 + width * distanceFactor * Math.sin(angleY);
	camera.position.y = height/3 + width * distanceFactor * Math.sin(angleX) * Math.cos(angleY);
	camera.position.z = zStep*75 + width * distanceFactor * Math.cos(angleX) * Math.cos(angleY);


	camera.rotation.x = - angleX;
	camera.rotation.y = angleY;
    }  

    setCameraAngle(angleX, angleY);

    let ANGLE_STEP = 3 * Math.PI / 180;

    let MIN_ANGLE_X = 0;
    let MAX_ANGLE_X = Math.PI/2;
    let MIN_ANGLE_Y = -Math.PI/2;
    let MAX_ANGLE_Y = Math.PI/2;


    document.addEventListener('keydown', function(event) {
	let code = event.code;
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

    // let scene;
    
    let oldMaterials;
    this.oldMaterials = oldMaterials;

    let drawStyleFunctions = {}

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

    drawStyleFunctions["line"] = new FrequencyRenderer("line", "Line");

    drawStyleFunctions["line"].makeMaterial = lineMaterial;

    drawStyleFunctions["line"].makeObject =
	function(prevVectorArry, vectorArray, material)
    {
	let geometry = new THREE.Geometry();
	geometry.vertices = vectorArray;
	return new THREE.Line(geometry, material);
    }

    // frontmesh

    drawStyleFunctions["frontmesh"] = new FrequencyRenderer("frontmesh", "Front Mesh");

    drawStyleFunctions["frontmesh"].makeMaterial = meshMaterial;

    drawStyleFunctions["frontmesh"].makeObject =
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

    // upmesh

    drawStyleFunctions["upmesh"] = new FrequencyRenderer("upmesh", "Up Mesh");

    drawStyleFunctions["upmesh"].makeMaterial = meshMaterial;

    drawStyleFunctions["upmesh"].makeObject =
	function(prevVectorArry, vectorArray, material)
    {
	if (prevVectorArry) {
	    let geometry = new THREE.Geometry();
	    for(let i = 0; i < vectorArray.length; i++) {
		prevVectorArry[i].z = zStep;
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

    drawStyleFunctions["bar"] = new FrequencyRenderer("bar", "Bar");
    drawStyleFunctions["bar"].makeMaterial = meshMaterial;

    drawStyleFunctions["bar"].makeObject =
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
	    geometryArray[i].dispose();
	}
	return group;
    }
    drawStyleFunctions["bar"].skipMaterialChange = true;

    ////////


    let styleSelect = $("#style");
    drawStyleFunctions["line"].addOption(styleSelect, true);
    drawStyleFunctions["frontmesh"].addOption(styleSelect);
    drawStyleFunctions["upmesh"].addOption(styleSelect);
    drawStyleFunctions["bar"].addOption(styleSelect);
    (new Renderer("stop", "Stop")).addOption(styleSelect);

    ///////////////////////////////////////
    // rendering


    // event listeners to change settings

    function onchangeFunction() {
	window.cancelAnimationFrame(self.drawVisual);
	if (self.scene) {
	    let objs = new Array();
	    self.scene.traverse(function(obj) {
		if(obj.id != self.scene.id) objs.push(obj);
	    });
	    let obj;
	    for(obj in objs) {
		self.scene.remove(obj);
		deepDispose(obj);
	    }
	    self.scene = undefined;
	    objs = undefined;
	}
	
	self.visualize(app);
    }

    $("#fftsize,#nlines,#style").change(onchangeFunction);

    $("#smoothing").change(function(e) {
	let smoothing = Number($("#smoothing").val());
	app.analyser.smoothingTimeConstant = smoothing;
    });

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
    let self = this;
    self.analyser.fftSize = Number($("#fftsize").val());  
    
    let NARRAY = Number($("#nlines").val());
    let bufferLength = self.analyser.frequencyBinCount;
    console.log(bufferLength);
    let drawStyle = $("#style").val();

    // stop rendering
    if (drawStyle == "off") return;
    
    let frameLength = self.analyser.fftSize / self.audioCtx.sampleRate;
    $("#frameLength").text(frameLength.toFixed(4));
    
    let dataArray = new Uint8Array(bufferLength);  

    let objectArray = new Array(NARRAY);
    
    self.scene = new THREE.Scene();

    let material;
    material = self.drawStyleFunctions[drawStyle].makeMaterial(0xffffff);

    // dispose old oldMaterials
    if (self.oldMaterials) {
	self.oldMaterials.forEach(function(m) { if(m.dispose) m.dispose(); });
    }

    // rebuild oldMaterials
    self.oldMaterials = new Array(NARRAY);
    for(let i = 0; i < NARRAY; i++) {
	let addColor = Math.floor(256 * (i/NARRAY));
	if (i % 2 == 0)
	    addColor = Math.floor(256 * 256 * 256 * ((NARRAY-i)/NARRAY));
	let c = 256 * 125 + addColor;
	self.oldMaterials[i] = self.drawStyleFunctions[drawStyle].makeMaterial(c);
    }

    // draw() sets
    let arrayIdx = 0;
    let prevVectorArry;

    function draw() {
	self.drawVisual = requestAnimationFrame(draw);

	{
	    // remove old object
	    let oldObj = objectArray[(arrayIdx + 1)%NARRAY];
	    if (oldObj) {
		self.scene.remove(oldObj);
		deepDispose(oldObj);
	    }
	    // move objects backward
	    self.scene.traverse(function(obj) {
		if(self.scene.id != obj.id) {
		    obj.translateZ(self.zStep);
		}
	    });
	    // change material of last object
	    if (!self.drawStyleFunctions[drawStyle].skipMaterialChange) {
      		let prevObj = objectArray[(arrayIdx + NARRAY -1) % NARRAY];
      		if (prevObj) {
      		    prevObj.material = self.oldMaterials[arrayIdx];
      		}
	    }
	}
	
	self.analyser.getByteFrequencyData(dataArray);

	let maxDrawFreq = self.maxShowingFrequency /
	    (self.analyser.context.sampleRate / self.analyser.fftSize);
	maxDrawFreq = Math.min(maxDrawFreq, bufferLength);
	
	let unitWidth = (self.width / maxDrawFreq);
	
	let vectorArray = new Array();

	{
	    let x = 0;

	    // let geometry = new THREE.Geometry();
	    
	    // lx closeness check
	    let preLx = -100;
	    let maxLy = 0;
	    let cnt = 0;

	    let lxFactor = self.width / Math.log(self.width);
	    
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
	    let obj = self.drawStyleFunctions[drawStyle].makeObject(
		prevVectorArry,
		vectorArray,
		material
	    );
	    if (obj) {
		objectArray[arrayIdx] = obj;
		self.scene.add(obj);
	    }
	}
	self.renderer.render(self.scene, self.camera);

	prevVectorArry = vectorArray;
	arrayIdx = (arrayIdx + 1) % NARRAY
    };

    draw();

}

//////////////////////////////////////////////////////


// })();
