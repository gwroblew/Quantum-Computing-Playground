/**
 * @fileoverview Quantum Playground Demo.
 */


/**
 * @param {!angular.Scope} $scope The scope for this controller.
 * @constructor
 * @ngInject
 * @export
 */
quantum.DemoController = function($scope) {

  /**
   * Number of loaded images.
   * @type {number}
   */
  $scope.loaded = 0;

  /**
   * @type {string}
   */
  $scope.demoText = '';

  /** @private {!angular.Scope} */
  this.scope_ = $scope;

  /**
   * @type {number}
   * @const
   */
  this.IMAGES = 7;

  setTimeout(goog.bind(this.checkLoaded, this), 200);
};


/**
 * Updates progress bar and launches demo.
 */
quantum.DemoController.prototype.checkLoaded = function() {
  var value = Math.floor(100 * this.scope_.loaded / this.IMAGES);
  var div = goog.dom.getElement('progress-div');
  var span = goog.dom.getElement('progress-span');
  var scope = this.scope_;
  var demoStep = 0;
  var demoData = [
    {
      next: false,
      cmd: ['show', '#page06', '0', '0', '1200px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 600, 60],
      text: 'Select an example script<br />from the list.'
    },
    {
      next: false,
      cmd: ['show', '#page01', '0', '0', '1200px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 670, 30],
      text: 'Click "Compile" to run in-browser compilation.<br />' +
          'Check console window for errors.'
    },
    {
      next: false,
      cmd: ['show', '#page02', '-470px', '-20px', '2000px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 710, 30],
      text: 'Click "Run" to execute script.<br />' +
          'Observe changing state in the view window.'
    },
    {
      next: false,
      cmd: ['show', '#page03', '-270px', '-10px', '1600px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 800, 30],
      text: 'Execute script step-by-step,<br />forward or backward.'
    },
    {
      next: false,
      cmd: ['show', '#page04', '0px', '0px', '1200px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 300, 230],
      text: 'Use mouse or touch to rotate 3D view.'
    },
    {
      next: false,
      cmd: ['show', '#page05', '-200px', '-100px', '1600px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 300, 330],
      text: 'Hover over the state view in 2D<br />to see value of states.'
    },
    {
      next: false,
      cmd: ['show', '#page07', '-600px', '-400px', '2000px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 470, 210],
      text: 'Click on source code line<br />to place or remove breakpoint.'
    },
    {
      next: false,
      cmd: ['show', '#page07', '-500px', '0px', '1600px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 970, 40],
      text: 'Make a copy<br />of an example.'
    },
    {
      next: false,
      cmd: ['show', '#page06', '0px', '0px', '1200px'],
      text: ''
    },
    {
      next: true,
      cmd: ['arrow', 600, 200],
      text: 'Go play!'
    }
  ];
  var prevPage = '', hidePage = '';

  function animPause() {
    setTimeout(animStep, 3000);
  }
  function animStep() {
    var step = demoData[demoStep++];
    var next = animStep;

    if (step.next) {
      next = animPause;
      scope.demoText = step.text;
      if (step.cmd[0] == 'arrow') {
        $('#demotext').css({
          left: step.cmd[1] - 20 + 'px',
          top: step.cmd[2] + 60 + 'px'
        });
      }
      scope.$apply();
    }
    if (demoStep == demoData.length) {
      next = undefined;
    }
    if (hidePage != '') {
      $(hidePage).css({display: 'none'});
      hidePage = '';
    }
    if (step.cmd[0] == 'show') {
      var lastWidth = '1200px';
      var lastLeft = '0px';
      var lastTop = '0px';

      if (prevPage != '') {
        if (prevPage != step.cmd[1]) {
          hidePage = prevPage;
        }
        scope.demoText = '';
        scope.$apply();
        lastLeft = $(prevPage).position().left + 'px';
        lastTop = $(prevPage).position().top + 'px';
        lastWidth = $(prevPage).width() + 'px';
      }
      if (prevPage != step.cmd[1]) {
        $(step.cmd[1]).removeClass('preload');
        $(step.cmd[1]).addClass('demo-show');
        $(step.cmd[1]).css({
          display: 'block',
          opacity: 0,
          left: lastLeft,
          top: lastTop,
          width: lastWidth,
          'z-index': 100 + demoStep * 10
        });
      }
      prevPage = step.cmd[1];
      $(step.cmd[1]).animate({
        left: step.cmd[2],
        top: step.cmd[3],
        width: step.cmd[4],
        opacity: 1
      }, 1000, next);
    } else if (step.cmd[0] == 'arrow') {
      $('#arrow').animate({
        left: step.cmd[1] + 'px',
        top: step.cmd[2] + 'px'
      }, 1000, next);
    }
  };

  div.attributes['aria-valuenow'] = value;
  div.style.width = value + '%';
  span.innerText = value + '% Complete';

  if (this.scope_.loaded != this.IMAGES) {
    setTimeout(goog.bind(this.checkLoaded, this), 200);
  } else {
    goog.dom.getElement('loader').style.display = 'none';
    $('#arrow').css({
      display: 'block',
      position: 'absolute',
      left: '100px',
      top: '100px'
    });
    animStep();
  }
};

quantum.App.controller('DemoCtrl', quantum.DemoController);
