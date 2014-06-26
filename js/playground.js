/**
 * @fileoverview Main entry of the web app.
 * @suppress {missingProperties} ThreeJS main object is not compiled.
 */


/**
 * Playground page controller with application logic.
 * @param {!angular.$routeParams} $routeParams Parameters of to current route.
 * @param {!angular.Scope} $rootScope The root scope of Angular.
 * @param {!angular.Scope} $scope The scope for this controller.
 * @param {!angular.$http} $http The angular http service.
 * @param {!angular.$location} $location The angular location service.
 * @param {!angular.$document} $document The angular document service.
 * @constructor
 * @ngInject
 * @export
 */
quantum.PlaygroundController = function($routeParams, $rootScope, $scope, $http,
    $location, $document) {

  /**
   * Debug output window content.
   * @type {!Array.<string>}
   * @export
   */
  this.output = ['Ready.'];

  /**
   * Call stack data for the template.
   * @type {!Array.<string>}
   * @export
   */
  this.callstack = [];

  /**
   * Local variables data for the template.
   * @type {!Array.<!Array.<string>>}
   * @export
   */
  this.locals = [];

  /**
   * List of comments under the script.
   * @type {!Array}
   * @export
   */
  this.comments = [];

  /**
   * Author of currently displayed script.
   * @type {string}
   * @export
   */
  this.scriptAuthor = '';

  /**
   * Name of currently displayed script.
   * @type {string}
   * @export
   */
  this.scriptName = '';

  /**
   * Creation date of currently displayed script.
   * @type {string}
   * @export
   */
  this.scriptCreated = '';

  /**
   * Last modification date.
   * @type {string}
   * @export
   */
  this.scriptModified = '';

  /**
   * True when current script is a fixed example.
   * @type {boolean}
   * @export
   */
  this.scriptIsExample = false;

  /**
   * True when current user is website admin.
   * @type {boolean}
   * @export
   */
  this.userIsAdmin = false;

  /**
   * True when currently displayed script can be updated.
   * @type {boolean}
   * @export
   */
  this.scriptCanUpdate = false;

  /**
   * True when currently displayed script is saving.
   * @type {boolean}
   * @export
   */
  this.scriptIsSaving = false;

  /**
   * True when currently displayed script is loading.
   * @type {boolean}
   * @export
   */
  this.scriptIsLoading = false;

  /**
   * Current type of selected vector state view.
   * @type {string}
   * @export
   */
  this.viewType = '3d';

  /**
   * Highest amplitude of a state in current vector.
   * @type {number}
   * @export
   */
  this.maxState = 0;

  /**
   * Indicates whether visualized state should be normalized.
   * @type {boolean}
   * @export
   */
  this.normalize = true;

  /**
   * Code/number of the currently viewed state (moused over).
   * @type {number}
   * @export
   */
  this.stateNumber = 0;

  /**
   * Real value of the currently moused over state.
   * @type {number}
   * @export
   */
  this.stateRe = 0;

  /**
   * Imaginary value of the currently moused over state.
   * @type {number}
   * @export
   */
  this.stateIm = 0;

  /**
   * Content of overlay box on top of visualized vector state.
   * @type {string}
   * @export
   */
  this.overlayHtml = '';

  /**
   * Initialize controller after shaders template has loaded.
   */
  $scope.$on('$includeContentLoaded', goog.bind(this.init, this));

  /**
   * Add handler of keyboard shortcuts.
   */
  var handler = goog.bind(this.handleShortcuts, this);
  $document.bind('keydown', handler);
  $scope.$on('$destroy', function() {
    $document.unbind('keydown', handler);
  });

  /**
   * Returns identifier of local variable.
   * @param {number} l Index in array of local variables.
   * @return {string} Identifier.
   */
  $scope.getLocalVarId = function(l) {
    return l[0];
  };

  /**
   * @export
   * @param {string} type View type to test.
   */
  this.viewClass = function(type) {
    return type == this.viewType ? 'active' : '';
  };

  /** @private {!angular.Scope} */
  this.scope_ = $scope;

  /** @private {!angular.Scope} */
  this.rootScope_ = $rootScope;

  /** @private {!angular.$http} */
  this.http_ = $http;

  /** @private {!angular.$location} */
  this.location_ = $location;

  /** @private {!angular.$document} */
  this.document_ = $document;

  /**
   * Datastore id of the current script.
   * @type {string}
   * @export
   */
  this.qscriptId = $routeParams.qscriptId || '';

  /**
   * Main QScript object for compiling and execution.
   * @type {quantum.QScript}
   * @private
   */
  this.compiler_ = null;

  /**
   * Current quantum vector state (used only for mouse hover).
   * @private {Float32Array}
   */
  this.state_ = null;

  /**
   * Indicates that state getting was already scheduled.
   * @private {boolean}
   */
  this.statePending_ = false;

  /**
   * Indicates that auto scrolling timer was scheduled.
   * @private {boolean}
   */
  this.scrollFlag_ = false;

  /**
   * WebGL canvas DOM element.
   * @private {Element}
   */
  this.canvas_;

  /**
   * CodeMirror object for source code editor.
   * @private {CodeMirror}
   */
  this.editor_ = null;

  /**
   * Run mode of script execution.
   * @private {boolean}
   */
  this.runmode_ = false;

  /**
   * ThreeJS renderer object.
   * @private {!THREE.WebGLRenderer}
   */
  this.renderer_;

  /**
   * ThreeJS camera object.
   * @private {!THREE.PerspectiveCamera}
   */
  this.camera_;

  /**
   * ThreeJS shader for drawing state vector.
   * @private {Object}
   */
  this.colorShader_;

  /**
   * ThreeJS scene for drawing state vector.
   * @private {!THREE.Scene}
   */
  this.scene_;

  /**
   * ThreeJS mesh for drawing state vector.
   * @private {!THREE.Mesh}
   */
  this.mesh_;

  /**
   * Default speed of execution in run mode (1ms delay between timer events).
   * @type {number}
   * @const
   */
  this.DEFAULT_RUN_DELAY = 1;

  /**
   * Default number of executed steps per each timer event.
   * @type {number}
   * @const
   */
  this.DEFAULT_EXECUTED_STEPS = 20;

  /**
   * Delay time (in ms) between timer events in run mode.
   * @private {number}
   */
  this.runDelay_ = this.DEFAULT_RUN_DELAY;
};


