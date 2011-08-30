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

all : zip

zip :  $(ZIPFILE) $(ZIPCONTENTS)
	
minify : copy $(JSMINFILES) $(JSALLMINFILE)

$(ZIPFILE) : minify
	$(ZIP) $(ZIPFILE) $(ZIPCONTENTS)

copy : $(BUILDDIR)
	$(CP) $(JSFILES) $(BUILDDIR)

$(JSALLFILE) : $(BUILDDIR)
	$(CAT) $(JSFILES) > $@

$(BUILDDIR) : 
	mkdir $@

%.min.js : %.js
	$(YUI) $(YUIFLAGS) $? -o $@

clean : 
	$(RM) $(BUILDDIR)
