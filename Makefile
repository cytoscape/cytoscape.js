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

# version
VERSION = 2.0-snapshot

# targets
JSFILES = jquery.color.js jquery.svg.js jquery.cytoscapeweb.js jquery.cytoscapeweb.renderer.null.js jquery.cytoscapeweb.renderer.svg.js jquery.cytoscapeweb.layout.null.js jquery.cytoscapeweb.layout.random.js jquery.cytoscapeweb.layout.grid.js
JSBUILDFILES = $(JSFILES:%=$(BUILDDIR)/%)
JSMINFILES = $(JSBUILDFILES:%.js=%.min.js)
JSALLFILE = $(BUILDDIR)/jquery.cytoscapeweb.all.js
JSALLMINFILE = $(JSALLFILE:%.js=%.min.js)
ZIPFILE = $(BUILDDIR)/jquery.cytoscapeweb-$(VERSION).zip
ZIPCONTENTS = $(JSBUILDFILES) $(JSMINFILES) $(JSALLFILE) $(JSALLMINFILE) $(LICENSE) $(README)
BUILDDIR = build
LICENSE = LGPL-LICENSE.txt
PREAMBLE = PREAMBLE
BUILDPREAMBLE = $(PREAMBLE:%=$(BUILDDIR)/%)
README = README

# better change TEMPFILE if you don't have a /tmp dir; sorry windows :(
TEMPFILE = /tmp/cytowebtmp

all : zip

zip :  $(ZIPFILE) $(ZIPCONTENTS)
	
minify : $(JSBUILDFILES) $(JSMINFILES) $(JSALLMINFILE)

$(ZIPFILE) : minify
	$(ZIP) $(ZIPFILE) $(ZIPCONTENTS)

$(BUILDPREAMBLE) : $(BUILDDIR)
	$(SED) "s/VERSION/${VERSION}/g" $(PREAMBLE) > $(TEMPFILE)
	$(CP) $(TEMPFILE) $(BUILDPREAMBLE)

$(JSBUILDFILES) : $(BUILDDIR) $(BUILDPREAMBLE)
	$(CP) $(@:$(BUILDDIR)/%=%) $@
	$(CAT) $(BUILDPREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@
	$(PRINTF) "// $(@F)\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

$(JSALLFILE) : $(BUILDDIR)
	$(CAT) $(BUILDPREAMBLE) $(JSFILES) > $@
	$(PRINTF) "// $(@F)\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

$(BUILDDIR) : 
	$(MKDIR) $@

%.min.js : %.js
	$(YUI) $(YUIFLAGS) $? -o $@
	$(CAT) $(BUILDPREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@
	$(PRINTF) "// $(@F)\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

clean : 
	$(RM) $(BUILDDIR)
