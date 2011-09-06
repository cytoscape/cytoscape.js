# executables
YUI = java -jar yuicompressor-2.4.6.jar
YUIFLAGS = --line-break 500
RM = rm -rf
CAT = cat
CP = cp
ZIP = zip
MV = mv
PRINTF = printf

# version
VERSION = 2.0-snapshot

# targets
JSFILES = jquery.svg.js jquery.cytoscapeweb.js jquery.cytoscapeweb.renderer.null.js jquery.cytoscapeweb.layout.null.js jquery.cytoscapeweb.layout.random.js jquery.cytoscapeweb.layout.grid.js
JSBUILDFILES = $(JSFILES:%=$(BUILDDIR)/%)
JSMINFILES = $(JSBUILDFILES:%.js=%.min.js)
JSALLFILE = $(BUILDDIR)/jquery.cytoscapeweb.all.js
JSALLMINFILE = $(JSALLFILE:%.js=%.min.js)
ZIPFILE = $(BUILDDIR)/jquery.cytoscapeweb-$(VERSION).zip
ZIPCONTENTS = $(JSBUILDFILES) $(JSMINFILES) $(JSALLFILE) $(JSALLMINFILE) $(LICENSE) $(README)
BUILDDIR = build
LICENSE = LGPL-LICENSE.txt
PREAMBLE = PREAMBLE
README = README

# better change TEMPFILE if you don't have a /tmp dir; sorry windows :(
TEMPFILE = /tmp/cytowebtmp

all : zip

zip :  $(ZIPFILE) $(ZIPCONTENTS)
	
minify : $(JSBUILDFILES) $(JSMINFILES) $(JSALLMINFILE)

$(ZIPFILE) : minify
	$(ZIP) $(ZIPFILE) $(ZIPCONTENTS)

$(JSBUILDFILES) : $(BUILDDIR)
	$(CP) $(@:$(BUILDDIR)/%=%) $@
	$(CAT) $(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@
	$(PRINTF) "// $(@F)\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

$(JSALLFILE) : $(BUILDDIR)
	$(CAT) $(PREAMBLE) $(JSFILES) > $@
	$(PRINTF) "// $(@F)\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

$(BUILDDIR) : 
	mkdir $@

%.min.js : %.js
	$(YUI) $(YUIFLAGS) $? -o $@
	$(CAT) $(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@
	$(PRINTF) "// $(@F)\n\n" | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

clean : 
	$(RM) $(BUILDDIR)
