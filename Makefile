# executables -- change these as needed to correspond to where these are on your system
YUI = java -jar etc/yuicompressor-2.4.6.jar
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
AWK_NEWLINE = awk 'FNR==1{print ""}{print}'
PREAMBLIFY = $(SED) "s/\#(VERSION)/${VERSION}/g" $(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@ && $(PRINTF) "\n/* $(@F) */\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

# version (update this when building release zip)
VERSION := snapshot-$(shell date +%Y.%m.%d-%H.%M.%S)

# directories
LIB_DIR = lib
SRC_DIR = src
EXTENSIONS_DIR_NAME = extensions
EXTENSIONS_DIR = $(SRC_DIR)/$(EXTENSIONS_DIR_NAME)
BUILD_EXTENSIONS_DIR = $(BUILD_DIR)/$(EXTENSIONS_DIR_NAME)
PLUGINS_DIR_NAME = plugins
PLUGINS_DIR = $(SRC_DIR)/$(PLUGINS_DIR_NAME)
BUILD_PLUGINS_DIR = $(BUILD_DIR)/$(PLUGINS_DIR_NAME)
BUILD_DIR = build

# dependencies for the .all.js file
LIBS = $(LIB_DIR)/jquery.color.js\
	$(LIB_DIR)/jquery.svg.js\
	$(LIB_DIR)/2D.js\
	$(LIB_DIR)/jquery.mousewheel.js

# the files that make up the cytoweb core
CORE = $(SRC_DIR)/jquery.cytoscapeweb.core.js

# the contents of the library when combined into the .all.js file
DEPS = $(EXTENSIONS_DIR)/jquery.cytoscapeweb.renderer.null.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.renderer.svg.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.null.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.random.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.grid.js\
	$(EXTENSIONS_DIR)/jquery.cytoscapeweb.layout.preset.js\
	$(LIBS)

# extensions (list them manually if you don't want them all)
EXTENSIONS = $(wildcard $(EXTENSIONS_DIR)/*)

# plugins (list them manually if you don't want them all)
PLUGINS = $(wildcard $(PLUGINS_DIR)/*)

# names of the cytoscape web release js files
JS_W_DEPS_FILE = $(BUILD_DIR)/jquery.cytoscapeweb.all.js
JS_WO_DEPS_FILE = $(BUILD_DIR)/jquery.cytoscapeweb.js
MIN_JS_W_DEPS_FILE = $(JS_W_DEPS_FILE:%.js=%.min.js)
MIN_JS_WO_DEPS_FILE = $(JS_WO_DEPS_FILE:%.js=%.min.js)
BUILD_PLUGINS = $(patsubst $(SRC_DIR)/%,$(BUILD_DIR)/%,$(PLUGINS))
MIN_BUILD_PLUGINS =  $(BUILD_PLUGINS:%.js=%.min.js)
BUILD_EXTENSIONS = $(patsubst $(SRC_DIR)/%,$(BUILD_DIR)/%,$(EXTENSIONS))
MIN_BUILD_EXTENSIONS =  $(BUILD_EXTENSIONS:%.js=%.min.js)

# configure what files to include in the zip
ZIP_FILE = $(BUILD_DIR)/jquery.cytoscapeweb-$(VERSION).zip
ZIP_CONTENTS = $(JS_W_DEPS_FILE) $(MIN_JS_W_DEPS_FILE) $(JS_WO_DEPS_FILE) $(MIN_JS_WO_DEPS_FILE) $(BUILD_EXTENSIONS_DIR) $(BUILD_PLUGINS_DIR) $(LIB_DIR) $(LICENSE) $(README)
ZIP_DIR = jquery.cytoscapeweb-$(VERSION)
LICENSE = LGPL-LICENSE.txt
PREAMBLE = etc/PREAMBLE
README = README

# temp stuff
TEMP = $(BUILD_DIR)/temp
TEMPFILE = $(TEMP)/temp-file
CWD = `$(PWD)`

all : zip

zip : $(ZIP_CONTENTS) $(ZIP_FILE)
	
minify : $(MIN_JS_W_DEPS_FILE) $(MIN_JS_WO_DEPS_FILE) $(MIN_BUILD_PLUGINS) $(MIN_BUILD_EXTENSIONS)

$(ZIP_DIR) : minify
	$(RM) $(ZIP_DIR)
	$(MKDIR) $(ZIP_DIR)
	$(CP) $(ZIP_CONTENTS) $(ZIP_DIR)

$(ZIP_FILE) : $(ZIP_DIR)
	$(ZIP) -r $(ZIP_FILE) $(ZIP_DIR)
	$(RM) $(ZIP_DIR)

$(JS_W_DEPS_FILE) : $(BUILD_DIR)
	$(AWK_NEWLINE) $(CORE) $(DEPS) > $@
	$(call PREAMBLIFY)

$(JS_WO_DEPS_FILE) : $(BUILD_DIR)
	$(AWK_NEWLINE) $(CORE) > $@
	$(call PREAMBLIFY)

$(BUILD_PLUGINS) : $(BUILD_PLUGINS_DIR)
	$(CP) $(patsubst $(BUILD_DIR)/%,$(SRC_DIR)/%,$@) $(BUILD_PLUGINS_DIR)
	$(call PREAMBLIFY)
	
$(BUILD_EXTENSIONS) : $(BUILD_EXTENSIONS_DIR)
	$(CP) $(patsubst $(BUILD_DIR)/%,$(SRC_DIR)/%,$@) $(BUILD_EXTENSIONS_DIR)
	$(call PREAMBLIFY)

$(BUILD_PLUGINS_DIR) $(BUILD_EXTENSIONS_DIR) $(TEMP) : $(BUILD_DIR)
	$(MKDIR) $@

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
