/**
 * Tools for safe coding.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

//------------------------------------------------------------------------------
// Logging in the main window & web workers

var log;
if (this.document) { // in main window

  if (window.console && window.console.log) {
    log = function (message) { console.log(message); };
  } else {
    log = function (message) {}; // ignore
  }

} else { // in a web worker

  log = function (message) {
    self.postMessage({'type':'log', 'data':message});
  };
}

//------------------------------------------------------------------------------
// Global safety

var globalEval = eval;
'use strict';

/** @constructor */
var TodoException = function (message) {
  this.message = message || '(unfinished code)';
};
TodoException.prototype.toString = function () {
  return 'TODO: ' + this.message;
};
var TODO = function (message) {
  throw new TodoException(message);
};

/** @constructor */
var AssertException = function (message) {
  this.message = message || '(unspecified)';
};
AssertException.prototype.toString = function () {
  return 'Assertion Failed: ' + this.message;
};
var assert = function (condition, message) {
  if (!condition) {
    throw new AssertException(message);
  }
};

var assertEval = function (message) {
  assert(eval(message), message);
};
var assertEqual = function (actual, expected, message) {
  if (!(actual instanceof String) || !(expected instanceof String)) {
    actual = JSON.stringify(actual);
    expected = JSON.stringify(expected);
  }
  assert(actual === expected,
    (message || '') +
    '\n    actual = ' + actual +
    '\n    expected = ' + expected);
};
var assertNear = function (actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-8,
    (message || '') +
    '\n    actual = ' + actual +
    '\n    expected = ' + expected);
};
var assertLength = function (obj, length, message) {
  assertEqual(obj.length, length, (message || '') + ' array has wrong length');
};
var assertType = function (obj, type, message) {
  assert(obj instanceof type,
      (message || '') +
      'type error for ' + obj +
      '\n    actual type = ' + (typeof object) +
      '\n    expected ttype = ' + type);
};

var typedFun = function (argTypes, returnType, fun) {
  var nargs = argTypes.length;
  return (function () {
    assertEqual(arguments.length, nargs, 'invalid argmuent count');
    for (var i = 0; i < nargs; ++i) {
      assertType(arguments[i], argTypes[i], 'argument ' + i);
    }
    var result = fun.apply(this, arguments);
    assertType(result, returnType, 'result');
    return result;
  });
};

/** @constructor */
var WorkerException = function (message) {
  this.message = message || '(unspecified)';
};
WorkerException.prototype.toString = function () {
  return 'Worker Error: ' + this.message;
};