/**
 * Handles keyboard shortcuts.
 * @param {!angular.Scope.Event} $event Event object.
 */
quantum.PlaygroundController.prototype.handleShortcuts = function($event) {
  if (!($event.shiftKey && $event.ctrlKey && !$event.altKey)) {
    return;
  }

  var character = String.fromCharCode($event.keyCode).toLowerCase();

  switch (character) {
    case '4':
      this.scope_.$apply(goog.bind(this.compile, this));
      break;
    case '5':
      this.scope_.$apply(goog.bind(this.run, this));
      break;
    case '7':
      this.scope_.$apply(goog.bind(this.stepInto, this));
      break;
    case '6':
      this.scope_.$apply(goog.bind(this.stepBack, this));
      break;
    case '8':
      this.scope_.$apply(goog.bind(this.stepOver, this));
      break;
    case '1':
      this.scope_.$apply(goog.bind(this.setView2D, this));
      break;
    case '2':
      this.scope_.$apply(goog.bind(this.setView2DPhase, this));
      break;
    case '3':
      this.scope_.$apply(goog.bind(this.setView3D, this));
      break;
  }
};


/**
 * Indicates whether current script was compiled.
 * @return {boolean} True when compilation was successful.
 * @export
 */
quantum.PlaygroundController.prototype.isCompiled = function() {
  return goog.isDefAndNotNull(this.compiler_);
};


/**
 * Indicates whether current script is in running state.
 * @return {boolean} True when running mode is active.
 * @export
 */
quantum.PlaygroundController.prototype.isRunning = function() {
  return this.runmode_;
};


/**
 * Indicates whether current script was stopped after running at least one step.
 * @return {boolean} True when script was stopped.
 * @export
 */
quantum.PlaygroundController.prototype.isStopped = function() {
  return goog.isDefAndNotNull(this.compiler_) && !this.compiler_.isStart();
};


/**
 * Loads comments asynchronously.
 * @export
 */
quantum.PlaygroundController.prototype.loadComments = function() {
  this.http_.post('/loadcomments', {qscriptId: this.qscriptId}).
      success(goog.bind(function(data, status, headers, config) {
        this.comments = data;
      }, this));
};


/**
 * Saves new comment for current script.
 * @export
 */
