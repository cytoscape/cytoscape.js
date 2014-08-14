#!/bin/bash

CD=cd
CP="cp -R"
RM="rm -rf"
GIT=git
TEMP_DIR=/tmp
DOC_DIR=documentation

$RM $TEMP_DIR/cytoscape.js
$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js
$CP $DOC_DIR/* $TEMP_DIR/cytoscape.js/beta
$CD $TEMP_DIR/cytoscape.js
$GIT add -A
$GIT commit -a -m "updating beta docs to $VERSION"
$GIT push origin