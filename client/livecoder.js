/**
 * LiveCoder.net
 * http://livecoder.net
 * http://github.com/fritzo/livecoder.net
 *
 * Livecoder is toolset to make browser-based javascript live coding easy.
 * It includes a language extension, and a live coding editor.
 *
 * Requires:
 * - a textarea for source editing
 * - a textarea for print/warn/error logging
 * - a button for status indication
 * - a canvas for 2d drawing
 * - jQuery
 * - google diff_match_patch
 * - CodeMirror2 (see compression api http://codemirror.net/doc/compress.html)
 *   - lib/util/simple-hint.js
 *   - lib/util/javascript-hint.js
 *   - lib/util/searchcursor.js
 *   - lib/util/search.js
 *   - lib/util/dialog.js
 *   - lib/util/dialog.css
 *   - lib/util/simple-hint.css
 *   - lib/codemirror.js
 *   - mode/javascript/javascript.js (modified for livecoder)
 *
 * Provides:
 * - an object 'live'
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

var live = (function(){

  var alwaysPollMs = 250;
  var alwaysLoopMs = 1;

  var live = {};

  var _$log;
  var _$status;
  var _codemirror;
  var _diff_match_patch;

  live.init = function (args) {

    _$log = args.$log;
    _$status = args.$status;

    _codemirror = CodeMirror.fromTextArea(args.$source[0], {
      mode: 'live',
      undoDepth: 512,
      onFocus: args.onFocus,
      onChange: _compileSource,
      theme: 'live',
      lineNumbers: false,
      matchBrackets: true,
      workTime: 10, // very short
      workDelay: 300, // default
      pollinterval: 300, // long
      extraKeys: {
        'Ctrl-Space': function (cm) {
          CodeMirror.simpleHint(cm, CodeMirror.javascriptHint);
        }
      }
    });

    // this is required for full screen
    var scroller = _codemirror.getScrollerElement();
    scroller.style.height = '100%';
    scroller.style.width = '100%';

    _codemirror.setValue(args.initSource || live.logo);

    _diff_match_patch = new diff_match_patch();

    _initGraphics(args.canvas2d);

    _startCompiling();
    _startAlways();
  };

  live.logo = [
      //"once say('Hello World! i am live code. try changing me.');",
      "// Hello World",
      "// i am live code",
      "// try changing me",
      "",
      "draw.font = 'bold 80px Courier';",
      "draw.fillStyle = '#55aa55';",
      "draw.textAlign = 'center';",
      "",
      "always.hello = function () {",
      "",
      "  var x = 1/8 * mouseX + 3/8 * innerWidth;",
      "  var y = 1/8 * mouseY + 3/8 * innerHeight;",
      "",
      "  x += Math.sin(Date.now() / 500) * 10;",
      "  y += Math.cos(Date.now() / 500) * 10;",
      "",
      "  draw.clearRect(0, y-80, innerWidth, 160);",
      "  draw.fillText('Hello World!', x, y);",
      "};",
      ""
  ].join('\n');

  var _print = function (message) {
    _$log.val('> ' + message).css('color', '#aaaaff').show();
  };
  var _success = function () {
    _$log.val('').hide();
    _$status.css({
          'color': '#7f7',
          'border-color': '#7f7',
          'background-color': '#070'
        }).text(':)');
  };
  var _warn = function (message) {
    _$log.val(String(message)).css('color', '#ffff00').show();
    _$status.css({
          'color': '#ff0',
          'border-color': '#ff0',
          'background-color': '#730'
        }).text(':(');
  };
  var _error = function (message) {
    _$log.val(String(message)).css('color', '#ff7777').show();
    _$status.css({
          'color': '#f77',
          'border-color': '#f77',
          'background-color': '#700'
        }).text(':(');
  };

  var _clear = function () {
    _clearAllTimeouts();
    _clearWorkspace();
    _context2d.clearRect(0, 0, innerWidth, innerHeight);
  };

  live.setSource = function (val) {
    _clear();
    _codemirror.setValue(val);
    _startCompiling();
  };
  live.getSource = function (val) {
    return _codemirror.getValue();
  };

  //----------------------------------------------------------------------------
  // Evaluation

  var Warning = function (message) { this.message = message; };
  Warning.prototype.toString = function () {
    return 'Warning: ' + this.message;
  };

  var _compileSource;
  var _startCompiling;
  var _toggleCompiling;
  var _clearWorkspace;
  var _startAlways;

  (function(){

    var compiling = false;
    var vars = {};
    var once = {};
    var always = {};

    // TODO live.oncompile(function(){ diffHistory.add(live.getSource()); });
    var compileHandlers = [];
    live.oncompile = function (handler) {
      compileHandlers.push(handler);
    };

    _compileSource = function () {
      if (!compiling) {
        _warn('hit escape to compile');
        return;
      }

      var source = _codemirror.getValue();
      var compiled;
      try {
        compiled = globalEval(
            '"use strict";\n' +
            '(function(' +
                  'vars, once, always, clear, setTimeout, using,' +
                  'help, print, error, draw' +
                '){\n' +
                source +
            '\n/**/})');
      }
      catch (err) {
        _warn(err);
        return;
      }

      _success();
      var warnings = [];
      var errors = [];

      var oncePrev = {};
      for (var key in once) {
        oncePrev[key] = undefined;
      }

      try {
        compiled(
            vars, once, always, _clear, _setTimeout, _using,
            _help, _print, _error, _context2d);
      }
      catch (err) {
        (err instanceof Warning ? warnings : errors).push(err.toString());
      }

      for (var key in once) {
        if (!(key in oncePrev)) {
          try {
            once[key]();
          }
          catch (err) {
            delete once[key]; // try again next compile
            var message = 'In once[' + JSON.stringify(key) + ']: ' + err;
            (err instanceof Warning ? warnings : errors).push(message);
          }
        }
      }

      if (errors.length) {
        _error(errors.concat(warnings).join(';\n'));
        return;
      }

      if (warnings.length) {
        _warn(warnings.join(';\n'));
        return;
      }

      for (var i = 0; i < compileHandlers.length; ++i) {
        compileHandlers[i]();
      }
    };

    _stopCompiling = function () {
      compiling = false;
      _warn('hit escape to compile');
    };

    _startCompiling = function () {
      compiling = true;
      _success();
      _compileSource();
      _codemirror.focus();
    };

    _toggleCompiling = function () {
      compiling ? _stopCompiling() : _startCompiling();
    };

    _clearWorkspace = function () {
      for (var key in vars) { delete vars[key]; }
      for (var key in once) { delete once[key]; }
      for (var key in always) { delete always[key]; }
    };

    var alwaysTask = function () {
      if ($.isEmptyObject(always)) {
        setTimeout(alwaysTask, alwaysPollMs); // later
      } else {
        for (var key in always) {
          try {
            always[key]();
          }
          catch (err) {
            _error('In always[' + JSON.stringify(key) + ']: ' + err);
          }
        }
        setTimeout(alwaysTask, alwaysLoopMs); // sooner
      }
    };

    _startAlways = function () {
      _startAlways = function () {};
      alwaysTask();
    };

  })();

  //----------------------------------------------------------------------------
  // Scheduling: safe, clearable

  var _setTimeout;
  var _clearAllTimeouts;

  (function(){

    var taskCount = 0;
    var tasks = {};

    _setTimeout = function (action, delay) {

      var id = taskCount++;
      var safeAction = function () {
        try {
          action();
        }
        catch (err) {
          _error(err);
        }
        delete tasks[id];
      };

      tasks[id] = setTimeout(safeAction, delay);
    };

    _clearAllTimeouts = function () {
      for (var i in tasks) {
        clearTimeout(tasks[i]);
        delete tasks[i];
      }
    };

  })();

  //--------------------------------------------------------------------------
  // Help

  var _dir = function (o) {

    if (o.length > 100) {
      return '[...]';
    }

    var a = [], i = 0;
    for (a[i++] in o) {}
    return a;
  };

  var _help = function () {
    if (arguments.length === 0) {
      _print(_help.help);
    } else {

      var o = arguments[0];
      var message = '';

      try {
        if ('help' in o) {
          message += 'help: ' + o.help + '\n\n';
        }
      }
      catch (err) {}

      try {
        message += 'dir: ' + _dir(o) + '\n\n';
      }
      catch (err) {}

      message += 'JSON: ' + JSON.stringify(o) + '\n\n';

      message += 'string: "' + o + '"';

      _print(message);
    }
  };
  _help.help = 'try help(something), or see the help window';

  //--------------------------------------------------------------------------
  // Using external scripts

  var _using;

  (function(){

    var cached = {};

    _using = function (url) {

      if (url in cached) {
        if (cached[url]) {
          throw cached[url];
        } else {
          return;
        }
      }

      // see http://stackoverflow.com/questions/2723140
      // XXX ff does not support extended regexp: "invalid reg. exp. flag x"
      //assert(/^(http|https|ftp):\/\/[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/ix.test(url),
      //  'invalid url: ' + url);

      // this is an overly-restrictive requirement
      //assert(/\.js$/.test(url), 'url extension is not .js: ' + url);

      $.ajax({ url:url, dataType:'script', cache:true })
        .done(function (script, textStatus) {
              cached[url] = 0;
              log('using(' + url + '): ' + textStatus);
              _compileSource();
              _codemirror.focus();
            })
        .fail(function(jqxhr, settings, exception) {
              var message = 'Error using(' + url + '): ' + exception;
              cached[url] = message;
              log(message);
              _error(message);
            });

      throw new Warning('waiting for using(' + url + ') ...');
    };

  })();

  //----------------------------------------------------------------------------
  // Graphics

  var _context2d;
  window.mouseX = 0;
  window.mouseY = 0;

  var _initGraphics = function (canvas2d) {

    try {
      _context2d = canvas2d.getContext('2d');
      assert(_context2d, 'failed to get 2d canvas context');

      $(window).resize(function(){
            _context2d.canvas.width = innerWidth;
            _context2d.canvas.height = innerHeight;
          }).resize();
    }
    catch (err) {
      log(err);
      _error(err);
      _context2d = undefined;
    }

    $(document).mousemove(function(e){
          window.mouseX = e.pageX;
          window.mouseY = e.pageY;
        });
  };

  //----------------------------------------------------------------------------
  // Module interface

  return {

    init: live.init,

    setSource: live.setSource,
    getSource: live.getSource,

    toggleCompiling: _toggleCompiling,
    oncompile: live.oncompile,

    focus: function(){ _codemirror.focus(); },

    none: undefined
  };

})();

