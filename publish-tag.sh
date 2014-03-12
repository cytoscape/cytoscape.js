#!/bin/bash

GIT=git

$GIT tag -a v$VERSION -m "v$VERSION"
$GIT push origin v$VERSION