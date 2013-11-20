# executables -- change these as needed to correspond to where these are on your system
YUI = java -jar etc/yuicompressor-2.4.6.jar
YUIFLAGS = --line-break 500
RM = rm -rf
CAT = cat
CP = cp -R
ZIP = zip
UNZIP = unzip
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

# misc
LINE_SEP = --------------------------------------------------------------------------------

# version (update this when building release zip)
ifndef VERSION
	VERSION = github-snapshot-$(shell date +%Y.%m.%d-%H.%M.%S)
endif

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
DOC_API_DIR = documentation/api
DOC_API_LATEST = documentation/api/cytoscape.js-latest
DOC_API_NEW = documentation/api/cytoscape.js-$(VERSION)
DOC_DL_DIR = documentation/download
DEBUG_PAGE = debug/index.html
TEST_PAGE = tests/index.html
TEMP_DIR = /tmp
TEMP_DOC_DIR_NAME = cy-docs-temp

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
EXTENSIONS = $(EXTENSIONS_DIR)/renderer.null.js\
	$(EXTENSIONS_DIR)/renderer.canvas.define-and-init-etc.js\
	$(EXTENSIONS_DIR)/renderer.canvas.arrow-shapes.js\
	$(EXTENSIONS_DIR)/renderer.canvas.cached-eles.js\
	$(EXTENSIONS_DIR)/renderer.canvas.coord-ele-math.js\
	$(EXTENSIONS_DIR)/renderer.canvas.drawing-edges.js\
	$(EXTENSIONS_DIR)/renderer.canvas.drawing-images.js\
	$(EXTENSIONS_DIR)/renderer.canvas.drawing-label-text.js\
	$(EXTENSIONS_DIR)/renderer.canvas.drawing-nodes.js\
	$(EXTENSIONS_DIR)/renderer.canvas.drawing-redraw.js\
	$(EXTENSIONS_DIR)/renderer.canvas.drawing-shapes.js\
	$(EXTENSIONS_DIR)/renderer.canvas.export-image.js\
	$(EXTENSIONS_DIR)/renderer.canvas.load-and-listeners.js\
	$(EXTENSIONS_DIR)/renderer.canvas.node-shapes.js\
	$(EXTENSIONS_DIR)/layout.null.js\
	$(EXTENSIONS_DIR)/layout.random.js\
	$(EXTENSIONS_DIR)/layout.grid.js\
	$(EXTENSIONS_DIR)/layout.preset.js\
	$(EXTENSIONS_DIR)/layout.arbor.js\
	$(EXTENSIONS_DIR)/layout.circle.js\
	$(EXTENSIONS_DIR)/layout.breadthfirst.js\
	$(EXTENSIONS_DIR)/layout.cose.js\

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
ZIP_FILE_NAME = cytoscape.js-$(VERSION).zip
ZIP_FILE = $(BUILD_DIR)/$(ZIP_FILE_NAME)
ZIP_CONTENTS = $(JS_FILE) $(MIN_JS_FILE) $(LIBS) $(LICENSE) $(BUILD_PLUGINS) $(MIN_BUILD_PLUGINS)
ZIP_DIR = cytoscape.js-$(VERSION)
LICENSE = LGPL-LICENSE.txt
PREAMBLE = etc/PREAMBLE
README = README.md
RELEASE_DIR = releases

# temp stuff
TEMP = $(BUILD_DIR)/temp
TEMPFILE = $(TEMP)/temp-file
ROOT_DIR = $(shell pwd)

all : zip

zip : $(ZIP_CONTENTS) $(ZIP_FILE)

minify : $(MIN_JS_FILE) $(MIN_BUILD_PLUGINS) $(MIN_BUILD_EXTENSIONS)

docs : minify
	$(MAKE) -C $(DOC_DIR)

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

#confirms the version info before proceeding
version : 
	@echo $(LINE_SEP)
	@echo -- VERSION environment variable
	@echo $(LINE_SEP)
	@echo $(VERSION)
	@echo $(SEPARATOR)
	@echo If not set as desired for release, use \"export VERSION=1.2.3\" or similar.
	@echo Press ENTER to continue the build process, or CTRL+C to quit.
	@read 

tag : version
	@echo $(LINE_SEP)
	@echo -- Tagging repo...
	@echo $(LINE_SEP)
	git tag -a v$(VERSION) -m "v$(VERSION)"
	git push origin v$(VERSION)

