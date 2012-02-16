/**
 * LiveCoder.net
 * http://livecoder.net
 * http://github.com/fritzo/livecoder.net
 *
 * Simple audio tools.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 * Licensed under the GPL version 3 license:
 * http://www.opensource.org/licenses/GPL-3.0
 */

// audio defaults to mono 16bit 22050 Hz
var sampleRate = WavEncoder.defaults.sampleRateHz / 1000; // in kHz
var middleC = 0.261625565; // in kHz

var encodeWav = function (samples) {
  assert(samples instanceof Array, 'bad samples in encodeWav(-)');
  return WavEncoder.encode(samples);
};

var play = function (uri, volume) {
  assert(typeof uri === 'string', 'bad data uri in play(-)');
  var audio = new Audio(uri);

  // prevent garbage collection of audio element until done
  //if (audio.duration) { // XXX sometimes duration is nan
  //  var $audio = $(audio);
  //  $audio.appendTo(play._$div || (play._$div = $('#audio')));
  //  log('DEBUG ' + audio.duration);
  //  //setTimeout(function(){ $audio.remove(); }, audio.duration + 200);
  //}

  if (volume !== undefined) audio.volume = volume;
  audio.play();
};

var tone = function (args) {

  var duration = args.duration;
  var frequency = args.frequency;
  var gain = args.gain || 1;
  assert(duration > 0, 'bad args.duration: ' + duration);
  assert(frequency > 0, 'bad args.frequency: ' + duration);

  var numSamples = Math.floor(duration * sampleRate);
  var samples = new Array(numSamples);

  gain *= 1 / numSamples;
  var omega = 2 * Math.PI * frequency / sampleRate;
  var sin = Math.sin;
  var sqrt = Math.sqrt;

  for (var t = 0; t < numSamples; ++t) {
    samples[t] = sin(omega * t) * (numSamples - t) * gain;
  }

  return encodeWav(samples);
};

tone.help = [
"// Generate and encode a linearly-ramped sine wave:",
"uri = tone({,      // returns a wave data uri",
"    frequency:_,   // frequency in kHz",
"    duration:_,    // duration in ms",
"    [gain:_,]})    // optional gain in [0,1]"].join('\n');

var noise = function (args) {

  var duration = args.duration;
  var gain = args.gain || 1;
  assert(duration > 0, 'bad args.duration: ' + duration);

  var numSamples = Math.floor(duration * sampleRate);
  var samples = new Array(numSamples);

  var sqrt = Math.sqrt;
  var random = Math.random;

  if (bandwidth in args) { // band-limited noise

    var bandwidth = args.bandwidth;
    var frequency = args.frequency;
    assert(frequency > 0, 'bad args.frequency: ' + frequency);

    var numSamples = floor(duration * sampleRate);
    var omega = 2 * Math.PI * frequency / sampleRate;
    var cosOmega = cos(omega);
    var sinOmega = sin(omega);
    var decay = exp(-bandwidth * frequency / sampleRate);
    var transReal = decay * cosOmega;
    var transImag = decay * sinOmega;
    var normalize = 1 - decay;
    gain *= normalize / numSamples;

    var random = Math.random;
    var randomStd = function () {
      return 2 * (random() + random() + random()) - 3;
    };

    var x = 0;
    var y = 0;
    var samples = [];
    for (var t = 0; t < numSamples; ++t) {
      var x0 = x;
      var y0 = y;
      x = transReal * x0 - transImag * y0 + randomStd();
      y = transReal * y0 + transImag * x0 + randomStd();
      samples[t] = x * gain * (numSamples - t);
    }

  } else { // broadband noise

    gain *= 1 / numSamples;
    for (var t = 0; t < numSamples; ++t) {
      samples[t] = (2 * random() - 1) * (numSamples - t) * gain;
    }
  }

  return encodeWav(samples);
};

noise.help = [
"// Generate and encode linearly-ramped broad/narrow band noise:",
"uri = noise({,       // returns a wave data uri",
"    duration:_,      // duration in ms",
"    [gain:_,]        // optional gain in [0,1]",
"    [frequency:_,    // optional band center frequency in kHz",
"     bandwidth:_,]}) //      and relative bandwidth in [0,1]"].join('\n');

var speech = function () {
  throw "speech(-) is not defined, try using('speech.js') first";
};
var say = function () {
  throw "say(-) is not defined, try using('speech.js') first";
};

