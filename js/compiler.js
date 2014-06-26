/**
 * @fileoverview Compiler of QScript language.
 */


/**
 * Wraps quantum computer simulator script compiler and execution engine.
 * @param {!THREE.WebGLRenderer} renderer ThreeJS WebGL renderer object.
 * @param {function(string, Array)} callback Callback function for builtin calls
 *     from within the script.
 * @param {function(string)=} opt_evalprov Expression evaluation provider.
 * @constructor
 * @struct
 * @final
 */
quantum.QScript = function(renderer, callback, opt_evalprov) {

  /**
   * Function evaluating JavaScript expressions.
   * @private {!function(string)}
   */
  this.eval_ = goog.isDef(opt_evalprov) ? opt_evalprov : eval;

  /**
   * List of strings representing lines of script.
   * @private {!Array.<string>}
   */
  this.text_ = [];

  /**
   * Main function of the script (top level).
   * @type {quantum.QScript.Func}
   */
  this.main = null;

  /**
   * List of compilation errors and messages.
   * @type {!Array.<string>}
   */
  this.errors = [];

  /**
   * Currently executed function.
   * @type {quantum.QScript.Func}
   */
  this.currentFunc = null;

  /**
   * Currently executed step.
   * @type {number}
   */
  this.currentStep = 0;

  /**
   * Current execution callstack. Each frame is a pair of function object
   * and step number to return to.
   * @type {!Array.<!Array>}
   */
  this.callStack = [];

  /**
   * ThreeJS WebGL renderer object.
   * @private {!THREE.WebGLRenderer}
   */
  this.renderer_ = renderer;

  /**
   * Simulator engine object.
   * @type {quantum.Simulator}
   */
  this.simulator = null;

  /**
   * Callback for builtin functions.
   * @private {function(string, Array)}
   */
  this.callback_ = callback;

  /**
   * Array of builtin functions and gates.
   * @private {!Array.<!quantum.QScript.Func>}
   */
  this.builtins_ = quantum.QScript.getBuiltins();

  /**
   * Array of execution steps data.
   * @private {!Array.<!quantum.QScript.StepData>}
   */
  this.history_ = [];

  /**
   * List of variables changed during step execution.
   * @private {!Array.<string>}
   */
  this.savedVars_ = [];

  /**
   * List of values of variables changed during step execution.
   * @private {!Array}
   */
  this.savedValues_ = [];

  /**
   * Value measured by partial or complete measurement function.
   * @type {number|string}
   */
  this.measuredValue = 'unknown';

  /**
   * Current quantum vector size.
   * @type {number}
   */
  this.vectorSize = 0;
};


/**
 * Name of the variable holding measured value.
 * @type {string}
 */
quantum.QScript.MEASURED_VALUE = 'measured_value';


/**
 * Prefix for JavaScript object holding script variables.
 * @type {string}
 */
quantum.QScript.VARS_PREFIX = 'window.';


/**
 * Token identifier type.
 * @type {number}
 */
quantum.QScript.ID = 1;


/**
 * Token expression type.
 * @type {number}
 */
quantum.QScript.EXPRESSION = 2;


/**
 * Token separator type.
 * @type {number}
 */
quantum.QScript.SEPARATOR = 3;


/**
 * Returns array of built in functions.
 * @return {!Array.<!quantum.QScript.Func>}
 */
