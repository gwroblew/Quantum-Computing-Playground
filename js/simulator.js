/**
 * @fileoverview Quantum Computer emulator engine.
 * @suppress {missingProperties} ThreeJS main object is not compiled.
*/


/**
 * Quantum computer simulator object.
 * @param {!THREE.WebGLRenderer} renderer ThreeJS WebGL renderer object.
 * @param {number} vsize Vector size of the register.
 * @constructor
 */
quantum.Simulator = function(renderer, vsize) {

  /**
   * ThreeJS renderer object.
   * @type {!THREE.WebGLRenderer}
   */
  this.renderer = renderer;

  /**
   * @type {number}
   */
  this.vectorSize = vsize;

  /**
   * Camera object used for GPGPU operations.
   * @type {!THREE.Camera}
   */
  this.camera = new THREE.Camera();
  this.camera.position.z = 1;

  /**
   * Number of states in the quantum state vector.
   * @type {number}
   */
  this.stateCnt = 1 << vsize;

  /**
   * Width of the texture holding the vector state.
   * @type {number}
   */
  this.texWidth = 1 << (vsize / 2);

  /**
   * Passthrough shader for copying textures.
   * @type {!THREE.Material}
   */
  this.passThruShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('fragmentShader').textContent
  });

  /**
   * Decoherence shader.
   * @type {!THREE.Material}
   */
  this.decoherenceShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
                    value: new THREE.Vector2(this.texWidth, this.texWidth) },
      texture: { type: 't', value: null },
      nrands: { type: 'fv1', value: new Array(22) }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('decoherenceShader').textContent
  });

  /**
   * Float values extracting shader.
   * @type {!THREE.Material}
   */
  this.floatShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      selector: { type: 'i', value: 0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('floatShader').textContent
  });

  /**
   * Shader for general unitary gate.
   * @type {!THREE.Material}
   */
  this.unitaryShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null },
      vcoeff1: { type: 'v4', value: new THREE.Vector4(0, 0, 0, 0) },
      vcoeff2: { type: 'v4', value: new THREE.Vector4(0, 0, 0, 0) },
      vcoeff3: { type: 'v4', value: new THREE.Vector4(0, 0, 0, 0) },
      vcoeff4: { type: 'v4', value: new THREE.Vector4(0, 0, 0, 0) }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('unitaryShader').textContent
  });

  /**
   * Swap gate shader.
   * @type {!THREE.Material}
   */
  this.swapShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      upperbitmask1: { type: 'f', value: 0.0 },
      upperbitmask2: { type: 'f', value: 0.0 },
      bitmask1: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('swapShader').textContent
  });

  /**
   * Toffoli gate shader.
   * @type {!THREE.Material}
   */
  this.toffoliShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      cbitmask1: { type: 'f', value: 0.0 },
      cbitmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('toffoliShader').textContent
  });

  /**
   * Controlled phase shift gate shader.
   * @type {!THREE.Material}
   */
  this.cphaseShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      cbitmask1: { type: 'f', value: 0.0 },
      cbitmask2: { type: 'f', value: 0.0 },
      shift_re: { type: 'v2', value: new THREE.Vector2(0.0, 0.0) },
      shift_im: { type: 'v2', value: new THREE.Vector2(0.0, 0.0) },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('cphaseShader').textContent
  });

  /**
   * Sigma X gate shader.
   * @type {!THREE.Material}
   */
  this.sigmaxShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('sigmaxShader').textContent
  });

  /**
   * Sigma Y gate shader.
   * @type {!THREE.Material}
   */
  this.sigmayShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('sigmayShader').textContent
  });

  /**
   * Sigma Z gate shader.
   * @type {!THREE.Material}
   */
  this.sigmazShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('sigmazShader').textContent
  });

  /**
   * Bit measure operation shader.
   * @type {!THREE.Material}
   */
  this.bmeasureShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      value: { type: 'i', value: 0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('bmeasureShader').textContent
  });

  /**
   * Reducing shader for bit measure operation.
   * @type {!THREE.Material}
   */
  this.reducingShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth / 2,
            this.texWidth / 2) },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('reducingShader').textContent
  });

  /**
   * Bit measure state collapse shader.
   * @type {!THREE.Material}
   */
  this.collapseShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask: { type: 'f', value: 0.0 },
      bitmask2: { type: 'f', value: 0.0 },
      value: { type: 'i', value: 0 },
      norm: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('collapseShader').textContent
  });

  /**
   * State vector bitwise shift left shader.
   * @type {!THREE.Material}
   */
  this.shiftLeftShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('shiftLeftShader').textContent
  });

  /**
   * State vector bitwise shift right shader.
   * @type {!THREE.Material}
   */
  this.shiftRightShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      bitmask2: { type: 'f', value: 0.0 },
      vecmask2: { type: 'f', value: 0.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('shiftRightShader').textContent
  });

  /**
   * State modulus calculating shader.
   * @type {!THREE.Material}
   */
  this.modulusShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('modulusShader').textContent
  });

  /**
   * Max modulus reducing shader.
   * @type {!THREE.Material}
   */
  this.maxreduceShader = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { type: 'v2',
        value: new THREE.Vector2(this.texWidth, this.texWidth) },
      texture: { type: 't', value: null }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('maxreduceShader').textContent
  });

  /**
   * Scene used for GPGPU operations.
   * @type {!THREE.Scene}
   */
  this.scene = new THREE.Scene();

  /**
   * Mesh used for GPGPU operations.
   * @type {!THREE.Mesh}
   */
  this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
                             this.passThruShader);

  this.scene.add(this.mesh);
};


