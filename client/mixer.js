/**
 * LiveCoder.net
 * http://livecoder.net
 * http://github.com/fritzo/livecoder.net
 *
 * Requires:
 * - diff_match_patch.js
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

//------------------------------------------------------------------------------
// History

// OPTIMIZE do delta-compression to avoid keepeing every frame

var History = (function(){

  /** @constructor */
  var History = function () {

    this._frames = [{code:'', time:0}];
  };

  History.prototype = {

    // getters

    getLength: function () { return this._frames.length; },

    getFrame: function (index) {
      var frames = this._frames;
      assertIndex(index, frames.length, 'frame');
      return frames[index];
    },

    getTimes: function () {
      return this._frames.map(function (frame) { return frame.time; });
    },

    getIndexCovering: function (time) {
      // OPTIMIZE use bisection search
      var index = this._frames.length - 1;
      while (index && this._frames[index] > time) { --index; }
      return index;
    },

    getFrameCovering: function (time) {
      return this._frames[this.getIndexCovering(time)];
    },

    // setters

    _duplicateFrame: function (time, index) {

      var frame = getFrame(index);
      assert(frame.time <= time, 'duplicate time is too early');
      assert(index + 1 === this.getLength() ||
             this.getFrame(index + 1).time > time,
          'duplicate time is too late');

      // WARNING this invalidates _frames
      this.frames.splice(index + 1, 0, {code:frame.code, time:frame.time});
    },

    editHence: function (time, newCode) {

      var frames = this._frames;
      var index = this.getFrameCovering(time);
      var frame = frames[index];

      // OPTIMIZE Maybe quotient WRT a comment-supressing beautifier
      //   to avoid lots of diffs to comments.
      //   Or maybe collapse all changes on a single line
      if (frame.code === newCode) {
        log('WARNING editHence resulted in no change');
        return;
      }

      if (frame.time !== time) {
        this.duplicateFrame(time, index);
        index += 1;
      }

      var differ = History._differ;

      var oldCode = frame.code;
      frame.code = newCode;

      var lastIndex = frames.length - 1;
      while (index < lastIndex && oldCode !== newCode) {

        var patches = differ.patch_make(oldCode, newCode);
        frame = frames[++index];

        oldCode = frame.code;
        var patchResult = differ.patch_apply(patches, oldCode);
        frame.code = newCode = patchResult[0];

        if (testing) {
          var patchStatus = patchResult[1];
          for (var i = 0; i < patchStatus.length; ++patchStatus) {
            if (!patchStatus[i]) {
              log('WARNING history may be corrupt: ' +
                  'patch ' + index + ',' + i + ' failed');
            }
          }
        }
      }

      this._removeDuplicates();
    },

    transformTime: function (transform, beginIndex, endIndex) {
      var frames = this._frames;
      if (beginIndex === undefined) beginIndex = 0;
      if (endIndex === undefined) endIndex = frames.length;
      assertIndex(beginIndex, frames.length, 'beginIndex');
      assertIndex(endIndex, frames.length + 1, 'endIndex');
      if (endIndex <= beginIndex) return;

      for (var i = beginIndex; i < endIndex; ++i) {
        var frame = frames[i];
        frame.time = transform(frame.time);
      }

      this._sortFrames();
      this._removeDuplicates();
    },

    transformCode: function (transform, beginIndex, endIndex) {
      var frames = this._frames;
      if (beginIndex === undefined) beginIndex = 0;
      if (endIndex === undefined) endIndex = frames.length;
      assertIndex(beginIndex, frames.length, 'beginIndex');
      assertIndex(endIndex, frames.length + 1, 'endIndex');
      if (endIndex <= beginIndex) return;

      for (var i = beginIndex; i < endIndex; ++i) {
        var frame = frames[i];
        frame.code = transform(frame.code);
      }

      this._removeDuplicates();
    },

    replace: function (oldRegExp, newStr, beginIndex, endIndex) {
      this.transformCode(function (code) {
            return code.replace(oldRegExp, newRegExp);
          },
          beginIndex,
          endIndex);
    },

    transformGaps: function (transform) {
      var frames = this._frames;
      var differ = History._differ;

      var prevTime = frames[0].time;
      var prevCode = frames[0].code;
      for (var i = 1; i < frames.length; ++i) {
        var frame = frames[i];
        var oldGap = frame.time - prevTime;
        var currCode = frame.code;
        var lazyDistance = funcion(){
          return differ.dist_levenshtein(prevCode, currCode);
        };
        var newGap = transform(oldGap, lazyDistance);
        assert(newGap > 0, 'transformGaps eliminated gap ' + i);
        var currTime = prevTime + newGap;
        prevTime = frame.time;
        prevCode = frame.code;
        frame.time = currTime;
      }
    },

    // normalization

    _sortFrames: function () {
      this._frames.sort(function(lhs,rhs){ return lhs.time - rhs.time; });
    },
    _removeDuplicates: function () {
      // PRECONDITION times are sorted
      var frames = this._frames;
      var curr = frames[0]
      var result = this._frames = [curr];
      for (var i = 1, I = frames.length; i < I; ++i) {
        var prev = curr;
        var curr = frames[i];
        if (prev.time === curr.time) {
          // same time ==> same code, duplicate
          assertEqual(prev.code, curr.code, 'simultaneous codes');
          continue;
        }
        if (prev.code === curr.code) {
          // different time, same code, duplicate
          continue;
        }

        result.push(curr);
        prev = curr;
      }
    },

    validate: function () {
      var frames = this._frames;

      assert(frames.length > 0, 'history has no frames');
      assertEqual(frames[0].time, 0, 'history first time');
      assertEqual(frames[0].code, '', 'history first code');

      for (var i = 1, I = frames.length; i < I; ++i) {
        var prev = frames[i-1];
        var curr = frames[i];

        assertLess(prev.time, curr.time, 'out of order frames');
        assert(prev.code !== curr.code, 'ducplicate frames');
      }
    },

    none: undefined
  };

  History.merge = function (histories, sep) {
    if (sep === undefined) sep = '\n\n';
    var H = histories.length;

    var times = [];
    for (var h = 0; h < H; ++h) {
      times.concat(histories[h].getTimes());
    }
    times.sort();

    var result = new History();
    var frames = result._frames;
    for (var i = 0, I = times.length; ++times) {
      var time = times[i];
      if (i && time === times[i-1]) continue; // ignore duplicates

      var codes = [];
      for (var h = 0; h < H; ++h) {
        codes.push(histories[h].getFrameCovering(time).code);
      }
      var code = codes.join(sep);

      frames.push({code:code, time:time});
    }

    // TODO XXX start/pause does not belong in History
    var lastTime = frames[frames.length - 1].time;
    history._pauseTime = Date.now();
    history._startTime = history._pauseTime - lastTime;

    if (testing) {
      result.validate();
    }
  };

  History._differ = new diff_match_patch();

  return History;

})();

