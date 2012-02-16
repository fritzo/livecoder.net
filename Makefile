
all:

#-------------------------------------------------------------------------------
# build & release tools


compiler: FORCE
	rm -rf compiler
	mkdir compiler
	( test -e /tmp/closure-compiler.zip || \
	  wget http://closure-compiler.googlecode.com/files/compiler-latest.zip \
	    -O /tmp/closure-compiler.zip ) && \
	unzip /tmp/closure-compiler.zip -d compiler || \
	rm -rf compiler

COMPILE = java -jar compiler/compiler.jar \
	--compilation_level SIMPLE_OPTIMIZATIONS \
	--language_in=ECMASCRIPT5_STRICT \
	--generate_exports

#-------------------------------------------------------------------------------
# external libraries

extern:
	mkdir extern

extern/wavencoderjs: extern
	( cd extern ; \
	  test -e wavencoderjs || \
	  git clone https://fritzo@github.com/fritzo/wavencoderjs.git && \
	  cd wavencoderjs && git pull )

extern/codemirror: extern
	rm -rf extern/CodeMirror-*
	( test -e /tmp/codemirror.zip || \
	  wget http://codemirror.net/codemirror.zip -O /tmp/codemirror.zip )
	unzip /tmp/codemirror.zip -d extern/ && \
	( cd extern ; ln -sf CodeMirror-* codemirror )

extern/audiolibjs: extern FORCE
	rm -rf extern/*-audiolib.js-*
	( test -e /tmp/audiolibjs.zip || \
	  wget https://github.com/jussi-kalliokoski/audiolib.js/zipball/master \
	    -O /tmp/audiolibjs.zip ) && \
	unzip /tmp/audiolibjs.zip -d extern/ && \
	( cd extern ; ln -sf *-audiolib.js-* audiolibjs )

extern/diff_match_patch.js: extern FORCE
	rm -rf extern/diff_match_patch* && \
	( test -e /tmp/diff_match_patch.zip || \
	  wget http://google-diff-match-patch.googlecode.com/files/diff_match_patch_20120106.zip \
	    -O /tmp/diff_match_patch.zip ) && \
	unzip /tmp/diff_match_patch.zip -d extern/ && \
	( cd extern ; ln -sf diff_match_patch_*/javascript/diff_match_patch.js )

extern/espeak: extern FORCE
	( cd extern ; \
	  test -e espeak || \
	  git clone https://github.com/kripken/speak.js.git espeak && \
	  cd espeak && git pull )

#-------------------------------------------------------------------------------
# livecoder

live-wavencoder: extern/wavencoderjs
	cp extern/wavencoderjs/wavencoder.js client/

live-codemirror: extern/codemirror compiler
	# concat css
	cat extern/codemirror/lib/codemirror.css \
	    extern/codemirror/lib/util/dialog.css \
	    extern/codemirror/lib/util/simple-hint.css \
	  > client/codemirror.css
	# concat + compress javascript
	cp extern/codemirror/mode/javascript/javascript.js \
	   client/cm-javascript.js # for reference only; we fork as cm-live.js
	$(COMPILE) \
	  --js=extern/codemirror/lib/codemirror.js \
	  --js=extern/codemirror/lib/util/dialog.js \
	  --js=extern/codemirror/lib/util/searchcursor.js \
	  --js=extern/codemirror/lib/util/search.js \
	  --js=extern/codemirror/lib/util/simple-hint.js \
	  --js=extern/codemirror/lib/util/javascript-hint.js \
	  --js=extern/codemirror/lib/util/overlay.js \
	  --js_output_file=client/codemirror.min.js

live-espeak: extern/espeak
	cp extern/espeak/speakClient.js client/
	cp extern/espeak/speakGenerator.js client/
	cp extern/espeak/speakWorker.js client/
	cat client/speakGenerator.js client/speakWrapper.js > client/speech.js

live-dmp: extern/diff_match_patch.js
	cp extern/diff_match_patch.js client/
	chmod 644 client/diff_match_patch.js

live: live-wavencoder live-codemirror live-espeak live-dmp FORCE

#-------------------------------------------------------------------------------
# deployment

push:
	sed "s/DATE/`date`/g" client/release.manifest > client/cache.manifest
	rsync -aHvxz client/ fritzoor@fritzo.org:www/live
	rm client/cache.manifest

#-------------------------------------------------------------------------------

clean: FORCE
	rm -rf build release
	rm -f keys.tbz2

cleaner: clean FORCE
	rm -rf extern compiler linter

FORCE:

