# executables -- change these as needed to correspond to where these are on your system
YUI = java -jar yuicompressor-2.4.6.jar
YUIFLAGS = --line-break 500
RM = rm -rf
CAT = cat
CP = cp -R
ZIP = zip
MV = mv
PRINTF = printf
SED = sed
MKDIR = mkdir
CD = cd
PWD = pwd
LS = ls
PREAMBLIFY = $(SED) "s/\#(VERSION)/${VERSION}/g" $(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@ && $(PRINTF) "\n/* $(@F) */\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

# version (update this when building release zip)
VERSION = snapshot-$(shell date +%Y.%m.%d-%H.%M.%S)

# directories
LIB_DIR = lib
SRC_DIR = src
EXTENSIONS_DIR = $(SRC_DIR)/extensions
PLUGINS_DIR = $(SRC_DIR)/plugins
BUILD_DIR = build

LIBS = $(LIB_DIR)/jquery.color.js\
	$(LIB_DIR)/jquery.svg.js\
	$(LIB_DIR)/2D.js\
	$(LIB_DIR)/jquery.mousewheel.js

# the files that make up the cytoweb core
CORE = $(SRC_DIR)/jquery.cytoscapeweb.core.js

# the contents of the library when combined into the .all.js file
DEPS = $(CORE)\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.renderer.null.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.renderer.svg.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.null.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.random.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.grid.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.preset.js

# extensions
EXTENSIONS = $(wildcard $(EXTENSIONS_DIR)/*)

# plugins
PLUGINS = $(wildcard $(PLUGINS_DIR)/*)

# names of the cytoscape web release js files
JS_W_DEPS_FILE = $(BUILD_DIR)/jquery.cytoscapeweb.all.js
JS_WO_DEPS_FILE = $(BUILD_DIR)/jquery.cytoscapeweb.js
MIN_JS_W_DEPS_FILE = $(JS_W_DEPS_FILE:%.js=%.min.js)
MIN_JS_WO_DEPS_FILE = $(JS_WO_DEPS_FILE:%.js=%.min.js)

# configure what files to include in the zip
ZIP_FILE = $(BUILD_DIR)/jquery.cytoscapeweb-$(VERSION).zip
ZIP_CONTENTS = $(JS_W_DEPS_FILE) $(MIN_JS_W_DEPS_FILE) $(JS_WO_DEPS_FILE) $(MIN_JS_WO_DEPS_FILE) $(LIB_DIR) $(EXTENSIONS_DIR) $(PLUGINS_DIR) $(LICENSE) $(README)
ZIP_DIR = jquery.cytoscapeweb-$(VERSION)
LICENSE = LGPL-LICENSE.txt
PREAMBLE = PREAMBLE
README = README

# temp stuff
TEMP = $(BUILD_DIR)/temp
TEMPFILE = $(TEMP)/temp-file
CWD = `$(PWD)`

all : zip

zip : $(ZIP_CONTENTS) $(ZIP_FILE)
	
minify : $(MIN_JS_W_DEPS_FILE) $(MIN_JS_WO_DEPS_FILE) $(BUILD_DIR)

$(ZIP_DIR) : minify
	$(RM) $(ZIP_DIR)
	$(MKDIR) $(ZIP_DIR)
	$(CP) $(ZIP_CONTENTS) $(ZIP_DIR)

$(ZIP_FILE) : $(ZIP_DIR)
	$(ZIP) -r $(ZIP_FILE) $(ZIP_DIR)
	$(RM) $(ZIP_DIR)

$(JS_W_DEPS_FILE) : $(BUILD_DIR)
	$(CAT) $(DEPS) $(CORE) > $@
	$(call PREAMBLIFY)

$(JS_WO_DEPS_FILE) : $(BUILD_DIR)
	$(CAT) $(CORE) > $@
	$(call PREAMBLIFY)

$(BUILD_DIR) :
	$(MKDIR) $@
	$(MKDIR) $(TEMP)

# rule for minifying a .js file to a .min.js file
%.min.js : %.js
	$(YUI) $(YUIFLAGS) $? -o $@
	$(call PREAMBLIFY)

clean : 
	echo $(EXTENSIONS)
	$(RM) $(BUILD_DIR)
