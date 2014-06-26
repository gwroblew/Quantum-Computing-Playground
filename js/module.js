/**
 * @fileoverview Main app module.
 */

var quantum = {};

var goog = {
  bind: function(fn, selfObj, var_args) {
    if (arguments.length > 2) {
      var boundArgs = Array.prototype.slice.call(arguments, 2);
      return function() {
        // Prepend the bound arguments to the current arguments.
        var newArgs = Array.prototype.slice.call(arguments);
        Array.prototype.unshift.apply(newArgs, boundArgs);
        return fn.apply(selfObj, newArgs);
      };

    } else {
      return function() {
        return fn.apply(selfObj, arguments);
      };
    }
  },
  isDef: function(val) {
    return val !== void 0;
  },
  isDefAndNotNull: function(val) {
    return val != null;
  },
  dom: {
    getElement: function(el) {
      return document.getElementById(el);
    }
  },
  array: {
    forEach: function(arr, f, opt_obj) {
      var l = arr.length;
      for (var i = 0; i < l; i++) {
        if (i in arr) {
          f.call(opt_obj, arr[i], i, arr);
        }
      }
    },
    findIndex: function(arr, f, opt_obj) {
      var l = arr.length;
      for (var i = 0; i < l; i++) {
        if (i in arr && f.call(opt_obj, arr[i], i, arr)) {
          return i;
        }
      }
      return -1;
    },
    find: function(arr, f, opt_obj) {
      var i = goog.array.findIndex(arr, f, opt_obj);
      return i < 0 ? null : arr[i];
    }
  }
};


/**
 * The angular module for tabbed view of debug information.
 * @type {!angular.Module}
 */
var components = angular.module('components', []);

components.directive('tabs', function() {
  return {
    restrict: 'E',
    transclude: true,
    scope: {},
    controller: function($scope, $element) {
      var panes = $scope.panes = [];

      $scope.select = function(pane) {
        angular.forEach(panes, function(pane) {
          pane.selected = false;
        });
        pane.selected = true;
      };

      this.addPane = function(pane) {
        if (panes.length == 0) {
          $scope.select(pane);
        }
        panes.push(pane);
      };
    },
    template:
        '<div class="tabbable">' +
        '<ul class="nav nav-tabs">' +
        '<li ng-repeat="pane in panes" ng-class="{active:pane.selected}">' +
            '<a href="" ng-click="select(pane)">{{pane.title}}</a>' +
        '</li>' +
        '</ul>' +
        '<div class="tab-content" ng-transclude></div>' +
        '</div>',
    replace: true
  };
});

components.directive('pane', function() {
  return {
    require: '^tabs',
    restrict: 'E',
    transclude: true,
    scope: { title: '@' },
    link: function(scope, element, attrs, tabsCtrl) {
      tabsCtrl.addPane(scope);
    },
    template:
        '<div class="tab-pane" ng-class="{active: selected}" ng-transclude>' +
        '</div>',
    replace: true
  };
});

components.directive('onTouch',
    /**
     * Compiler has problems with attrs.onTouch and $eval() output here.
     * @suppress {missingProperties}
     */
    function() {
      return {
        restrict: 'A',
        link: function(scope, elm, attrs) {
          var ontouchFn = scope.$eval(attrs.onTouch);
          elm.bind('touchstart', function(evt) {
            scope.$apply(function() {
              // TODO(musashi): Figure out a better way to bind.
              ontouchFn.call(scope.ctrl, evt);
            });
          });
        }
      };
    });

components.directive('onloaded', function() {
  return {
    link: function(scope, element, attrs) {
      element.bind('load' , function(e) {
        scope.loaded++;
      });
    }
  };
});


/**
 * The angular module for the main app.
 * @type {!angular.Module}
 */
quantum.App = angular.module('QuantumApp',
    ['ngRoute', 'ngSanitize', 'ngTouch', components.name]);


/**
 * Built-in script examples identifiers.
 * @enum {string}
 */
