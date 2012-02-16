

//------------------------------------------------------------------------------
// History

// OPTIMIZE do delta-compression to avoid keepeing every frame

var History = (function(){

  /** @constant */
  var STATES = {
    RECORDING: 1,
    PLAYING: 2,
    NONE: 0
  };

  /** @constructor */
  var History = function (coder) { // TODO XXX remove dependency on coder

    this._coder = coder;

    this._startTime = undefined;
    this._pauseTime = undefined;

    this._state = STATES.RECORDING;

    this._frames = [{code:'', time:0}];

    this._lastPlayed = [];

    var history = this;
    coder.oncompile(function (code) {
          switch (history._state) {
            case STATES.RECORDING:
              history.recordFrame(code);
              break;
            case STATES.PLAYING:
              history._assertPlayed(code);
              break;
            default:
              throw 'bad history state: ' + history._state;
        });
  };

  History.prototype = {

    getLength: function () { return this._frames.length; },

    getFrame: function (index) {
      var frames = this._frames;
      assertIndex(index, frames.length, 'frame');
      return frames[index];
    },

    getTimes: function () {
      return this._frames.map(function (frame) { return frame.time; });
    },

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

    getIndexAt: function (time) {
      // OPTIMIZE use bisection search
      var index = this._frames.length - 1;
      while (index && this._frames[index] > time) { --index; }
      return index;
    },

    getFrameAt: function (time) {
      return this._frames[this.getIndexAt(time)];
    },

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

    transformTime: function (transform, beginIndex, endIndex) {
      var frames = this._frames;
      if (beginIndex === undefined) beginIndex = 0;
      if (endIndex === undefined) endIndex = frames.length;
      assertIndex(beginIndex, frames.length, 'beginIndex');
      assertIndex(endIndex, frames.length + 1, 'endIndex');

      for (var i = beginIndex; i < endIndex; ++i) {
        var frame = frames[i];
        frame.time = transform(frame.time);
      }

      _sortFrames();
      _removeDuplicates();
    },

    transformCode: function (transform, beginIndex, endIndex) {
      var frames = this._frames;
      if (beginIndex === undefined) beginIndex = 0;
      if (endIndex === undefined) endIndex = frames.length;
      assertIndex(beginIndex, frames.length, 'beginIndex');
      assertIndex(endIndex, frames.length + 1, 'endIndex');

      for (var i = beginIndex; i < endIndex; ++i) {
        var frame = frames[i];
        frame.code = transform(frame.code);
      }

      _removeDuplicates();
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
        codes.push(histories[h].getFrameAt(time).code);
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

  return History;

})();

//------------------------------------------------------------------------------
// Recorder

var Recorder = (function(){

  /** @constructor */
  var Recorder = function () {
  };

  return Recorder;

})();

