/**
 * @fileoverview WebGL feature detecting library.
 * @suppress {missingProperties} ThreeJS main object is not compiled.
 */


/**
 * Object handling detection of Chrome, WebGL, and its features.
 */
quantum.WebGLDetector = {

  /**
   * @return {string} Warning message related to WebGL support.
   */
  getWebGLWarningMessage: function() {

    function webgl() {
      try {
        var canvas = document.createElement('canvas');
        return !!window.WebGLRenderingContext && (canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl'));
      } catch (e) {
        return false;
      }
    };

    var isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
    var msg = '';

    if (!isChrome) {
      msg += 'We strongly recommened to run Quantum Playground in ' +
          '<a href="https://www.google.com/intl/en/chrome/">' +
          'Google Chrome</a>.<br />';
    }

    if (!webgl()) {
      msg += window.WebGLRenderingContext ? [
        'Your graphics card does not seem to support ' +
        '<a href="http://khronos.org/webgl/wiki/' +
        'Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />',
        'Find out how to get it <a href="http://get.webgl.org/" ' +
        'style="color:#000">here</a>.'
      ].join('\n') : [
        'Your browser does not seem to support <a href="http://khronos.org/' +
        'webgl/wiki/Getting_a_WebGL_Implementation" ' +
        'style="color:#000">WebGL</a>.<br/>',
        'Find out how to get it <a href="http://get.webgl.org/" ' +
        'style="color:#000">here</a>.'
      ].join('\n');
      return msg;
    }
    if (msg.length != 0) {
      msg += '<br />';
    }
    var renderer = new THREE.WebGLRenderer();
    var gl = renderer.getContext();

    if (!gl.getExtension('OES_texture_float')) {
      msg += 'Your browser does not support float textures.<br />';
    }

    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) == 0) {
      msg += 'Your browser does not support vertex shader textures.<br />';
    }

    return msg;
  }
};
