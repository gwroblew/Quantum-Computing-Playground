/**
 * @fileoverview Codemirror module for QScript syntax, based on Go module.
 * @suppress {missingProperties} CodeMirror main object is not compiled.
 */


CodeMirror.defineMode('qscript', function(config) {
  var indentUnit = config.indentUnit;

  // List of QScript keywords.
  var keywords = {
    'if': true, 'else': true, 'endif': true,
    'return': true, 'break': true, 'continue': true,
    'proc': true, 'endproc': true,
    'for': true, 'endfor': true
  };

  // List of builtin operations (gates + other), populated from the main
  // quantum.QScript class.
  var builtins = {};

  goog.array.forEach(quantum.QScript.getBuiltins(), function(fnc) {
    builtins[fnc.name] = true;
  });

  var atoms = {
    'true': true, 'false': true, 'this': true, 'null': true, 'undefined': true
  };

  var isOperatorChar = /[+\-*&^%:=<>!|\/]/;

  var curPunc;

  /**
   * Converts stream text into tokens.
   * @param {!Object} stream Text stream from CodeMirror.
   * @param {!Object} state Tokenization state from CodeMirror.
   * @return {?string} Token type.
   */
  function tokenBase(stream, state) {
    var ch = stream.next();
    if (ch == "'" || ch == '"') {
      state.tokenize = tokenString(ch);
      return state.tokenize(stream, state);
    }
    if (/[\d\.]/.test(ch)) {
      if (ch == '.') {
        stream.match(/^[0-9]+([eE][\-+]?[0-9]+)?/);
      } else if (ch == '0') {
        stream.match(/^[xX][0-9a-fA-F]+/) || stream.match(/^0[0-7]+/);
      } else {
        stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);
      }
      return 'number';
    }
    if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
      curPunc = ch;
      return null;
    }
    if (ch == '/') {
      if (stream.eat('/')) {
        stream.skipToEnd();
        return 'comment';
      }
    }
    if (isOperatorChar.test(ch)) {
      stream.eatWhile(isOperatorChar);
      return 'operator';
    }
    stream.eatWhile(/[\w\$_]/);
    var cur = stream.current();
    if (keywords.propertyIsEnumerable(cur)) {
      curPunc = cur;
      return 'keyword';
    }
    if (atoms.propertyIsEnumerable(cur)) {
      return 'atom';
    }
    if (builtins.propertyIsEnumerable(cur)) {
      return 'builtin';
    }
    return 'variable';
  }

  /**
   * Returns function parsing string token for given quote character.
   * @param {string} quote String quote character: ' or ".
   * @return {function(!Object,!Object):string} Function parsing string token.
   */
  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next, end = false;
      while ((next = stream.next()) != null) {
        if (next == quote && !escaped) {end = true; break;}
        escaped = !escaped && next == '\\';
      }
      if (end || !escaped)
        state.tokenize = tokenBase;
      return 'string';
    };
  }

  /**
   * Parsing local context information for proper indentation.
   * @param {number} indented Intentation size.
   * @param {number} column Column index befor indentation.
   * @param {string} type Indentation closing type, ex: 'endproc'.
   * @param {?boolean} align Whether following lines should be aligned as well.
   * @param {!Context=} opt_prev Optional previous context.
   * @constructor
   */
  function Context(indented, column, type, align, opt_prev) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.align = align;
    this.prev = opt_prev || null;
  }

  function pushContext(state, col, type) {
    return state.context =
        new Context(state.indented, col, type, null, state.context);
  }

  function popContext(state) {
    var t = state.context.type;
    if (t == 'endfor' || t == 'endif' || t == 'endproc')
      state.indented = state.context.indented;
    return state.context = state.context.prev;
  }

  // Interface

  return /** @type {!CodeMirror.Mode} */({
    startState: function(basecolumn) {
      return {
        tokenize: null,
        context: new Context((basecolumn || 0) - indentUnit, 0, 'top', false),
        indented: 0,
        startOfLine: true
      };
    },

    token: function(stream, state) {
      var ctx = state.context;
      if (stream.sol()) {
        if (ctx.align == null) ctx.align = false;
        state.indented = stream.indentation();
        state.startOfLine = true;
        if (ctx.type == 'case') ctx.type = '}';
      }
      if (stream.eatSpace()) return null;
      curPunc = null;
      var style = (state.tokenize || tokenBase)(stream, state);
      if (style == 'comment') return style;
      if (ctx.align == null) ctx.align = true;

      if (curPunc == 'proc') pushContext(state, stream.column(), 'endproc');
      else if (curPunc == 'for') pushContext(state, stream.column(), 'endfor');
      else if (curPunc == 'if') pushContext(state, stream.column(), 'endif');
      else if (curPunc == ctx.type) popContext(state);
      state.startOfLine = false;
      return style;
    },

    indent: function(state, textAfter) {
      if (state.tokenize != tokenBase && state.tokenize != null) return 0;
      var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
      var closing = firstChar == ctx.type;
      if (ctx.align) return ctx.column + (closing ? 0 : indentUnit);
      else return ctx.indented + (closing ? 0 : indentUnit);
    },

    lineComment: '//'
  });
});

CodeMirror.defineMIME('text/x-qscript', 'qscript');