/**
 * Initializes simulator, mainly texture objects.
 */
quantum.Simulator.prototype.init = function() {
  /**
   * Texture array for setting state from JavaScript.
   * @type {!Float32Array}
   */
  this.texArray = new Float32Array(this.texWidth * this.texWidth * 4);

  /**
   * Data texture for vector state.
   * @type {!Object}
   */
  this.dataTexture =
      new THREE.DataTexture(this.texArray, this.texWidth, this.texWidth,
          THREE.RGBAFormat, THREE.FloatType);
  this.dataTexture.minFilter = THREE.NearestFilter;
  this.dataTexture.magFilter = THREE.NearestFilter;
  this.dataTexture.needsUpdate = true;
  this.dataTexture.flipY = false;

  var rWidth = this.texWidth / 2;

  /**
   * Texture for converting float data into 4 bytes.
   * @type {!THREE.WebGLRenderTarget}
   */
  this.rtOutput = this.getRenderTarget(THREE.UnsignedByteType,
                                       THREE.RGBAFormat, this.texWidth);

  /**
   * Textures for reducing shaders.
   * @type {!Array.<!THREE.WebGLRenderTarget>}
   */
  this.rtInputSum = [];

  while (rWidth != 2) {
    this.rtInputSum.push(
        this.getRenderTarget(THREE.FloatType, THREE.RGBAFormat, rWidth));
    rWidth = rWidth / 2;
  }

  /**
   * Last texture in the reducing chain for float data reading.
   * @type {!THREE.WebGLRenderTarget}
   */
  this.rtOutputSum =
      this.getRenderTarget(THREE.UnsignedByteType, THREE.RGBAFormat, 4);

  /**
   * Two main textures representing state vector.
   * @type {!THREE.WebGLRenderTarget}
   */
  this.rtInput1 =
      this.getRenderTarget(THREE.FloatType, THREE.RGBAFormat, this.texWidth);

  /**
   * @type {!THREE.WebGLRenderTarget}
   */
  this.rtInput2 = this.rtInput1.clone();

  this.zeroState();
};


/**
 * Initializes state vector to state |0>.
 */
quantum.Simulator.prototype.zeroState = function() {
  // Initialize state vector to state |0>.
  this.generateZeroTexture();
  this.setState();
};


/**
 * Return state JavaScript array buffer. Each state is 4 floats: [re, im, 0, 0].
 * @return {!Float32Array}
 */
quantum.Simulator.prototype.getStateArray = function() {
  return this.texArray;
};


/**
 * Sets state to the one given in JavaScript array.
 */
quantum.Simulator.prototype.setState = function() {
  this.dataTexture.needsUpdate = true;
  this.renderTexture(this.dataTexture, this.rtInput1);
  this.renderTexture(this.rtInput1, this.rtInput2);

  // Holds the texture with current state.
  this.currentOutput = this.rtInput1;
};


/**
 * Creates texture / render target for GPGPU.
 * @param {number} type ThreeJS data format, float or unsigned byte.
 * @param {number} format ThreeJS pixel format (we use RGBA only).
 * @param {number} width Texture width in pixels, power of 2.
 * @return {!THREE.WebGLRenderTarget} Texture for rendering.
 */
