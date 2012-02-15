/**
 * LiveCoder.net
 * http://livecoder.net
 * http://github.com/fritzo/livecoder.net
 *
 * Wrapper for speak.js, a javascript port of espeak.
 *
 * Licensed under the GPL version 3 license:
 * http://www.opensource.org/licenses/GPL-3.0
 */

//------------------------------------------------------------------------------
// this is a minor modification of speakClient.js from speak.js
// this code is released under the GPL version 3 license

var speech = function (text, args) {
  var data = generateSpeech(text, args);
  return speech.encode64(data);
};

speech.encode64 = function (data) {
  var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var PAD = '=';
  var result = 'data:audio/wav;base64,';
  var leftchar = 0;
  var leftbits = 0;
  for (var i = 0; i < data.length; i++) {
    leftchar = (leftchar << 8) | data[i];
    leftbits += 8;
    while (leftbits >= 6) {
      var curr = (leftchar >> (leftbits-6)) & 0x3f;
      leftbits -= 6;
      result += BASE[curr];
    }
  }
  if (leftbits == 2) {
    result += BASE[(leftchar&3) << 4];
    result += PAD + PAD;
  } else if (leftbits == 4) {
    result += BASE[(leftchar&0xf) << 2];
    result += PAD;
  }
  return result;
};

speech.help = 'speech(text) synthesizes speech from text';

var say = function (text, args) {
  play(speech(text, args));
};

say.help = 'say(text) plays speech from text';

