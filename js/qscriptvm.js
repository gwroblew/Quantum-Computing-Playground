/**
 * @fileoverview Execution engine of QScript compiled pseudocode.
 */


/**
 * Saves value of a variable for backward execution.
 * @param {string} id Variable name.
 * @private
 */
quantum.QScript.prototype.saveValue_ = function(id) {
  var l = this.savedVars_.length;
  for (var i = 0; i < l; i++) {
    if (this.savedVars_[i] == id) {
      return;
    }
  }
  if (id == quantum.QScript.MEASURED_VALUE) {
    this.savedVars_.push(id);
    this.savedValues_.push(this.measuredValue);
    return;
  }
  this.savedVars_.push(id);
  this.savedValues_.push(this.eval_(id));
};


/**
 * Restores values of variables changed by a step execution.
 * @param {!quantum.QScript.StepData} step Container with the step data.
 * @private
 */
quantum.QScript.prototype.restoreValues_ = function(step) {
  var i;
  for (i = 0; i < step.symbols.length; i++) {
    if (step.symbols[i] == quantum.QScript.MEASURED_VALUE) {
      this.measuredValue = step.values[i];
      continue;
    }
    this.eval_(step.symbols[i] + '=' + step.values[i]);
  }
};


/**
 * Translates identifier to create variable scoping.
 * @param {!quantum.QScript.Func} fn Function to begin with.
 * @param {string} id Identifier to translate.
 * @return {string} Translated identifier.
 */
quantum.QScript.prototype.translateId = function(fn, id) {
  if (id.indexOf('.') >= 0) {
    return id;
  }
  if (id == quantum.QScript.MEASURED_VALUE) {
    this.saveValue_(quantum.QScript.MEASURED_VALUE);
    // Measured value could be a number, so we need to convert it.
    return this.measuredValue.toString();
  }
  if (id[0] == '_') {
    var globid = quantum.QScript.VARS_PREFIX + '_' + id;
    this.saveValue_(globid);
    return globid;
  }

  // Search up the scope tree for given symbol.
  var f = fn;
  while (goog.isDefAndNotNull(f) && !f.locals.hasOwnProperty(id)) {
    f = f.parent;
  }

  if (!goog.isDefAndNotNull(f)) {
    // Symbol not found, so it must be a new local variable.
    fn.locals[id] = 0;
    this.buildLocals(fn);
    f = fn;
  }
  var trid = quantum.QScript.VARS_PREFIX + f.name + '_' + id;
  this.saveValue_(trid);
  return trid;
};


/**
 * Evaluates expression using JavaScript eval.
 * @param {!Array.<!quantum.QScript.Token>} ex Tokenized expression to evaluate.
 * @param {string=} opt_prefix String to add before the expression.
 * @return {*} Result of evaluation.
 */
quantum.QScript.prototype.executeExpression = function(ex, opt_prefix) {
  var result = 0;
  var i;
  var expr = '';

  if (!goog.isDef(opt_prefix)) {
    opt_prefix = '';
  }

  // Parse expression and replace identifiers with scoped symbols.
  for (i = 0; i < ex.length; i++) {
    if (ex[i].type == quantum.QScript.ID) {
      // Detect assignment of new local variables.
      if (i == 0 && ex.length > 1 && ex[1].body == '=' &&
          !this.currentFunc.locals.hasOwnProperty(ex[i].body)) {
        this.currentFunc.locals[ex[i].body] = 0;
        this.buildLocals(this.currentFunc);
      }
      expr += this.translateId(
          /** @type {!quantum.QScript.Func} */(this.currentFunc), ex[i].body);
    } else {
      // Not identifier, just append it to the JS expression.
      expr += ex[i].body;
    }
  }

  try {
    result = this.eval_(opt_prefix + expr);
  } catch (exc) {
    this.errors.push('JavaScript exception: ' + exc.message);
  }

  return result;
};


/**
 * Gets the number of line currently executed in script.
 * @return {number} Line number.
 */
quantum.QScript.prototype.getCurrentLine = function() {
  if (this.currentStep >= this.currentFunc.code.length) {
    // In case we reached end of the script return the last line.
    return this.currentFunc.code[this.currentFunc.code.length - 1].line - 1;
  }
  return this.currentFunc.code[this.currentStep].line - 1;
};


/**
 * Gets current call stack during execution.
 * @return {!Array.<string>} List of call stack frames.
 */
quantum.QScript.prototype.getCurrentCallStack = function() {
  var i;
  var cs = [];
  var curfn = this.currentFunc.name;

  // Transform call stack into a list of readable strings.
  for (i = 0; i < this.callStack.length; i++) {
    cs.push(curfn + ' ' + this.callStack[i][2]);
    curfn = this.callStack[i][0].name;
  }
  cs.push(curfn);
  return cs;
};


/**
 * Gets values of local variables.
 * @return {!Array.<!Array.<string>>} List of [identifier, value] pairs for
 *     local variables.
 */
quantum.QScript.prototype.getCurrentLocals = function() {
  var i;
  var locals = [];
  // Get current values of local variables.
  var va = this.eval_(this.currentFunc.localExpr);
  // Create list of local variables with values for easy display.
  for (i = 0; i < this.currentFunc.localIds.length; i++) {
    locals.push([this.currentFunc.localIds[i], va[i].toString()]);
  }
  return locals;
};


/**
 * @return {boolean} True if execution has reached the end.
 */
quantum.QScript.prototype.isDone = function() {
  if (this.currentStep >= this.currentFunc.code.length &&
      this.callStack.length == 0)
    return true;
  return false;
};


/**
 * @return {boolean} True if execution is at the beginning of the script.
 */
quantum.QScript.prototype.isStart = function() {
  return this.history_.length == 0;
};