quantum.Simulator.prototype.getRenderTarget = function(type, format, width) {
  var renderTarget = new THREE.WebGLRenderTarget(width, width, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: format,
    type: type,
    stencilBuffer: false,
    generateMipmaps: false,
    depthBuffer: false
  });

  return renderTarget;
};


/**
 * Renders input texture into output texture using pass-through shader.
 * @param {!Object} input Input texture.
 * @param {!THREE.WebGLRenderTarget} output Output texture.
 */
quantum.Simulator.prototype.renderTexture = function(input, output) {
  this.mesh.material =
      /** @type {!THREE.MeshBasicMaterial} */(this.passThruShader);
  this.passThruShader.uniforms.texture.value = input;
  this.renderer.render(this.scene, this.camera, output);
};


/**
 * Renders float texture into byte texture to extract float numbers.
 * @param {!Object} input Input texture.
 * @param {number} width Width of the textures.
 * @param {!THREE.WebGLRenderTarget} output Output texture.
 * @param {number} selector Which component should be converted (R=0, G=1,...).
 */
quantum.Simulator.prototype.renderFloat = function(input, width, output, selector) {
  this.mesh.material =
      /** @type {!THREE.MeshBasicMaterial} */(this.floatShader);
  this.floatShader.uniforms.resolution.value.x = width;
  this.floatShader.uniforms.resolution.value.y = width;
  this.floatShader.uniforms.selector.value = selector;
  this.floatShader.uniforms.texture.value = input;
  this.renderer.render(this.scene, this.camera, output);
};


/**
 * Renders state vector using given shader with output flipping.
 * @param {!Object} shader Shader to use.
 */
quantum.Simulator.prototype.renderShader = function(shader) {
  var output, input = this.currentOutput;

  if (input == this.rtInput1) {
    output = this.rtInput2;
  } else {
    output = this.rtInput1;
  }

  this.mesh.material = /** @type {!THREE.MeshBasicMaterial} */(shader);
  shader.uniforms.texture.value = input;
  this.renderer.render(this.scene, this.camera, output);
  this.currentOutput = output;
};


/**
 * Renders reducing shader on current output.
 * @param {!Object} shader First step reducing shader to use.
 * @param {!Object} reducer Following steps reducing shader.
 */
quantum.Simulator.prototype.renderShaderReduce = function(shader, reducer) {
  this.mesh.material = /** @type {!THREE.MeshBasicMaterial} */(shader);
  shader.uniforms.texture.value = this.currentOutput;
  this.renderer.render(this.scene, this.camera, this.rtInputSum[0]);

  var i = 1, width = this.texWidth / 2;

  while (i != this.rtInputSum.length) {
    this.mesh.material = /** @type {!THREE.MeshBasicMaterial} */(reducer);
    reducer.uniforms.resolution.value.x = width;
    reducer.uniforms.resolution.value.y = width;
    reducer.uniforms.texture.value = this.rtInputSum[i - 1];
    this.renderer.render(this.scene, this.camera, this.rtInputSum[i]);
    width = width / 2;
    i++;
  }
};


/**
 * Renders unitary matrix shader.
 * @param {number} bitn Qbit the unitary tranformation should be applied to.
 * @param {!{re: Array.<number>, im: Array.<number>}} matrix Two arrays
 *     representing 2x2 unitary matrix.
 */
quantum.Simulator.prototype.renderUnitary = function(bitn, matrix) {
  this.unitaryShader.uniforms.bitmask.value = 1 << bitn;
  this.unitaryShader.uniforms.bitmask2.value = 1 << (bitn + 1);
  this.unitaryShader.uniforms.vcoeff1.value.x = matrix.re[0];
  this.unitaryShader.uniforms.vcoeff1.value.y = -matrix.im[0];
  this.unitaryShader.uniforms.vcoeff1.value.z = matrix.re[1];
  this.unitaryShader.uniforms.vcoeff1.value.w = -matrix.im[1];
  this.unitaryShader.uniforms.vcoeff2.value.x = matrix.im[0];
  this.unitaryShader.uniforms.vcoeff2.value.y = matrix.re[0];
  this.unitaryShader.uniforms.vcoeff2.value.z = matrix.im[1];
  this.unitaryShader.uniforms.vcoeff2.value.w = matrix.re[1];
  this.unitaryShader.uniforms.vcoeff3.value.x = matrix.re[2];
  this.unitaryShader.uniforms.vcoeff3.value.y = -matrix.im[2];
  this.unitaryShader.uniforms.vcoeff3.value.z = matrix.re[3];
  this.unitaryShader.uniforms.vcoeff3.value.w = -matrix.im[3];
  this.unitaryShader.uniforms.vcoeff4.value.x = matrix.im[2];
  this.unitaryShader.uniforms.vcoeff4.value.y = matrix.re[2];
  this.unitaryShader.uniforms.vcoeff4.value.z = matrix.im[3];
  this.unitaryShader.uniforms.vcoeff4.value.w = matrix.re[3];
  this.renderShader(this.unitaryShader);
};