# makes the release files but doesn't publish them
release : version all
	@echo $(LINE_SEP)
	@echo -- Making release resources...
	@echo $(LINE_SEP)
	$(MKDIR) $(RELEASE_DIR)
	$(MKDIR) $(RELEASE_DIR)/$(VERSION)
	$(CP) $(JS_FILE) $(RELEASE_DIR)/$(VERSION)
	$(CP) $(MIN_JS_FILE) $(RELEASE_DIR)/$(VERSION)

# publish to npm
npm : 
	@echo $(LINE_SEP)
	@echo -- Publishing to npm...
	@echo $(LINE_SEP)
	@echo -- package.json
	@echo $(LINE_SEP)
	@cat package.json
	@echo $(LINE_SEP)
	@echo Confirm that package.json is set properly for release, with matching VERSION etc.
	@echo Press ENTER to continue the build process, or CTRL+C to quit.
	@read 
	npm publish .

# publish to bower
bower : 
	@echo $(LINE_SEP)
	@echo -- Publishing to bower...
	@echo $(LINE_SEP)
	@echo -- bower.json
	@echo $(LINE_SEP)
	@cat bower.json
	@echo $(LINE_SEP)
	@echo Confirm that bower.json is set properly for release, with matching VERSION etc.
	@echo Press ENTER to continue the build process, or CTRL+C to quit.
	@read 
	bower 

# refresh the documentation
docsrefresh : 
	@echo $(LINE_SEP)
	@echo -- Refreshing local copy of docs...
	@echo $(LINE_SEP)
	@echo

	@echo $(LINE_SEP)
	@echo -- VERSION environment variable
	@echo $(LINE_SEP)
	@echo $(VERSION)
	@echo

	@echo $(LINE_SEP)
	@echo -- documentation/docmaker.json
	@echo $(LINE_SEP)
	@head documentation/docmaker.json
	@echo ...
	@echo
	@echo $(LINE_SEP)
	@echo Confirm that docmaker.json is set properly for release, with matching VERSION etc.
	@echo Press ENTER to continue the build process, or CTRL+C to quit.
	@read
	@echo

	@echo $(LINE_SEP)
	@echo -- documentation/md/downloads.md
	@echo $(LINE_SEP)
	@cat documentation/md/downloads.md
	@echo ...
	@echo
	@echo $(LINE_SEP)
	@echo Confirm that downloads.md has downloads specified up to the current version.
	@echo Press ENTER to continue the build process, or CTRL+C to quit.
	@read
	@echo

	@echo $(LINE_SEP)
	@echo -- Building docs...
	@echo $(LINE_SEP)
	$(MAKE) -C $(DOC_DIR)
	@echo

	@echo $(LINE_SEP)
	@echo -- Copying api resources to docs...
	@echo $(LINE_SEP)
	$(CP) $(ZIP_FILE) $(DOC_API_DIR)
	$(RM) $(DOC_API_NEW)
	$(RM) $(DOC_API_LATEST)
	$(UNZIP) $(DOC_API_DIR)/$(ZIP_FILE_NAME) -d $(DOC_API_DIR)
	$(MKDIR) $(DOC_API_LATEST)
	$(CP) $(DOC_API_NEW)/* $(DOC_API_LATEST)
	$(RM) $(DOC_API_DIR)/$(ZIP_FILE_NAME)
	@echo

	@echo $(LINE_SEP)
	@echo -- Copying download resources to docs...
	@echo $(LINE_SEP)
	$(CP) $(ZIP_FILE) $(DOC_DL_DIR)
	@echo

docspublish : docsrefresh
	@echo $(LINE_SEP)
	@echo -- Publishing docs to gh-pages...
	@echo $(LINE_SEP)
	$(RM) $(TEMP_DIR)/cytoscape.js
	git clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $(TEMP_DIR)/cytoscape.js
	$(CP) $(DOC_DIR)/* $(TEMP_DIR)/cytoscape.js
	$(MAKE) -C $(TEMP_DIR)/cytoscape.js publish
	@echo



# publish a new version of cy.js
publish : test version release docspublish tag npm

clean : 
	$(RM) $(BUILD_DIR)

debug : 
	$(OPEN) $(DEBUG_PAGE)

test : 
	$(OPEN) $(TEST_PAGE)
	@echo --
	@echo Confirm that the tests are passing.
	@echo Press ENTER to continue the build process, or CTRL+C to quit.
	@read 