quantum.QScript.getBuiltins = function() {
  var arr = [
    new quantum.QScript.Func(null, 'VectorSize', '', ['vectorbits'],
      function(q, argv) {
        q.init(argv[0]);
      }),
    new quantum.QScript.Func(null, 'Decoherence', '', ['strength'],
      function(q, argv) {
        q.simulator.applyDecoherence(argv[0]);
      }),
    new quantum.QScript.Func(null, 'Hadamard', '', ['bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyHadamard(argv[0]);
      }),
    new quantum.QScript.Func(null, 'SigmaX', '', ['bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applySigmaX(argv[0]);
      }),
    new quantum.QScript.Func(null, 'SigmaY', '', ['bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applySigmaY(argv[0]);
      }),
    new quantum.QScript.Func(null, 'SigmaZ', '', ['bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applySigmaZ(argv[0]);
      }),
    new quantum.QScript.Func(null, 'Unitary', '', ['bitn', 'r00', 'i00', 'r01', 'i01',
                                          'r10', 'i10', 'r11', 'i11'],
      function(q, argv) {
        var i, m = { re: [], im: [] };
        if (!q.checkBound(argv[0])) {
          return;
        }
        for (i = 1; i <= 7; i += 2) {
          m.re.push(argv[i]);
          m.im.push(argv[i + 1]);
        }
        q.simulator.renderUnitary(argv[0], m);
      }),
    new quantum.QScript.Func(null, 'Rx', '', ['bitn', 'theta'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyRx(argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'Ry', '', ['bitn', 'theta'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyRy(argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'Rz', '', ['bitn', 'alpha'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyRz(argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'CNot', '', ['bitc', 'bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0]) || !q.checkBound(argv[1])) {
          return;
        }
        q.simulator.applyCNot(argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'Swap', '', ['bit1', 'bit2'],
      function(q, argv) {
        if (!q.checkBound(argv[0]) || !q.checkBound(argv[1])) {
          return;
        }
        q.simulator.applySwap(argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'Toffoli', '',
      ['bitc1', 'bitc2', 'bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0]) || !q.checkBound(argv[1]) ||
            !q.checkBound(argv[2])) {
          return;
        }
        q.simulator.applyToffoli(argv[0], argv[1], argv[2]);
      }),
    new quantum.QScript.Func(null, 'Phase', '', ['bitn', 'angle'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyCPhaseShift(argv[0], argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'CPhase', '', ['bitc', 'bitn', 'angle'],
      function(q, argv) {
        if (!q.checkBound(argv[0]) || !q.checkBound(argv[1])) {
          return;
        }
        q.simulator.applyCPhaseShift(argv[0], argv[1], argv[2]);
      }),
    new quantum.QScript.Func(null, 'QFTCPhase', '', ['bitc', 'bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0]) || !q.checkBound(argv[1])) {
          return;
        }
        if (argv[0] <= argv[1]) {
          q.errors.push('Error: For QFTCPhase control qbit must be above ' +
              'the target qbit.');
          return;
        }
        q.simulator.applyPhaseShift(argv[0], argv[1], 1.0);
      }),
    new quantum.QScript.Func(null, 'InvQFTCPhase', '', ['bitc', 'bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0]) || !q.checkBound(argv[1])) {
          return;
        }
        if (argv[0] <= argv[1]) {
          q.errors.push('Error: For InvQFTCPhase control qbit must be above ' +
              'the target qbit.');
          return;
        }
        q.simulator.applyPhaseShift(argv[0], argv[1], -1.0);
      }),
    new quantum.QScript.Func(null, 'QFT', '', ['offset', 'width'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyQFT(argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'InvQFT', '', ['offset', 'width'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyInvQFT(argv[0], argv[1]);
      }),
    new quantum.QScript.Func(null, 'ExpModN', '', ['x', 'N', 'width'],
      function(q, argv) {
        if (!q.checkBound(argv[2])) {
          return;
        }
        q.simulator.applyExpModN(argv[0], argv[1], argv[2]);
      }),
    new quantum.QScript.Func(null, 'RevExpModN', '', ['x', 'N', 'width'],
      function(q, argv) {
        if (!q.checkBound(argv[2])) {
          return;
        }
        q.simulator.applyRevExpModN(argv[0], argv[1], argv[2]);
      }),
    new quantum.QScript.Func(null, 'ShiftLeft', '', ['bits'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyShiftLeft(argv[0]);
      }),
    new quantum.QScript.Func(null, 'ShiftRight', '', ['bits'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.simulator.applyShiftRight(argv[0]);
      }),
    new quantum.QScript.Func(null, 'MeasureBit', '', ['bitn'],
      function(q, argv) {
        if (!q.checkBound(argv[0])) {
          return;
        }
        q.measuredValue = q.simulator.applyBitMeasure(argv[0]);
      }),
    new quantum.QScript.Func(null, 'Measure', '', [],
      function(q, argv) {
        q.measuredValue = q.simulator.applyMeasure();
      }),
    new quantum.QScript.Func(null, 'Print', '', ['msg'],
      function(q, argv) {
        q.callback_('Print', argv);
      }),
    new quantum.QScript.Func(null, 'Breakpoint', '', [],
      function(q, argv) {
        q.callback_('Breakpoint', argv);
      }),
    new quantum.QScript.Func(null, 'Delay', '', ['time_ms'],
      function(q, argv) {
        q.callback_('Delay', argv);
      }),
    new quantum.QScript.Func(null, 'Display', '', ['msg'],
      function(q, argv) {
        q.callback_('Display', argv);
      }),
    new quantum.QScript.Func(null, 'SetViewAngle', '', ['angle'],
      function(q, argv) {
        q.callback_('SetViewAngle', argv);
      }),
    new quantum.QScript.Func(null, 'SetViewMode', '', ['mode'],
      function(q, argv) {
        q.callback_('SetViewMode', argv);
      })
  ];

  return arr;
};



/**
 * Represents a function in the script.
 * @param {?quantum.QScript.Func} parent Parent function (null for main script).
 * @param {string} name Function identifier.
 * @param {string} desc Description of the function.
 * @param {!Array.<string>} args List of parameter identifiers.
 * @param {?function(QScript, Array)} exec Execute function for builtins.
 * @constructor
 * @struct
 */
quantum.QScript.Func = function(parent, name, desc, args, exec) {

  /**
   * Parent function.
   * @type {?quantum.QScript.Func}
   */
  this.parent = parent;

  /**
   * Function name / identifier.
   * @type {string}
   */
  this.name = name;

  /**
   * Function description.
   * @type {string}
   */
  this.description = desc;

  /**
   * List of parameter identifiers.
   * @type {!Array.<string>}
   */
  this.args = args;

  /**
   * JavaScript function to execute as builtin.
   * @type {?function(QScript, Array)}
   */
  this.execute = exec;

  /**
   * Container of child functions.
   * @type {!Object}
   */
  this.functions = {};

  /**
   * Compiled script bytecode.
   * @type {!Array.<!quantum.QScript.Opcode>}
   */
  this.code = [];

  /**
   * Last compiled line (used during compilation).
   * @type {number}
   */
  this.lastLine = -1;

  /**
   * Container of local variables.
   * @type {!Object}
   */
  this.locals = {};

  /**
   * List of local variables (for debug info).
   * @type {!Array.<string>}
   */
  this.localIds = [];

  /**
   * Expression for evaluating values of local variables.
   * @type {string}
   */
  this.localExpr = '';
};



/**
 * Represents a lexical token in the script line.
 * @param {number} type Token type (ID, EXPRESSION, SEPARATOR).
 * @param {string} str Token string.
 * @constructor
 * @struct
 */
quantum.QScript.Token = function(type, str) {

  /**
   * Type of token.
   * @type {number}
   */
  this.type = type;

  /**
   * Body of token.
   * @type {string}
   */
  this.body = str;
};



/**
 * Container object for saved values of variables for each step.
 * @param {!Array.<string>} syms List of variables affected by this step.
 * @param {!Array} vals List of original values before the step executed.
 * @param {!quantum.QScript.Func} fn Function object of the step.
 * @param {number} step Step index in the function opcode array.
 * @constructor
 * @struct
 */
quantum.QScript.StepData = function(syms, vals, fn, step) {

  /**
   * List of variables affected by this step.
   * @type {!Array.<string>}
   */
  this.symbols = syms;

  /**
   * List of values before the step executed.
   * @type {!Array}
   */
  this.values = vals;

  /**
   * Original function of the step.
   * @type {!quantum.QScript.Func}
   */
  this.func = fn;

  /**
   * Step index in the function opcode array.
   * @type {number}
   */
  this.step = step;
};


/**
 * Code of command for the execution engine.
 * @enum {string}
 */
quantum.QScript.CommandCode = {
  FOR_INIT: '#fi',
  FOR_LOOP: '#fl',
  FOR_END: '#fe',
  EXPRESSION: '#ex',
  IF: '#if',
  ELSE: '#el',
  ENDIF: '#ei',
  RETURN: '#rt',
  BREAK: '#br'
};



/**
 * Represents opcode describing execution operation.
 * @param {string|!quantum.QScript.Func} cmd Command or function to execute.
 * @param {Array.<!Array.<!quantum.QScript.Token>>} args Values of arguments
 *     for the command.
 * @param {number} line Line number in the script source.
 * @param {number} target Index of the potential target command.
 * @constructor
 * @struct
 */
quantum.QScript.Opcode = function(cmd, args, line, target) {

  /**
   * Command to execute.
   * @type {string|!quantum.QScript.Func}
   */
  this.command = cmd;

  /**
   * Values of arguments for the command.
   * @type {Array.<!Array.<!quantum.QScript.Token>>}
   */
  this.args = args;

  /**
   * Line number in the source script.
   * @type {number}
   */
  this.line = line;

  /**
   * Index of the target opcode (if any, used in branches).
   * @type {number}
   */
  this.target = target;
};


/**
 * Initializes execution engine for given vector size.
 * @param {number} vs State vector size in qbits, between 6 and 22.
 */
quantum.QScript.prototype.init = function(vs) {
  if (vs < 6 || vs > 22 || (vs & 1) != 0) {
    this.errors.push(
        'State vector size outside of supported range 6..22 or not even: ' +
        vs);
    return;
  }
  this.vectorSize = vs;
  this.simulator = new quantum.Simulator(this.renderer_, vs);
  this.simulator.init();
};


/**
 * Verifies if qubit number is within vector size range.
 * @param {number} qbit Number of qubit in vector state.
 * @return {boolean} False when qubit number is outside of current vector size.
 */
quantum.QScript.prototype.checkBound = function(qbit) {
  if (qbit < 0 || qbit >= this.vectorSize) {
    this.errors.push('Qubit number out of range: ' + qbit);
    return false;
  }
  return true;
};


/**
 * Tokenizes one line of script code.
 * State transition table (star indicates token emit):
 *
 * S - space, tab, etc.
 * D - digits
 * I - identifier characters
 * = - = character
 * , - , or ; characters
 * " - " character
 * X - all other characters
 *
 *     0  1  2  3  4
 * -----------------
 * S | 0  0* 0* 0* 4
 * D | 1  1  2  1* 4
 * I | 2  2  1* 1* 4
 * = | 3  3* 3* 2  4
 * , | 0* 0* 0* 0* 4
 * " | 4  4* 4* 4* 0
 * X | 2  2* 2  2* 4
 *
 * @param {string} line One line of script code.
 * @return {!Array.<!quantum.QScript.Token>} List of tokens.
 */
quantum.QScript.prototype.tokenize = function(line) {
  var i;
  var tokens = [];
  var state = 0;
  var body = '';
  var idxCmt = line.indexOf('//');

  if (idxCmt < 0) {
    idxCmt = line.length;
  }

  // Typical implementation of state-based lexer.
  for (i = 0; i < idxCmt; i++) {
    // c holds the current character.
    var c = line[i];
    if (c <= ' ') {
      switch (state) {
        case 0:
          break;
        case 1:
          tokens.push(new quantum.QScript.Token(quantum.QScript.ID, body));
          state = 0;
          break;
        case 2:
        case 3:
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          state = 0;
          break;
        case 4:
          body += c;
          break;
      }
    } else if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
               (c >= '0' && c <= '9') || c == '_' || c == '.') {
      switch (state) {
        case 0:
          body = c;
          if (c < '0' || c > '9') {
            state = 1;
          } else {
            state = 2;
          }
          break;
        case 1:
        case 4:
          body += c;
          break;
        case 2:
          if (c >= '0' && c <= '9') {
            body += c;
            break;
          }
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          body = c;
          state = 1;
          break;
        case 3:
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          body = c;
          state = 1;
          break;
      }
    } else if (c == ';' || c == ',') {
      switch (state) {
        case 0:
          tokens.push(new quantum.QScript.Token(quantum.QScript.SEPARATOR, c));
          state = 0;
          break;
        case 1:
          tokens.push(new quantum.QScript.Token(quantum.QScript.ID, body));
          tokens.push(new quantum.QScript.Token(quantum.QScript.SEPARATOR, c));
          state = 0;
          break;
        case 2:
        case 3:
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          tokens.push(new quantum.QScript.Token(quantum.QScript.SEPARATOR, c));
          state = 0;
          break;
        case 4:
          body += c;
          break;
      }
    } else if (c == '=') {
      switch (state) {
        case 0:
          body = c;
          state = 3;
          break;
        case 1:
          tokens.push(new quantum.QScript.Token(quantum.QScript.ID, body));
          body = c;
          state = 3;
          break;
        case 2:
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          body = c;
          state = 3;
          break;
        case 3:
          body += c;
          state = 2;
          break;
        case 4:
          body += c;
          break;
      }
    } else if (c == '"') {
      switch (state) {
        case 0:
          body = c;
          state = 4;
          break;
        case 1:
          tokens.push(new quantum.QScript.Token(quantum.QScript.ID, body));
          body = c;
          state = 4;
          break;
        case 2:
        case 3:
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          body = c;
          state = 4;
          break;
        case 4:
          body += c;
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          state = 0;
          break;
      }
    } else {
      switch (state) {
        case 0:
          body = c;
          state = 2;
          break;
        case 1:
          tokens.push(new quantum.QScript.Token(quantum.QScript.ID, body));
          body = c;
          state = 2;
          break;
        case 2:
        case 4:
          body += c;
          break;
        case 3:
          tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
          body = c;
          state = 2;
          break;
      }
    }
  }
  switch (state) {
    case 1:
      tokens.push(new quantum.QScript.Token(quantum.QScript.ID, body));
      break;
    case 2:
    case 3:
    case 4:
      tokens.push(new quantum.QScript.Token(quantum.QScript.EXPRESSION, body));
      break;
  }
  return tokens;
};


/**
 * Parses a list of expressions separated by , or ;.
 * @param {!Array.<!quantum.QScript.Token>} tokens Tokenized line of script.
 * @param {number} idx Starting index in tokens array.
 * @return {!Array.<!Array.<!quantum.QScript.Token>>} List of tokenized
 *     expressions.
 */
quantum.QScript.prototype.parseExpressions = function(tokens, idx) {
  var j;
  var exp = [];
  var expr = [];
  var i = idx;
  var parcnt = 0;

  while (i < tokens.length) {
    if (tokens[i].type == quantum.QScript.SEPARATOR && parcnt == 0) {
      exp.push(expr);
      expr = [];
      i++;
      continue;
    }

    for (j = 0; j < tokens[i].body.length; j++) {
      if (tokens[i].body[j] == '(') {
        parcnt++;
      }
      if (tokens[i].body[j] == ')') {
        parcnt--;
      }
    }

    expr.push(tokens[i]);
    i++;
  }
  exp.push(expr);
  return exp;
};


/**
 * Builds array of local identifiers and expressions used to get their values.
 * @param {!quantum.QScript.Func} f Function object.
 */
quantum.QScript.prototype.buildLocals = function(f) {
  var l;
  var ids = [];
  var expr = '[';

  // The final expression to get values looks like this:
  // [func_var1,func_var2,...,0]
  // where 'func' is the script function name and 'var1', 'var2' are local
  // variables. That way we can get all the values with single eval.
  for (l in f.locals) {
    ids.push(l);

    if (l[0] == '_') {
      expr += quantum.QScript.VARS_PREFIX + '_' + l + ',';
    } else {
      expr += quantum.QScript.VARS_PREFIX + f.name + '_' + l + ',';
    }
  }
  expr += '0]';
  f.localIds = ids;
  f.localExpr = expr;
};


/**
 * Finds function given an identifier.
 * @param {quantum.QScript.Func} fn Function to start the search from.
 * @param {string} name Identifier of function to find.
 * @return {quantum.QScript.Func} Function or null if not found.
 */
quantum.QScript.prototype.findFunction = function(fn, name) {
  // Walk up the scope tree to find the function by its identifier.
  while (fn != null) {
    if (fn.functions.hasOwnProperty(name)) {
      return fn.functions[name];
    }
    fn = fn.parent;
  }
  return null;
};


/**
 * Compiles one function from the full body of script code.
 * @param {quantum.QScript.Func} parent Parent function.
 * @param {string} fn Function identifier.
 * @param {!Array.<string>} args List of argument names.
 * @param {number} line Starting line for function compilation.
 * @return {!quantum.QScript.Func} Compiled function object.
 */
quantum.QScript.prototype.compileFunction = function(parent, fn, args, line) {
  var i;
  var j;
  var f = new quantum.QScript.Func(parent, fn, '', args, null);
  var forStack = [];
  var ifStack = [];

  while (line < this.text_.length) {
    // We grab one line from the script code until the end of the function,
    // but functions themselves are compiled recursively.
    var l = this.text_[line].trim();

    line++;
    // Skip one-line comments.
    if (l.length == 0 || l.substr(0, 2) == '//') {
      continue;
    }

    // t holds a tokenized line.
    var t = this.tokenize(l);

    // Handle single-word keywords.
    if (t.length == 1 && t[0].type == quantum.QScript.ID) {
      if (t[0].body == 'endfor') {
        if (forStack.length == 0) {
          this.errors.push('"endfor" without matching "for" in line ' + line);
          continue;
        }
        j = forStack.pop();
        f.code[j].target = f.code.length;
        f.code[j + 1].target = f.code.length;
        f.code.push(
            new quantum.QScript.Opcode(quantum.QScript.CommandCode.FOR_END, null, line, j + 1));
        continue;
      }
      if (t[0].body == 'else') {
        if (ifStack.length == 0) {
          this.errors.push('"else" without matching "if" in line ' + line);
          continue;
        }
        j = ifStack.pop();
        f.code[j].target = f.code.length;
        ifStack.push(f.code.length);
        f.code.push(
            new quantum.QScript.Opcode(quantum.QScript.CommandCode.ELSE, null, line, j + 1));
        continue;
      }
      if (t[0].body == 'endif') {
        if (ifStack.length == 0) {
          this.errors.push('"endif" without matching "if" in line ' + line);
          continue;
        }
        j = ifStack.pop();
        f.code[j].target = f.code.length;
        f.code.push(
            new quantum.QScript.Opcode(quantum.QScript.CommandCode.ENDIF, null, line, j + 1));
        continue;
      }
      if (t[0].body == 'continue') {
        if (forStack.length == 0) {
          this.errors.push('"continue" without matching "for" in line ' + line);
          continue;
        }
        j = forStack.pop();
        forStack.push(j);
        f.code.push(
            new quantum.QScript.Opcode(quantum.QScript.CommandCode.FOR_END, null, line, j + 1));
        continue;
      }
      if (t[0].body == 'break') {
        if (forStack.length == 0) {
          this.errors.push('"break" without matching "for" in line ' + line);
          continue;
        }
        j = forStack.pop();
        forStack.push(j);
        f.code.push(
            new quantum.QScript.Opcode(quantum.QScript.CommandCode.BREAK, null, line, j + 1));
        continue;
      }
      if (t[0].body == 'return') {
        f.code.push(
            new quantum.QScript.Opcode(quantum.QScript.CommandCode.RETURN, null, line, -1));
        continue;
      }
      if (t[0].body == 'endproc') {
        f.lastLine = line - 1;
        this.buildLocals(f);
        return f;
      }
      // Possibility that single identifier is a builtin function call of
      // a function with no arguments.
      for (i = 0; i < this.builtins_.length; i++) {
        if (this.builtins_[i].name == t[0].body) {
          if (this.builtins_[i].args.length != 0) {
            this.errors.push('Wrong number of arguments in line ' + line);
            break;
          }
          f.code.push(new quantum.QScript.Opcode(this.builtins_[i], [], line, -1));
          break;
        }
      }
      if (i != this.builtins_.length)
        // Builtin function call handled, so we can continue.
        continue;
      var fc = this.findFunction(f, t[0].body);
      // Same possibility, but for a script function.
      if (fc != null) {
        f.code.push(new quantum.QScript.Opcode(fc, [], line, -1));
        continue;
      }
    }
    // By now we expect to have at least two tokens.
    if (t.length < 2) {
      this.errors.push('Syntax error in line ' + line);
      continue;
    }
    if (t[0].type == quantum.QScript.ID) {
      // Handle all cases when first token is a keyword.
      if (t[0].body == 'for') {
        var e = this.parseExpressions(t, 1);

        if (e.length != 3 && e.length != 4) {
          this.errors.push('Syntax error in line ' + line);
          continue;
        }
        if (e.length == 3) {
          forStack.push(f.code.length);
          f.code.push(new quantum.QScript.Opcode(
              quantum.QScript.CommandCode.FOR_INIT, [e[0], e[1]], line, -1));
          f.code.push(new quantum.QScript.Opcode(
              quantum.QScript.CommandCode.FOR_LOOP, [e[1], e[2]], line, -1));
        } else {
          f.code.push(new quantum.QScript.Opcode(
              quantum.QScript.CommandCode.FOR_INIT, [e[0], e[1], e[3]], line, -1));
          f.code.push(new quantum.QScript.Opcode(
              quantum.QScript.CommandCode.FOR_LOOP, [e[1], e[2], e[3]], line, -1));
        }
        continue;
      }
      if (t[0].body == 'if') {
        var e = this.parseExpressions(t, 1);

        if (e.length != 1 && e.length != 2) {
          this.errors.push('Syntax error in line ' + line);
          continue;
        }
        if (e.length == 1) {
          ifStack.push(f.code.length);
          f.code.push(new quantum.QScript.Opcode(
              quantum.QScript.CommandCode.IF, [e[0]], line, -1));
        } else {
          f.code.push(new quantum.QScript.Opcode(
              quantum.QScript.CommandCode.IF, [e[0], e[1]], line, -1));
        }
        continue;
      }
      if (t[0].body == 'proc') {
        if (t[1].type != quantum.QScript.ID) {
          this.errors.push('Syntax error in line ' + line);
          continue;
        }
        if (t.length == 2) {
          f.functions[t[1].body] = this.compileFunction(f, t[1].body, [], line);
          line = f.functions[t[1].body].lastLine + 1;
          continue;
        }
        var e = this.parseExpressions(t, 2);
        var a = [];
        for (i = 0; i < e.length; i++) {
          if (e[i].length != 1) {
            this.errors.push('Syntax error in line ' + line);
            continue;
          }
          a.push(e[i][0].body);
        }
        f.functions[t[1].body] = this.compileFunction(f, t[1].body, a, line);
        line = f.functions[t[1].body].lastLine + 1;
        continue;
      }

      // First token not a keyword, so check if it is a builtin call.
      var e = this.parseExpressions(t, 1);

      for (i = 0; i < this.builtins_.length; i++) {
        if (this.builtins_[i].name == t[0].body) {
          if (this.builtins_[i].args.length != e.length) {
            this.errors.push('Wrong number of arguments in line ' + line);
            break;
          }
          f.code.push(new quantum.QScript.Opcode(this.builtins_[i], e, line, -1));
          break;
        }
      }
      if (i != this.builtins_.length)
        // It was a builtin call, so we can continue.
        continue;
      // It's not a builtin call, so perhaps a JS expression.
      if (t[1].body[0] == '=' || t[1].body[0] == '+' || t[1].body[0] == '-' ||
          t[1].body[0] == '*' || t[1].body[0] == '/' || t[1].body[0] == '&' ||
          t[1].body[0] == '|' || t[1].body[0] == '^') {
        // Assume it is a JS expression.
        f.code.push(new quantum.QScript.Opcode(
            quantum.QScript.CommandCode.EXPRESSION, [t], line, -1));
        continue;
      }
      // The last option: it can only be a script function call.
      var fc = this.findFunction(f, t[0].body);
      if (fc != null) {
        f.code.push(new quantum.QScript.Opcode(fc, e, line, -1));
        continue;
      }
      // Nothing worked, so it is a script error.
      this.errors.push('Unknown command in line ' + line);
      continue;
    }

  }
  f.lastLine = line - 1;
  this.buildLocals(f);
  return f;
};


/**
 * Compiles script code.
 * @param {string} script Entire body of script code to compile.
 */
quantum.QScript.prototype.compile = function(script) {
  script = script.replace('\r', ' ').replace('\t', ' ');
  this.text_ = script.split('\n');

  this.main = this.compileFunction(null, '__main__', [], 0);

  // Initialize state for the beginning of execution.
  this.currentFunc = this.main;
  this.currentStep = 0;
  this.callStack = [];
};
