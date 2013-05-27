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
MKDIR = mkdir -p
CD = cd
PWD = pwd
LS = ls
OPEN = open
AWK_NEWLINE = awk 'FNR==1{print ""}{print}'
PREAMBLIFY = $(SED) "s/\#(VERSION)/${VERSION}/g" $(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@ && $(PRINTF) "\n/* $(@F) */\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@
MAKE = make

# version (update this when building release zip)
VERSION := 2.0.1-github-snapshot-$(shell date +%Y.%m.%d-%H.%M.%S)

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
DOC_DIR = documentation
DEBUG_PAGE = debug/index.html
TEST_PAGE = tests/index.html

# dependencies for the .all.js file
LIBS = $(LIB_DIR)/arbor.js

# the files that make up the cytoweb core
CORE = $(SRC_DIR)/namespace.js\
	$(SRC_DIR)/is.js\
	$(SRC_DIR)/util.js\
	$(SRC_DIR)/math.js\
	$(SRC_DIR)/instance-registration.js\
	$(SRC_DIR)/extension.js\
	$(SRC_DIR)/jquery-plugin.js\
	$(SRC_DIR)/event.js\
	$(SRC_DIR)/define.js\
	$(SRC_DIR)/style.js\
	$(SRC_DIR)/core.js\
	$(SRC_DIR)/core-add-remove.js\
	$(SRC_DIR)/core-animation.js\
	$(SRC_DIR)/core-data-functions.js\
	$(SRC_DIR)/core-events.js\
	$(SRC_DIR)/core-export.js\
	$(SRC_DIR)/core-layout.js\
	$(SRC_DIR)/core-notification.js\
	$(SRC_DIR)/core-renderer.js\
	$(SRC_DIR)/core-search.js\
	$(SRC_DIR)/core-style.js\
	$(SRC_DIR)/core-viewport.js\
	$(SRC_DIR)/collection.js\
	$(SRC_DIR)/collection-animation.js\
	$(SRC_DIR)/collection-class.js\
	$(SRC_DIR)/collection-comparators.js\
	$(SRC_DIR)/collection-data-functions.js\
	$(SRC_DIR)/collection-degree.js\
	$(SRC_DIR)/collection-events.js\
	$(SRC_DIR)/collection-group.js\
	$(SRC_DIR)/collection-iteration.js\
	$(SRC_DIR)/collection-switch-functions.js\
	$(SRC_DIR)/collection-traversing.js\
	$(SRC_DIR)/selector.js

# extensions (list them manually if you don't want them all)	$(wildcard $(EXTENSIONS_DIR)/*)
EXTENSIONS = $(EXTENSIONS_DIR)/cytoscape.renderer.null.js\
	$(EXTENSIONS_DIR)/cytoscape.renderer.canvas.js\
	$(EXTENSIONS_DIR)/cytoscape.layout.null.js\
	$(EXTENSIONS_DIR)/cytoscape.layout.random.js\
	$(EXTENSIONS_DIR)/cytoscape.layout.grid.js\
	$(EXTENSIONS_DIR)/cytoscape.layout.preset.js\
	$(EXTENSIONS_DIR)/cytoscape.layout.arbor.js\
	$(EXTENSIONS_DIR)/cytoscape.layout.circle.js\
	$(EXTENSIONS_DIR)/cytoscape.layout.breadthfirst.js\

# plugins (list them manually if you don't want them all)
PLUGINS = $(wildcard $(PLUGINS_DIR)/*)

# names of the cytoscape web release js files
JS_FILE = $(BUILD_DIR)/cytoscape.js
MIN_JS_FILE = $(JS_FILE:%.js=%.min.js)
BUILD_PLUGINS = $(patsubst $(SRC_DIR)/%,$(BUILD_DIR)/%,$(PLUGINS))
MIN_BUILD_PLUGINS =  $(BUILD_PLUGINS:%.js=%.min.js)
BUILD_EXTENSIONS = $(patsubst $(SRC_DIR)/%,$(BUILD_DIR)/%,$(EXTENSIONS))
MIN_BUILD_EXTENSIONS =  $(BUILD_EXTENSIONS:%.js=%.min.js)

# configure what files to include in the zip
ZIP_FILE = $(BUILD_DIR)/cytoscape.js-$(VERSION).zip
ZIP_CONTENTS = $(JS_FILE) $(MIN_JS_FILE) $(LIBS) $(LICENSE) $(BUILD_PLUGINS) $(MIN_BUILD_PLUGINS)
ZIP_DIR = cytoscape.js-$(VERSION)
LICENSE = LGPL-LICENSE.txt
PREAMBLE = etc/PREAMBLE
README = README.md

# temp stuff
TEMP = $(BUILD_DIR)/temp
TEMPFILE = $(TEMP)/temp-file
CWD = `$(PWD)`

all : zip

zip : $(ZIP_CONTENTS) $(ZIP_FILE)
	
minify : $(MIN_JS_FILE) $(MIN_BUILD_PLUGINS) $(MIN_BUILD_EXTENSIONS)

docs : minify
	$(CD) $(DOC_DIR)
	$(MAKE)

$(ZIP_DIR) : minify
	$(RM) $(ZIP_DIR)
	$(MKDIR) $(ZIP_DIR)
	$(CP) $(ZIP_CONTENTS) $(ZIP_DIR)

$(ZIP_FILE) : $(ZIP_DIR)
	$(ZIP) -r $(ZIP_FILE) $(ZIP_DIR)
	$(RM) $(ZIP_DIR)

$(JS_FILE) : $(BUILD_DIR)
	$(AWK_NEWLINE) $(CORE) $(EXTENSIONS) > $@
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
	$(RM) $(BUILD_DIR)

.PHONY: debug
debug : 
	$(OPEN) $(DEBUG_PAGE)

.PHONY: test
test : 
	$(OPEN) $(TEST_PAGE)