/**
 * Renders decoherence.
 * @param {number} strength The strength of the decoherence.
 */
quantum.Simulator.prototype.applyDecoherence = function(strength) {
  /* Generate normal distributed random numbers */
  for (var i = 0; i < this.vectorSize; i++) {
    do {
      var u = 2 * Math.random() - 1;
      var v = 2 * Math.random() - 1;
      var s = u * u + v * v;
    } while (s >= 1);
    var x = u * Math.sqrt(-2 * Math.log(s) / s);
    x *= Math.sqrt(2 * strength);
    this.decoherenceShader.uniforms.nrands.value[i] = x / 2;
  }
  for (var i = this.vectorSize; i < 22; i++) {
    this.decoherenceShader.uniforms.nrands.value[i] = 0;
  }
  this.renderShader(this.decoherenceShader);
};


/**
 * Renders Hadamard transform.
 * @param {number} bitn Qbit the transform should be applied to.
 */
quantum.Simulator.prototype.applyHadamard = function(bitn) {
  var hc = 1 / Math.sqrt(2);
  var matrix = { re: [hc, hc, hc, -hc], im: [0, 0, 0, 0] };

  this.renderUnitary(bitn, matrix);
};


/**
 * Renders the Rx transform.
 * This simulates a 'rotation by theta around the x axis'.
 * @param {number} bitn Qbit the transform should be applied to.
 * @param {number} theta Angle the transform should be applied to.
 */
quantum.Simulator.prototype.applyRx = function(bitn, theta) {
  var sinTheta = Math.sin(theta / 2);
  var cosTheta = Math.cos(theta / 2);

  var matrix = {
    re: [cosTheta, 0, 0, cosTheta],
    im: [0, sinTheta, sinTheta, 0]
  };

  this.renderUnitary(bitn, matrix);
};


/**
 * Renders the Ry transform.
 * This simulates a 'rotation by theta around the y axis'.
 * @param {number} bitn Qbit the transform should be applied to.
 * @param {number} theta Angle the transform should be applied to.
 */
quantum.Simulator.prototype.applyRy = function(bitn, theta) {
  var sinTheta = Math.sin(theta / 2);
  var cosTheta = Math.cos(theta / 2);

  var matrix = {
    re: [cosTheta, sinTheta, -1 * sinTheta, cosTheta],
    im: [0, 0, 0, 0]
  };

  this.renderUnitary(bitn, matrix);
};


/**
 * Renders the Rz transform.
 * This simulates a 'rotation by theta around the z axis'.
 * @param {number} bitn Qbit the transform should be applied to.
 * @param {number} theta Angle the transform should be applied to.
 */
quantum.Simulator.prototype.applyRz = function(bitn, theta) {
  var sinTheta = Math.sin(theta / 2);
  var cosTheta = Math.cos(theta / 2);

  var matrix = {
    re: [cosTheta, 0, 0, cosTheta],
    im: [sinTheta, 0, 0, -1 * sinTheta]
  };

  this.renderUnitary(bitn, matrix);
};


/**
 * Renders the Swap gate on the register.
 * @param {number} bit0 First qubit.
 * @param {number} bit1 Second qubit.
 */
quantum.Simulator.prototype.applySwap = function(bit0, bit1) {
  this.swapShader.uniforms.bitmask1.value = 1 << bit0;
  this.swapShader.uniforms.bitmask2.value = 1 << bit1;
  this.swapShader.uniforms.upperbitmask1.value = 1 << (bit0 + 1);
  this.swapShader.uniforms.upperbitmask2.value = 1 << (bit1 + 1);
  this.renderShader(this.swapShader);
};


