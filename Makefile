# executables
YUI = java -jar yuicompressor-2.4.6.jar
YUIFLAGS = --line-break 500
RM = rm -rf
CAT = cat
CP = cp
ZIP = zip -Dr

# version
VERSION = 1.0-alpha

# targets
JSFILES = jquery.cytoscapeweb.js jquery.cytoscapeweb.layout.null.js jquery.cytoscapeweb.renderer.null.js
JSBUILDFILES = $(JSFILES:%=$(BUILDDIR)/%)
JSMINFILES = $(JSBUILDFILES:%.js=%.min.js)
JSALLFILE = $(BUILDDIR)/jquery.cytoscapeweb.all.js
JSALLMINFILE = $(JSALLFILE:%.js=%.min.js)
ZIPFILE = $(BUILDDIR)/jquery.cytoscapeweb-$(VERSION).zip
ZIPCONTENTS = $(JSBUILDFILES) $(JSMINFILES) $(JSALLFILE) $(JSALLMINFILE) $(LICENSE)
BUILDDIR = build
LICENSE = LGPL-LICENSE.txt
PREAMBLE = PREAMBLE
TEMPFILE = /tmp/out
MV = mv

all : zip

zip :  $(ZIPFILE) $(ZIPCONTENTS)
	
minify : $(JSBUILDFILES) $(JSMINFILES) $(JSALLMINFILE)

$(ZIPFILE) : minify
	$(ZIP) $(ZIPFILE) $(ZIPCONTENTS)

$(JSBUILDFILES) : $(BUILDDIR)
	$(CP) $(@:$(BUILDDIR)/%=%) $@
	$(CAT) $(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

$(JSALLFILE) : $(BUILDDIR)
	$(CAT) $(PREAMBLE) $(JSFILES) > $@

$(BUILDDIR) : 
	mkdir $@

%.min.js : %.js
	$(YUI) $(YUIFLAGS) $? -o $@
	$(CAT) $(PREAMBLE) | $(CAT) - $@ > $(TEMPFILE) && $(MV) $(TEMPFILE) $@

clean : 
	$(RM) $(BUILDDIR)