/**
 * Steps back one step of execution.
 */
quantum.QScript.prototype.stepBack = function() {
  if (this.history_.length == 0) {
    return;
  }
  var step = this.history_.pop();

  this.errors = [];
  this.restoreValues_(step);
  this.currentFunc = step.func;
  this.currentStep = step.step;

  var op = this.currentFunc.code[this.currentStep];

  if (!(typeof op.command === 'string') && op.command.execute != null) {
    // Apply reverse quantum gate to the vector state.
    var i;
    var reverse = op.command.name;
    var argv = [];

    // Here we assume that reverse must have the same number of arguments.
    for (i = 0; i < op.args.length; i++) {
      argv[i] = this.executeExpression(op.args[i]);
    }
    switch (op.command.name) {
      case 'VectorSize':
        reverse = '';
        break;
      case 'Phase':
        argv[1] = -argv[1];
        break;
      case 'CPhase':
        argv[2] = -argv[2];
        break;
      case 'QFTCPhase':
        reverse = 'InvQFTCPhase';
        break;
      case 'InvQFTCPhase':
        reverse = 'QFTCPhase';
        break;
      case 'QFT':
        reverse = 'InvQFT';
        break;
      case 'InvQFT':
        reverse = 'QFT';
        break;
      case 'ShiftLeft':
        reverse = 'ShiftRight';
        break;
      case 'ShiftRight':
        reverse = 'ShiftLeft';
        break;
      case 'MeasureBit':
      case 'ExpModN':
      case 'RevExpModN':
        reverse = '';
        break;
      case 'Measure':
        this.errors.push('Warning: measurement is normally not reversible!');
        break;
      case 'Rx':
      case 'Ry':
      case 'Rz':
        argv[1] = -argv[1];
        break;
      default:
        break;
    }
    if (reverse.length == 0) {
      this.errors.push('Warning: this step has no reverse operation!');
      return;
    }
    var revcmd = goog.array.find(this.builtins_, function(fn) {
      return fn.name == reverse;
    });

    revcmd.execute(this, argv);
  }
};


/**
 * Runs one step of script execution.
 */
quantum.QScript.prototype.runStep = function() {
  if (this.currentStep >= this.currentFunc.code.length) {
    if (this.callStack.length == 0) {
      return;
    }
    // We reached end of function, but call stack is not empty.
    var frame = this.callStack.pop();
    this.currentFunc = frame[0];
    this.currentStep = frame[1];
    return;
  }
  var i, op = this.currentFunc.code[this.currentStep];
  var savedFunc = this.currentFunc;
  var savedStep = this.currentStep;

  this.errors = [];
  this.savedVars_ = [];
  this.savedValues_ = [];

  // First handle all internal operations.
  if (typeof op.command === 'string') {
    switch (op.command) {
      case quantum.QScript.CommandCode.FOR_INIT:
        this.executeExpression(op.args[0]);
        if (this.executeExpression(op.args[1])) {
          if (op.args.length == 2) {
            this.currentStep += 2;
          } else {
            this.executeExpression(op.args[2]);
            this.currentStep++;
          }
        } else {
          if (op.args.length == 2)
            this.currentStep = op.target + 1;
          else
            this.currentStep += 2;
        }
        break;
      case quantum.QScript.CommandCode.FOR_LOOP:
        this.executeExpression(op.args[1]);
        if (this.executeExpression(op.args[0])) {
          if (op.args.length == 2) {
            this.currentStep += 1;
          } else {
            this.executeExpression(op.args[2]);
          }
        } else {
          if (op.args.length == 2)
            this.currentStep = op.target + 1;
          else
            this.currentStep++;
        }
        break;
      case quantum.QScript.CommandCode.FOR_END:
        this.currentStep = op.target;
        break;
      case quantum.QScript.CommandCode.EXPRESSION:
        this.executeExpression(op.args[0]);
        this.currentStep++;
        break;
      case quantum.QScript.CommandCode.IF:
        if (this.executeExpression(op.args[0])) {
          this.currentStep++;
          if (op.args.length == 2)
            this.executeExpression(op.args[1]);
        } else {
          this.currentStep = op.target + 1;
        }
        break;
      case quantum.QScript.CommandCode.ELSE:
        this.currentStep = op.target + 1;
        break;
      case quantum.QScript.CommandCode.ENDIF:
        this.currentStep++;
        break;
      case quantum.QScript.CommandCode.RETURN:
        this.currentStep = this.currentFunc.code.length;
        break;
      case quantum.QScript.CommandCode.BREAK:
        this.currentStep = this.currentFunc.code[op.target].target + 1;
        break;
    }
  } else if (op.command.execute == null) {
    // Handle script function calls.
    var argv = '';
    for (i = 0; i < op.args.length; i++) {
      this.executeExpression(op.args[i], this.translateId(op.command,
          op.command.args[i]) + ' = ');
      if (i > 0) {
        argv += ', ';
      }
      argv += this.executeExpression(op.args[i]);
    }
    this.callStack.push([this.currentFunc, this.currentStep + 1, argv]);
    this.currentFunc = op.command;
    this.currentStep = 0;
  } else {
    // Handle execution of builtin function.
    var argv = [];

    for (i = 0; i < op.args.length; i++) {
      argv[i] = this.executeExpression(op.args[i]);
    }

    op.command.execute(this, argv);
    this.currentStep++;
  }
  // Get the next step of execution, if any.

  this.history_.push(new quantum.QScript.StepData(this.savedVars_,
      this.savedValues_, savedFunc, savedStep));

  if (this.currentStep >= this.currentFunc.code.length) {
    if (this.callStack.length == 0)
      return;
    var frame = this.callStack.pop();
    this.currentFunc = frame[0];
    this.currentStep = frame[1];
  }
};