/**
 * Renders Toffoli gate on the register.
 * @param {number} bit0 Control qbit 1.
 * @param {number} bit1 Control qbit 2.
 * @param {number} bit2 Target qbit.
 */
quantum.Simulator.prototype.applyToffoli = function(bit0, bit1, bit2) {
  this.toffoliShader.uniforms.bitmask.value = 1 << bit2;
  this.toffoliShader.uniforms.bitmask2.value = 1 << (bit2 + 1);
  this.toffoliShader.uniforms.cbitmask1.value = 1 << bit0;
  this.toffoliShader.uniforms.cbitmask2.value = 1 << bit1;
  this.renderShader(this.toffoliShader);
};


/**
 * Renders conditional phase shift between two qbits for QFT.
 * @param {number} control Control qbit index (starting from 0).
 * @param {number} target Target qbit index (starting from 0).
 * @param {number} inv +1 for QFT shift, -1 for inverse QFT shift.
 */
quantum.Simulator.prototype.applyPhaseShift = function(control, target, inv) {
  var phi = inv * Math.PI / (1 << (control - target));

  this.applyCPhaseShift(control, target, phi);
};


/**
 * Renders conditional phase shift between two qbits.
 * @param {number} control Control qbit index (starting from 0).
 * @param {number} target Target qbit index (starting from 0).
 * @param {number} angle Angle of phase shift.
 */
quantum.Simulator.prototype.applyCPhaseShift = function(control, target, angle) {
  this.cphaseShader.uniforms.cbitmask1.value = 1 << control;
  this.cphaseShader.uniforms.cbitmask2.value = 1 << target;

  var re = Math.cos(angle);
  var im = Math.sin(angle);

  this.cphaseShader.uniforms.shift_re.value.x = re;
  this.cphaseShader.uniforms.shift_re.value.y = -im;
  this.cphaseShader.uniforms.shift_im.value.x = im;
  this.cphaseShader.uniforms.shift_im.value.y = re;
  this.renderShader(this.cphaseShader);
};


/**
 * Renders controlled not gate.
 * @param {number} bitc Control qbit.
 * @param {number} bitn Target qbit.
 */
quantum.Simulator.prototype.applyCNot = function(bitc, bitn) {
  this.applyToffoli(bitc, bitc, bitn);
};


/**
 * Reders sigma X gate.
 * @param {number} bitn Qbit the gate should be applied to.
 */
quantum.Simulator.prototype.applySigmaX = function(bitn) {
  this.sigmaxShader.uniforms.bitmask.value = 1 << bitn;
  this.sigmaxShader.uniforms.bitmask2.value = 1 << (bitn + 1);
  this.renderShader(this.sigmaxShader);
};


/**
 * Reders sigma Y gate.
 * @param {number} bitn Qbit the gate should be applied to.
 */
quantum.Simulator.prototype.applySigmaY = function(bitn) {
  this.sigmayShader.uniforms.bitmask.value = 1 << bitn;
  this.sigmayShader.uniforms.bitmask2.value = 1 << (bitn + 1);
  this.renderShader(this.sigmayShader);
};


/**
 * Reders sigma Z gate.
 * @param {number} bitn Qbit the gate should be applied to.
 */
quantum.Simulator.prototype.applySigmaZ = function(bitn) {
  this.sigmazShader.uniforms.bitmask.value = 1 << bitn;
  this.sigmazShader.uniforms.bitmask2.value = 1 << (bitn + 1);
  this.renderShader(this.sigmazShader);
};


/**
 * Shifts state vector to the left, inserts zero amplitudes for the new states,
 * assumes no state information loss (left qbit state values being zero).
 * @param {number} nbits Number of qbits the state will be shifted.
 */
quantum.Simulator.prototype.applyShiftLeft = function(nbits) {
  this.shiftLeftShader.uniforms.bitmask2.value = 1 << nbits;
  this.renderShader(this.shiftLeftShader);
};


/**
 * Shifts state vector to the right, inserts zero amplitudes for the new states,
 * assumes no state information loss (right qbit state values being zero).
 * @param {number} nbits Number of qbits the state will be shifted.
 */
quantum.Simulator.prototype.applyShiftRight = function(nbits) {
  this.shiftRightShader.uniforms.bitmask2.value = 1 << nbits;
  this.shiftRightShader.uniforms.vecmask2.value = this.stateCnt;
  this.renderShader(this.shiftRightShader);
};


