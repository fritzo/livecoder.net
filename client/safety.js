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
TODO.help = 'TODO(optionalMessage) is a placeholder for unfinished code';

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
assert.help = (
'assert(condition, optionalMessage) throws if condition is false' +
'see also:'+
'  assertEval(message)' +
'  assertEqual(lhs, rhs, optionalName)' +
'  assertLess(lhs, rhs, optionalName)' +
'  assertLength(array, length, optionalName)' +
'  assertIndex(i, length, optionalName)'
);

// TODO rename additional assertions to
// assert.eval
// assert.equal
// assert.less
// etc.

var assertEval = function (message) {
  assert(eval(message), message);
};
assertEval.help = 'assertEval(message) throws if eval(message) is false';

var assertEqual = function (actual, expected, message) {
  if (!(actual instanceof String) || !(expected instanceof String)) {
    actual = JSON.stringify(actual);
    expected = JSON.stringify(expected);
  }
  if (actual !== expected) {
      throw new AssertionError(
          (message || '') +
          '\n    actual = ' + actual +
          '\n    expected = ' + expected);
  }
};
assertEqual.help = 'assertEqual(x, y, optionalMessage) throws if x !== y';

var assertLess = function (actual, expected, message) {
  if (!(actual < expected)) {
      throw new AssertionError(
          (message || '') +
          '\n    actual = ' + actual +
          '\n    expected < ' + expected);
  }
};
assertLess.help = 'assertLess(x, y, optionalMessage) throws unless x < y';

var assertLength = function (obj, length, message) {
  if (obj.length !== length) {
     throw new AsertionError((message || '') + ' array has wrong length');
  }
};
assertLength.help = 'assertLength(o, n, optionalName) throws if o.length != n';

assertIndex = function (i, length, message) {
  if (!(0 <= i && i < length && i % 1 === 0)) {
    throw new AssertionError((message || '') + ' index out of bounds: ' + i);
  }
};
assertIndex.help =
  'assertIndex(i, I, optionalName) throws unless i in {0,...,I}';

assert.getter = function (args) {
  return function (name) {
    var result = args[name];
    assert(result !== undefined, 'object does not define ' + name);
    return result;
  };
};
assert.getter.help = 'assert.getter(obj)(name) throws if obj.name is undefined';

/** @constructor */
var WorkerException = function (message) {
  this.message = message || '(unspecified)';
};
WorkerException.prototype.toString = function () {
  return 'Worker Error: ' + this.message;
};

