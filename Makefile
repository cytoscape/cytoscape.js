# executables
YUI = java -jar yuicompressor-2.4.6.jar
YUIFLAGS = --line-break 500
RM = rm -rf
CAT = cat
CP = cp
ZIP = zip
MV = mv
PRINTF = printf
SED = sed
MKDIR = mkdir

# version (update this when building release zip)
VERSION = 2.0-snapshot

# targets (add scripts here to add to the release zip)
DEPENDENCIES = lib/jquery.color.js lib/jquery.svg.js lib/2D.js lib/jquery.mousewheel.js
LIB = jquery.cytoscapeweb.core.js jquery.cytoscapeweb.renderer.null.js jquery.cytoscapeweb.renderer.svg.js jquery.cytoscapeweb.layout.null.js jquery.cytoscapeweb.layout.random.js jquery.cytoscapeweb.layout.grid.js jquery.cytoscapeweb.layout.preset.js
EXTRAS = jquery.cytoscapeweb.layout.arbor.js jquery.cytoscapeweb.layout.arbor.js

# names of the cytoscape web release js files
JS_W_DEPS_FILE = $(BUILD_DIR)/jquery.cytoscapeweb.all.js
JS_WO_DEPS_FILE = $(BUILD_DIR)/jquery.cytoscapeweb.js
MIN_JS_W_DEPS_FILE = $(JS_W_DEPS_FILE:%.js=%.min.js)
MIN_JS_WO_DEPS_FILE = $(JS_WO_DEPS_FILE:%.js=%.min.js)

# configure what files to include in the zip
ZIP_FILE = $(BUILD_DIR)/jquery.cytoscapeweb-$(VERSION).zip
ZIP_CONTENTS = $(JS_W_DEPS_FILE) $(MIN_JS_W_DEPS_FILE) $(JS_WO_DEPS_FILE) $(MIN_JS_WO_DEPS_FILE) $(LIB) $(EXTRAS) $(LICENSE) $(README)
BUILD_DIR = build
LICENSE = LGPL-LICENSE.txt
PREAMBLE = PREAMBLE
README = README

# temp stuff
TEMP = $(BUILD_DIR)/temp
TEMPFILE = $(TEMP)/temp-file

all : zip

zip : $(ZIP_CONTENTS) $(ZIP_FILE)
	
minify : $(MIN_JS_W_DEPS_FILE) $(MIN_JS_WO_DEPS_FILE)

$(ZIP_FILE) : minify
	$(ZIP) $(ZIP_FILE) $(ZIP_CONTENTS)

$(JS_W_DEPS_FILE) : $(BUILD_DIR)
	$(CAT) $(BUILD)/$(PREAMBLE) $(DEPENDENCIES) $(LIB) > $@

$(JS_WO_DEPS_FILE) : $(BUILD_DIR)
	$(CAT) $(BUILD)/$(PREAMBLE) $(LIB) > $@

$(BUILD_DIR) : $(LIB) $(DEPENDENCIES) $(EXTRAS)
	$(MKDIR) $@
	$(MKDIR) $(TEMP)
	$(CP) $(^:$(BUILD_DIR)/%=%) $@ # copy files to build dir
	$(SED) "s/VERSION/${VERSION}/g" $(PREAMBLE) > $(BUILD)/$(PREAMBLE) # make preamble with VERSION populated

# rule for minifying a .js file to a .min.js file
%.min.js : %.js
	$(YUI) $(YUIFLAGS) $? -o $@
	$(CAT) $(BUILD)/$(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@
	$(PRINTF) "\n// $(@F)\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

clean : 
	$(RM) $(BUILD_DIR)