quantum.PlaygroundController.prototype.saveComment = function() {
  var comment = {
    qscriptId: this.qscriptId,
    content: this.content
  };
  this.http_.post('/addcomment', comment).
      success(goog.bind(function(data, status, headers, config) {
        var cid = data.commentId;
        if (cid != '0') {
          this.comments.push({
            id: cid,
            author: this.rootScope_.userinfo.nickname,
            content: this.content,
            created: (new Date()).toISOString()
          });
          this.content = '';
        }
      }, this));
};


/**
 * Deletes given comment under current script.
 * @param {string} id Comment id.
 * @export
 */
quantum.PlaygroundController.prototype.deleteComment = function(id) {
  this.http_.post('/deletecomment', {id: id}).
      success(goog.bind(function(data, status, headers, config) {
        var cid = data.commentId;
        if (cid == 0) {
          var i = goog.array.findIndex(this.comments, function(elem) {
            return elem.id == id;
          });
          if (i >= 0) {
            this.comments.splice(i, 1);
          }
        }
      }, this));
};


/**
 * Loads script object asynchronously.
 * @export
 */
quantum.PlaygroundController.prototype.loadScript = function() {
  this.scriptIsLoading = true;
  this.http_.post('/loadscript', {id: this.qscriptId}).
      success(goog.bind(function(data, status, headers, config) {
        this.editor_.getDoc().setValue(data.content);
        this.scriptName = data.name;
        this.scriptCreated = data.created;
        this.scriptModified = data.modified;
        this.scriptAuthor = data.author;
        this.scriptIsExample = data.example;
        this.scriptCanUpdate = data.update;
        this.userIsAdmin = data.admin;
        this.scriptIsLoading = false;
        this.rootScope_.lastQScriptId = this.qscriptId;
      }, this));
};


/**
 * Saves script object asynchronously.
 * @export
 */
quantum.PlaygroundController.prototype.saveScript = function() {
  var qscript = {
    id: this.qscriptId,
    name: this.scriptName,
    content: this.editor_.getDoc().getValue()
  };
  this.saveScriptPost(qscript);
};


/**
 * Creates new script.
 * @export
 */
quantum.PlaygroundController.prototype.newScript = function() {
  var qscript = {
    id: '1',
    name: 'New Script',
    content: '// This is new empty script.\n\n'
  };
  this.saveScriptPost(qscript);
};


/**
 * @param {Object} qscript QScript object to save.
 * @export
 */
quantum.PlaygroundController.prototype.saveScriptPost = function(qscript) {
  this.scriptIsSaving = true;
  this.http_.post('/savescript', qscript).
      success(goog.bind(function(data, status, headers, config) {
        var old = this.qscriptId;
        this.qscriptId = data.qscriptId;
        if (old != this.qscriptId) {
          this.location_.url('/playground/' + this.qscriptId);
          this.rootScope_.lastQScriptId = this.qscriptId;
        }
        this.scriptModified = (new Date()).toISOString();
        this.scriptIsSaving = false;
      }, this));
};


/**
 * Timer function used for auto scrolling in console output.
 * @private
 */
quantum.PlaygroundController.prototype.consoleScroll_ = function() {
  var out = goog.dom.getElement('output');
  out.scrollTop = out.scrollHeight;
  this.scrollFlag_ = false;
};


/**
 * Appends new message to the playground console output.
 * @param {string} msg Output string.
 */
quantum.PlaygroundController.prototype.consoleOut = function(msg) {
  this.output.push(msg);

  if (!this.scrollFlag_) {
    // 100ms delay for auto scrolling in console output.
    setTimeout(goog.bind(this.consoleScroll_, this), 100);
    this.scrollFlag_ = true;
  }
};


/**
 * Handler of the compile button click.
 * @export
 */
quantum.PlaygroundController.prototype.compile = function() {
  if (!goog.isDefAndNotNull(this.renderer_)) {
    return;
  }
  this.compiler_ = new quantum.QScript(this.renderer_,
      goog.bind(function(fnc, argv) {
        if (fnc == 'Print') {
          this.consoleOut(argv[0]);
          return;
        }
        if (fnc == 'Delay') {
          if (typeof argv[0] != 'number' || argv[0] < 1 || argv[0] > 10000) {
            this.consoleOut(
                'Delay argument must be a number between 1 and 10000.');
            this.runmode_ = false;
            return;
          }
          this.runDelay_ = argv[0];
          return;
        }
        if (fnc == 'Display') {
          this.overlayHtml = argv[0];
          return;
        }
        if (fnc == 'SetViewAngle') {
          if (typeof argv[0] != 'number') {
            this.consoleOut('View angle must be a number.');
            this.runmode_ = false;
            return;
          }
          this.mesh3d_.rotation.z = argv[0];
          requestAnimationFrame(goog.bind(this.animate, this));
          return;
        }
        if (fnc == 'SetViewMode') {
          if (typeof argv[0] != 'number' || argv[0] < 0 || argv[0] > 2) {
            this.consoleOut('View mode must be a number between 0 and 2.');
            this.runmode_ = false;
            return;
          }
          switch (Math.floor(argv[0])) {
            case 0:
              this.setView2D();
              break;
            case 1:
              this.setView2DPhase();
              break;
            case 2:
              this.setView3D();
              break;
          }
          requestAnimationFrame(goog.bind(this.animate, this));
          return;
        }
        this.runmode_ = false;
      }, this));

  this.overlayHtml = '';
  this.maxState = 0;

  this.compiler_.compile(this.editor_.getDoc().getValue());
  var err = this.compiler_.errors;
  this.output = err.length == 0 ? ['Success.'] : err;
};


/**
 * Handler of the run button click.
 * @export
 */
quantum.PlaygroundController.prototype.run = function() {
  if (!goog.isDefAndNotNull(this.compiler_) ||
      !goog.isDefAndNotNull(this.editor_)) {
    return;
  }
  if (this.runmode_) {
    this.runmode_ = false;
  } else {
    this.runmode_ = true;
    setTimeout(goog.bind(this.stepRun_, this), this.runDelay_);
  }
};


/**
 * Timer function for continuous run.
 * @param {boolean=} opt_noapply True if $apply() call on Angular scope
 *     should be skipped.
 * @private
 */
quantum.PlaygroundController.prototype.stepRun_ = function(opt_noapply) {
  var i;

  if (!opt_noapply && !this.runmode_) {
    return;
  }

  for (i = 0; i < this.DEFAULT_EXECUTED_STEPS; i++) {
    this.compiler_.runStep();

    goog.array.forEach(this.compiler_.errors, goog.bind(function(err) {
      this.consoleOut(err);
    }, this));

    var cline = this.compiler_.getCurrentLine();

    if (this.editor_.lineInfo(cline).gutterMarkers) {
      this.runmode_ = false;
    }
    if (!this.runmode_ || this.runDelay_ != this.DEFAULT_RUN_DELAY) {
      break;
    }
  }

  this.editor_.setCursor(cline, 0);
  this.callstack = this.compiler_.getCurrentCallStack();
  this.locals = this.compiler_.getCurrentLocals();
  this.state_ = null;

  if (goog.isDefAndNotNull(this.compiler_.simulator)) {
    this.maxState = this.compiler_.simulator.getMaxAmplitude();
    requestAnimationFrame(goog.bind(this.animate, this));
  }

  if (this.runmode_ && !this.compiler_.isDone()) {
    setTimeout(goog.bind(this.stepRun_, this), this.runDelay_);
  } else {
    this.runmode_ = false;
  }
  if (!opt_noapply) {
    this.scope_.$apply();
  }
};


/**
 * Handler of the step into button click.
 * @export
 */
quantum.PlaygroundController.prototype.stepInto = function() {
  if (!goog.isDefAndNotNull(this.compiler_) ||
      !goog.isDefAndNotNull(this.editor_)) {
    return;
  }
  this.stepRun_(true);
};


/**
 * Handler of the step over button click.
 * @export
 */
quantum.PlaygroundController.prototype.stepOver = function() {
  if (!goog.isDefAndNotNull(this.compiler_) ||
      !goog.isDefAndNotNull(this.editor_)) {
    return;
  }
  var fnc = this.compiler_.currentFunc;

  while (!this.compiler_.isDone()) {
    this.stepRun_(true);

    if (fnc == this.compiler_.currentFunc) {
      break;
    }
  }
};


/**
 * Handler of the step back button click.
 * @export
 */
quantum.PlaygroundController.prototype.stepBack = function() {
  if (!goog.isDefAndNotNull(this.compiler_) ||
      !goog.isDefAndNotNull(this.editor_)) {
    return;
  }
  this.compiler_.stepBack();

  goog.array.forEach(this.compiler_.errors, goog.bind(function(err) {
    this.consoleOut(err);
  }, this));

  this.editor_.setCursor(this.compiler_.getCurrentLine(), 0);

  if (goog.isDefAndNotNull(this.compiler_.simulator)) {
    this.maxState = this.compiler_.simulator.getMaxAmplitude();
    requestAnimationFrame(goog.bind(this.animate, this));
  }

  this.callstack = this.compiler_.getCurrentCallStack();
  this.locals = this.compiler_.getCurrentLocals();
  this.state_ = null;
};