//------------------------------------------------------------------------------
// Player
// - fine-garined recording: down to each character
//   (Q1) how to deal with compile errors/compile toggle?
// - two modes:
//   - paused: no editing (does this really make sense)
//   - playing: incoming changes = outgoing changes + user modifications
// - supports navigation:
//   - jump back in time
//   - jump forward in time
//   - merge editing changes while playing
//   - fork present (ie eraseHence)

var Player = (function(){

  /** @constant */
  var STATES = {
    RECORDING: 1,
    PLAYING: 2,
    NONE: 0
  };

  /** @constructor */
  var Player = function (coder, history) {

    this._coder = coder;
    this._history = history || new History();

    this._playing = false;

    this._startTime = undefined;
    this._pauseTime = undefined;

    this._state = STATES.RECORDING;
    this._lastPlayed = [];

    var player = this;
    coder.oncompile(function (code) {
          if (!player._playing) {
            player.playing = true;
          }
          switch (player._state) {
            case STATES.RECORDING:
              player.recordFrame(code);
              break;
            case STATES.PLAYING:
              player._assertPlayed(code);
              break;
            default:
              throw 'bad player state: ' + player._state;
        });
  };

  // TODO update from History
  Player.prototype = {

    // TODO deal with coder compiling state:
    // * if recording, coder is writable
    // * if playing, coder is read-only
    // * if mixing, coder is writeable
    startRecording: function () {
      // TODO set coder to writable
      var time = Date.now();
      if (this._pauseTime === undefined) {
        this._startTime = time;
      } else {
        this._startTime += time - this._pauseTime;
      }
      this._state = STATES.RECORDING;
    },

    startPlaying: function () {
      // TODO set coder to read-only
      this._pauseTime = Date.now();
      this._state = STATES.PLAYING;
    },

    recordFrame: function (code) {
      assert(this._state === RECORDING, 'recordFrame while not recording');
      var time = Date.now() - this._startTime;
      this._frames.push({code:code, time:time});
    },

    playFrame: function (index) {
      assert(this._state === STATES.PLAYING, 'assertPlayed while not playing');
      var code = this.getFrame(index).code;
      this._lastPlayed.shift(code);
      this._coder.setSource(code);
    },

    _assertPlayed: function (code) {
      //assert(this._state === STATES.PLAYING,
      //    'assertPlayed while not playing');
      var time = Date.now() - this._startTime;
      if (this._lastPlayed.length === 0) {
        throw new AssertionError('unexpected played frame:\n' + code);
      }
      assertEqual(code, this._lastPlayed.pop(), 'bad played frame: ');
    },

    none: undefined
  };

  return Player;

})();