/**
 * Performs inverse QFT on given set of qbits.
 * @param {number} offset Starting qbit of QFT window.
 * @param {number} width Number of qbits spanning the QFT window.
 */
quantum.Simulator.prototype.applyInvQFT = function(offset, width) {
  var i, j;

  for (i = width - 1; i >= 0; i--) {
    for (j = width - 1; j > i; j--) {
      this.applyPhaseShift(j + offset, i + offset, 1.0);
    }

    this.applyHadamard(i + offset);
  }
};


/**
 * Performs QFT on given set of qbits.
 * @param {number} offset Starting qbit of inverse QFT window.
 * @param {number} width Number of qbits spanning the inverse QFT window.
 */
quantum.Simulator.prototype.applyQFT = function(offset, width) {
  var i, j;

  for (i = 0; i < width; i++) {
    this.applyHadamard(i + offset);

    for (j = i + 1; j < width; j++) {
      this.applyPhaseShift(j + offset, i + offset, -1.0);
    }
  }
};


/**
 * Calculates |j>|x^j mod N> from |j>|0>.
 * @param {number} x Exponent.
 * @param {number} N Modulus.
 * @param {number} width Width of j states register.
 */
quantum.Simulator.prototype.applyExpModN = function(x, N, width) {
  var state = this.getState();
  var i, cnt = 1 << width;

  this.generateZeroTexture();
  this.texArray[0] = 0;

  // Here we do the main calculation in JavaScript.
  // Let it be an exercise for the reader to figure out why it is not done
  // in a shader. Reader shall meditate on the following koan:
  // "What is the sound of water going up the waterfall?"
  for (i = 0; i < cnt; i++) {
    var idx = ((QMath.expModN(x, i, N) << width) + i) * 4;

    this.texArray[idx] = state[i * 2];
    this.texArray[idx + 1] = state[i * 2 + 1];
  }
  this.setState();
};


/**
 * Calculates |j>|j^x mod N> from |j>|0>.
 * @param {number} x Exponent.
 * @param {number} N Modulus.
 * @param {number} width Width of j states register.
 */
quantum.Simulator.prototype.applyRevExpModN = function(x, N, width) {
  var state = this.getState();
  var i, cnt = 1 << width;

  this.generateZeroTexture();
  this.texArray[0] = 0;

  // Here we do the main calculation in JavaScript.
  // Let it be an exercise for the reader to figure out why it is not done
  // in a shader. Reader shall meditate on the following koan:
  // "What is the sound of water going up the waterfall?"
  for (i = 0; i < cnt; i++) {
    var idx = ((QMath.expModN(i, x, N) << width) + i) * 4;

    this.texArray[idx] = state[i * 2];
    this.texArray[idx + 1] = state[i * 2 + 1];
  }
  this.setState();
};


/**
 * Gets maximum amplitude of a state within the current state vector.
 * @return {number} Value of maximum amplitude within state vector.
 */
quantum.Simulator.prototype.getMaxAmplitude = function() {
  this.renderShaderReduce(this.modulusShader, this.maxreduceShader);

  return this.getMax();
};


/**
 * Performs partial measurement on the current vector state, collapses
 * the vector according to the result of the measurement.
 * @param {number} bitn Qbit on which the measurement should be performed.
 * @return {number} 0 or 1, depending on the value that was measured.
 */
quantum.Simulator.prototype.applyBitMeasure = function(bitn) {
  this.bmeasureShader.uniforms.bitmask.value = 1 << bitn;
  this.bmeasureShader.uniforms.bitmask2.value = 1 << (bitn + 1);
  this.bmeasureShader.uniforms.value.value = 0;
  this.renderShaderReduce(this.bmeasureShader, this.reducingShader);

  var sum = this.getSum();
  var r = Math.random();
  var result = 0;

  if (r > sum)
    result = 1;

  this.bmeasureShader.uniforms.value.value = result;
  this.renderShaderReduce(this.bmeasureShader, this.reducingShader);

  this.collapseShader.uniforms.bitmask.value = 1 << bitn;
  this.collapseShader.uniforms.bitmask2.value = 1 << (bitn + 1);
  this.collapseShader.uniforms.value.value = result;
  this.collapseShader.uniforms.norm.value = 1 / Math.sqrt(this.getSum());
  this.renderShader(this.collapseShader);

  return result;
};