/**
 * Initializes the controller once shaders template has loaded.
 */
quantum.PlaygroundController.prototype.init = function() {
  var codeElement = goog.dom.getElement('codeeditor');

  if (!codeElement) {
    return;
  }

  this.editor_ = new CodeMirror(codeElement,
      /** @type {CodeMirror.EditorConfig} */({
        value: '',
        mode: 'qscript',
        tabSize: 2,
        indentUnit: 2,
        styleActiveLine: true,
        lineNumbers: true,
        gutters: ['breakpoints', 'CodeMirror-linenumbers']
      }));

  this.editor_.on('gutterClick', function(cm, n) {
    var info = cm.lineInfo(n);
    var marker = null;

    if (!info.gutterMarkers) {
      marker = document.createElement('div');
      marker.style.color = '#822';
      marker.innerHTML = '●';
    }
    cm.setGutterMarker(n, 'breakpoints', marker);
  });

  this.editor_.setSize(null, window.innerHeight * 0.65);

  var ph = window.innerHeight * 0.2 + 'px';
  goog.dom.getElement('output').style.height = ph;
  goog.dom.getElement('output').style.maxHeight = ph;
  goog.dom.getElement('callstack').style.height = ph;
  goog.dom.getElement('callstack').style.maxHeight = ph;
  goog.dom.getElement('locals').style.height = ph;
  goog.dom.getElement('locals').style.maxHeight = ph;

  this.canvas_ = goog.dom.getElement('glcanvas');

  var viewWidth = this.canvas_.offsetWidth;
  var viewHeight = Math.floor(window.innerHeight * 0.45);

  this.camera_ =
      new THREE.PerspectiveCamera(5, viewWidth / viewHeight, 1, 3000);
  this.camera_.position.z = 300;

  this.renderer_ = new THREE.WebGLRenderer({ canvas: this.canvas_ });
  this.renderer_.setSize(viewWidth, viewHeight);

  var overlay = goog.dom.getElement('gloverlay');
  overlay.style.top = this.canvas_.offsetTop + 'px';
  overlay.style.left = this.canvas_.offsetLeft + 'px';
  overlay.style.width = viewWidth + 'px';
  overlay.style.maxWidth = viewWidth + 'px';
  overlay.style.height = viewHeight + 'px';
  overlay.style.maxHeight = viewHeight + 'px';

  this.colorShader_ = new THREE.ShaderMaterial({
    uniforms: {
      norm: { type: 'f', value: 1.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: goog.dom.getElement('renderShader').textContent,
    fragmentShader: goog.dom.getElement('colorShader').textContent
  });

  this.colorPhaseShader_ = new THREE.ShaderMaterial({
    uniforms: {
      norm: { type: 'f', value: 1.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: goog.dom.getElement('renderShader').textContent,
    fragmentShader: goog.dom.getElement('colorPhaseShader').textContent
  });

  this.color3dShader_ = new THREE.ShaderMaterial({
    uniforms: {
      norm: { type: 'f', value: 1.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: goog.dom.getElement('render3dShader').textContent,
    fragmentShader: goog.dom.getElement('color3dShader').textContent
  });

  this.color3dShader2_ = new THREE.ShaderMaterial({
    uniforms: {
      norm: { type: 'f', value: 1.0 },
      texture: { type: 't', value: null }
    },
    vertexShader: goog.dom.getElement('render3dShader2').textContent,
    fragmentShader: goog.dom.getElement('color3dShader').textContent
  });

  this.scene_ = new THREE.Scene();
  this.mesh_ = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.colorShader_);

  this.scene_.add(this.mesh_);

  this.mesh_.translateZ(287);

  this.scene3d_ = new THREE.Scene();
  this.mesh3d_ = new THREE.Mesh(new THREE.PlaneGeometry(64, 64, 260, 260),
      this.color3dShader_);
  this.mesh3d_.rotation.x = -Math.PI * 0.3;
  this.color3dShader_.side = THREE.DoubleSide;
  this.color3dShader2_.side = THREE.DoubleSide;

  this.scene3d_.add(this.mesh3d_);

  this.camera3d_ =
      new THREE.PerspectiveCamera(35, viewWidth / viewHeight, 1, 3000);
  this.camera3d_.position.set(0, 5, 120);

  this.renderer_.autoClear = false;

  this.loadScript();
  this.loadComments();
};


/**
 * Toggles normalization of state vector view.
 * @export
 */
quantum.PlaygroundController.prototype.toggleNormalize = function() {
  this.normalize = !this.normalize;
  requestAnimationFrame(goog.bind(this.animate, this));
};


/**
 * Sets the current vector state view to 2D mode.
 * @export
 */
quantum.PlaygroundController.prototype.setView2D = function() {
  this.viewType = '2d';
  this.mesh_.material =
      /** @type {!THREE.MeshBasicMaterial} */(this.colorShader_);
  this.mesh_.material.needsUpdate = true;
  requestAnimationFrame(goog.bind(this.animate, this));
};


/**
 * Sets the current vector state view to 2D mode with phase as color.
 * @export
 */
quantum.PlaygroundController.prototype.setView2DPhase = function() {
  this.viewType = '2dPhase';
  this.mesh_.material =
      /** @type {!THREE.MeshBasicMaterial} */(this.colorPhaseShader_);
  this.mesh_.material.needsUpdate = true;
  requestAnimationFrame(goog.bind(this.animate, this));
};


/**
 * Sets the current vector state view to 3D mode.
 * @export
 */
quantum.PlaygroundController.prototype.setView3D = function() {
  this.viewType = '3d';
  this.mesh3d_.material =
      /** @type {!THREE.MeshBasicMaterial} */(this.color3dShader_);
  this.mesh3d_.material.needsUpdate = true;
  requestAnimationFrame(goog.bind(this.animate, this));
};


/**
 * Sets the current vector state view to 3D+ mode.
 * @export
 */
quantum.PlaygroundController.prototype.setView3D2 = function() {
  this.viewType = '3d+';
  this.mesh3d_.material =
      /** @type {!THREE.MeshBasicMaterial} */(this.color3dShader2_);
  this.mesh3d_.material.needsUpdate = true;
  requestAnimationFrame(goog.bind(this.animate, this));
};


/**
 * Handles mouse down event on GL container div.
 * @param {!angular.Scope.Event} $event Event object.
 * @export
 */
quantum.PlaygroundController.prototype.onMouseDown = function($event) {
  $event.preventDefault();
  this.lastX_ = $event.pageX;
  this.document_.on('mousemove', goog.bind(this.onMouseMove, this));
  this.document_.on('mouseup', goog.bind(this.onMouseUp, this));
};


/**
 * Rotates 3d view in Z axis by angle given as pixel vector.
 * @param {number} dx Rotation angle.
 * @return {boolean} True if rotation was applied.
 */
quantum.PlaygroundController.prototype.rotateView = function(dx) {
  if (Math.abs(dx) < 5) {
    return false;
  }

  this.mesh3d_.rotation.z += Math.PI * dx / 720;
  requestAnimationFrame(goog.bind(this.animate, this));
  return true;
};


/**
 * Handles mouse move event after click in GL container div.
 * @param {!angular.Scope.Event} $event Event object.
 * @export
 */
quantum.PlaygroundController.prototype.onMouseMove = function($event) {
  $event.preventDefault();

  if (this.rotateView($event.pageX - this.lastX_)) {
    this.lastX_ = $event.pageX;
  }
};


/**
 * Handles mouse up event after click in GL container div.
 * @param {!angular.Scope.Event} $event Event object.
 * @export
 */
quantum.PlaygroundController.prototype.onMouseUp = function($event) {
  $event.preventDefault();
  this.document_.unbind('mousemove');
  this.document_.unbind('mouseup');
};


/**
 * Handles touch start event on GL container div.
 * @param {!angular.Scope.Event} $event Event object.
 * @export
 */
quantum.PlaygroundController.prototype.onTouchStart = function($event) {
  $event.preventDefault();
  this.lastX_ = $event.touches[0].pageX;
  this.document_.on('touchmove', goog.bind(this.onTouchMove, this));
  this.document_.on('touchend', goog.bind(this.onTouchEnd, this));
};


/**
 * Handles touch move event after tap in GL container div.
 * @param {!angular.Scope.Event} $event Event object.
 * @export
 */
quantum.PlaygroundController.prototype.onTouchMove = function($event) {
  $event.preventDefault();

  if (this.rotateView($event.touches[0].pageX - this.lastX_)) {
    this.lastX_ = $event.touches[0].pageX;
  }
};


/**
 * Handles touch end event after tap in GL container div.
 * @param {!angular.Scope.Event} $event Event object.
 * @export
 */
quantum.PlaygroundController.prototype.onTouchEnd = function($event) {
  $event.preventDefault();
  this.document_.unbind('touchmove');
  this.document_.unbind('touchend');
};


/**
 * Gets quantum vector state from GPU through Simulator object.
 * @private
 */
quantum.PlaygroundController.prototype.loadState_ = function() {
  this.state_ = this.compiler_.simulator.getState();
  this.statePending_ = false;
};


/**
 * Handles mouse move event in GL container div to get values of states.
 * @param {!angular.Scope.Event} $event Event object.
 * @export
 */
quantum.PlaygroundController.prototype.onMouseHover = function($event) {
  if (!goog.isDefAndNotNull(this.compiler_) ||
      !goog.isDefAndNotNull(this.compiler_.simulator) ||
      this.statePending_) {
    return;
  }
  if (!goog.isDefAndNotNull(this.state_)) {
    this.statePending_ = true;
    // Getting state from GPU can take a while, so let's schedule immediate
    // timeout to avoid doing it inside the event.
    setTimeout(goog.bind(this.loadState_, this), 1);
    this.stateNumber = 0;
    this.stateRe = 0;
    this.stateIm = 0;
    return;
  }
  var gl = this.canvas_;
  var mouse = new THREE.Vector3(0, 0, 0);
  var projector = new THREE.Projector();

  mouse.x = ($event.pageX - gl.offsetLeft -
      gl.offsetParent.offsetLeft) / gl.offsetWidth * 2 - 1;
  mouse.y = ($event.pageY - gl.offsetTop -
      gl.offsetParent.offsetTop) / gl.offsetHeight * 2 - 1;
  mouse.z = 0.5;

  projector.unprojectVector(mouse, this.camera_);

  var ray = new THREE.Raycaster(this.camera_.position,
      mouse.sub(this.camera_.position).normalize(), 0, 3000);
  var intersects = ray.intersectObject(this.mesh_);

  if (intersects.length > 0) {
    var w = this.compiler_.simulator.texWidth;
    this.stateNumber = Math.floor((0.5 - intersects[0].point.y) * w) * w +
        Math.floor((0.5 + intersects[0].point.x) * w);
    this.stateRe = this.state_[this.stateNumber * 2];
    this.stateIm = this.state_[this.stateNumber * 2 + 1];
  }
};


/**
 * Returns normalization factor for quantum vector state.
 * @return {number} Current normalization factor.
 * @private
 */
quantum.PlaygroundController.prototype.getNorm_ = function getNorm() {
  return this.normalize ? 1.0 / this.maxState : 1.0;
};


/**
 * Draws one frame of state vector visualization.
 */
quantum.PlaygroundController.prototype.animate = function() {
  if (!goog.isDefAndNotNull(this.compiler_) ||
      !goog.isDefAndNotNull(this.compiler_.simulator)) {
    return;
  }
  this.renderer_.setRenderTarget();
  this.renderer_.clear();
  if (this.viewType == '2d') {
    this.colorShader_.uniforms.norm.value = this.getNorm_();
    this.colorShader_.uniforms.texture.value =
        this.compiler_.simulator.currentOutput;
    this.renderer_.render(this.scene_, this.camera_);
  } else if (this.viewType == '2dPhase') {
    this.colorPhaseShader_.uniforms.norm.value = this.getNorm_();
    this.colorPhaseShader_.uniforms.texture.value =
        this.compiler_.simulator.currentOutput;
    this.renderer_.render(this.scene_, this.camera_);
  } else if (this.viewType == '3d') {
    this.color3dShader_.uniforms.norm.value = this.getNorm_();
    this.color3dShader_.uniforms.texture.value =
        this.compiler_.simulator.currentOutput;
    this.renderer_.render(this.scene3d_, this.camera3d_);
  } else {
    this.color3dShader2_.uniforms.norm.value = this.getNorm_();
    this.color3dShader2_.uniforms.texture.value =
        this.compiler_.simulator.currentOutput;
    this.renderer_.render(this.scene3d_, this.camera3d_);
  }
};

quantum.App.controller('PlaygroundCtrl', quantum.PlaygroundController);