quantum.App.Examples = {
  DEFAULT: '2000001',
  QSCRIPT_BASIC: '1010001',
  QSCRIPT_SYNTAX: '4000001',
  GATES_HADAMARD: '5000001',
  QSCRIPT_COMMANDS: '3010001',
  GROVERS: '1000001',
  SHORS: '10001',
  GATES_REVERSIBLE: '2000002',
  WALK_THROUGH: '3000001',
  ANNEALING: '5661458385862656',
  ALL_GATES: '5000002',
  SHORS_LIBQUANTUM: '2',
  FREE_6: '5689792285114368',
  FREE_7: '5697982787747840',
  FREE_8: '5709068098338816',
  FREE_9: '5718998062727168',
  FREE_10: '5728116278296576',
  FREE_11: '5747976207073280',
  FREE_12: '5754903989321728',
  FREE_13: '6216114757435392'
};


/**
 * Routing setup for top level navigation.
 */
quantum.App.config(function($routeProvider, $locationProvider, $httpProvider) {
  $routeProvider.when('/home',
      {
        templateUrl: 'home.html',
        controller: 'HomeCtrl'
      });
  $routeProvider.when('/about',
      {
        templateUrl: 'about.html',
        controller: 'AboutCtrl'
      });
  $routeProvider.when('/playground/:qscriptId',
      {
        templateUrl: 'playground.html',
        controller: 'PlaygroundCtrl',
        controllerAs: 'ctrl'
      });
  $routeProvider.when('/myscripts',
      {
        templateUrl: 'myscripts.html',
        controller: 'MyScriptsCtrl'
      });
  $routeProvider.when('/demo',
      {
        templateUrl: 'demo.html',
        controller: 'DemoCtrl'
      });
  $routeProvider.otherwise(
      {
        redirectTo: '/home',
        controller: 'HomeCtrl'
      });

});


/**
 * Main top level navigation controller.
 */
quantum.App.controller('NavCtrl',
    function($rootScope, $scope, $location, $http) {
      $scope.navClass = function(page) {
        var currentRoute = $location.path().substring(1) || 'home';
        if (page == 'myscripts' && $rootScope.userinfo.nickname.length == 0) {
          return 'disabled';
        }
        return page === currentRoute ? 'active' : '';
      };
      $scope.loadHome = function() {
        $location.url('/home');
      };
      $scope.loadAbout = function() {
        $location.url('/about');
      };
      $scope.loadMyScripts = function() {
        $location.url('/myscripts');
      };
      $scope.loadPlayground = function(id) {
        if (!goog.isDefAndNotNull(id)) {
          id = $rootScope.lastQScriptId;
        }
        $location.url('/playground/' + id);
      };
      $scope.loadDemo = function() {
        $location.url('/demo');
      };

      $scope.examples = quantum.App.Examples;

      var msg = quantum.WebGLDetector.getWebGLWarningMessage();

      $scope.showWebGLWarning = msg.length != 0;
      $scope.webGLWarningMessage = msg;

      /**
       * Id of the last script opened in the Playground tab.
       * @type {string}
       */
      $rootScope.lastQScriptId = quantum.App.Examples.DEFAULT;

      /**
       * User information to display.
       * @type {!Object}
       */
      $rootScope.userinfo = {nickname: '', login: ''};

      /**
       * Location saved to provide absolute URL in template for social links.
       * @type {!angular.$location}
       */
      $rootScope.location = $location;
      $rootScope.urlEncode = function(url) {
        return encodeURIComponent(url);
      };

      $http.get('/getuserinfo').
          success(function(data, status, headers, config) {
            $rootScope.userinfo = data;
          });
    });

quantum.App.controller('AboutCtrl', function($scope, $compile) {
});

quantum.App.controller('HomeCtrl', function($scope, $compile) {
});

quantum.App.controller('MyScriptsCtrl',
    function($rootScope, $scope, $location, $http) {

      $scope.loadPlayground = function(id) {
        $location.url('/playground/' + id);
      };

      /**
       * List of scripts created by currently logged in user.
       * @type {!Array}
       */
      $scope.myscripts = [];

      $http.get('/loadmyscripts').
          success(function(data, status, headers, config) {
            $scope.myscripts = data;
          });
    });