/**
 * Measures state of the current quantum vector state, does not collapse
 * the current vector state.
 * @return {number} Integer value that was measured, 0..2^n-1 where n is
 *     current state vector size.
 */
quantum.Simulator.prototype.applyMeasure = function() {
  var i, r = Math.random();
  var state = this.getState();
  var norm = 0;

  // Due to numerical inaccuracies state might be not normalized,
  // so we are going to take this into account.
  for (i = 0; i < state.length; i += 2) {
    norm += state[i] * state[i] + state[i + 1] * state[i + 1];
  }

  r = r * norm;

  for (i = 0; i < state.length; i += 2) {
    // If the random number is less than the probability of the
    // given base state - r, return the base state as the
    // result. Otherwise, continue with the next base state.
    r -= state[i] * state[i] + state[i + 1] * state[i + 1];
    if (0 >= r)
      return i / 2;
  }
  return (i - 2) / 2;
};


/**
 * Calculates maximum value in the current reduced vector state.
 * @return {number} Maximum value in the reduced output texture.
 */
quantum.Simulator.prototype.getMax = function() {
  var partmax = this.getResult(this.rtInputSum[this.rtInputSum.length - 1], 4,
                               this.rtOutputSum, 1);
  var max = 0.0;

  goog.array.forEach(partmax, function(pm) {
    max = Math.max(max, pm);
  });

  return max;
};


/**
 * Calculates sum of values in the current reduced vector state.
 * @return {number} Sum of values in the reduced output texture.
 */
quantum.Simulator.prototype.getSum = function() {
  var partsum = this.getResult(this.rtInputSum[this.rtInputSum.length - 1], 4,
                               this.rtOutputSum, 2);
  var sum = 0.0;

  goog.array.forEach(partsum, function(ps) {
    sum += ps;
  });

  return sum;
};


/**
 * Gets current vector state as JavaScript array.
 * @return {!Float32Array} Float array of real and imaginary values
 *     (interleaved).
 */
quantum.Simulator.prototype.getState = function() {
  return this.getResult(this.currentOutput, this.texWidth, this.rtOutput, 2);
};


/**
 * Gets values from float texture as JavaScript array.
 * @param {!Object} input Input texture for extract from.
 * @param {number} width Width of the input texture.
 * @param {!THREE.WebGLRenderTarget} output Output byte format texture to use.
 * @param {number} compcnt Number of components to extract (1 or 2, for two
 *     components the return array will be interleaved).
 * @return {!Float32Array} Float array of values from the input texture.
 */
quantum.Simulator.prototype.getResult = function(input, width, output, compcnt) {
  var i, ctx = this.renderer.getContext();
  var arr2, arr1 = new Uint8Array(width * width * 4);

  this.renderFloat(input, width, output, 0);
  ctx.readPixels(0, 0, width, width, ctx.RGBA, ctx.UNSIGNED_BYTE, arr1);

  if (compcnt == 2) {
    arr2 = new Uint8Array(width * width * 4);
    this.renderFloat(input, width, output, 1);
    ctx.readPixels(0, 0, width, width, ctx.RGBA, ctx.UNSIGNED_BYTE, arr2);
  }

  function intToFloat(v) {
    if (v & (1 << 24)) {
      return -((v & 0xffffff) / 1048576);
    }
    return v / 1048576;
  };

  if (compcnt == 1) {
    var comp = new Uint32Array(arr1.buffer);
    var result = new Float32Array(comp.length);

    for (i = 0; i < comp.length; i++) {
      result[i] = intToFloat(comp[i]);
    }
    return result;
  }
  var comp1 = new Uint32Array(arr1.buffer);
  var comp2 = new Uint32Array(arr2.buffer);
  var result = new Float32Array(comp1.length * 2);

  for (i = 0; i < comp1.length; i++) {
    result[i * 2] = intToFloat(comp1[i]);
    result[i * 2 + 1] = intToFloat(comp2[i]);
  }
  return result;
};


/**
 * Generates data for initial vector state.
 */
quantum.Simulator.prototype.generateZeroTexture = function() {
  var k, a = this.texArray;

  for (k = 0; k < this.texWidth * this.texWidth; k++) {
    a[k * 4 + 0] = 0;
    a[k * 4 + 1] = 0;
    a[k * 4 + 2] = 0;
    a[k * 4 + 3] = 0;
  }

  a[0] = 1.0;
};
