Clazz.declarePackage ("org.ivis.layout");
c$ = Clazz.decorateAsClass (function () {
this.general = null;
this.coSE = null;
this.cluster = null;
this.ciSE = null;
this.avsdf = null;
this.spring = null;
this.sgym = null;
if (!Clazz.isClassDefined ("org.ivis.layout.LayoutOptionsPack.General")) {
org.ivis.layout.LayoutOptionsPack.$LayoutOptionsPack$General$ ();
}
if (!Clazz.isClassDefined ("org.ivis.layout.LayoutOptionsPack.CoSE")) {
org.ivis.layout.LayoutOptionsPack.$LayoutOptionsPack$CoSE$ ();
}
if (!Clazz.isClassDefined ("org.ivis.layout.LayoutOptionsPack.Cluster")) {
org.ivis.layout.LayoutOptionsPack.$LayoutOptionsPack$Cluster$ ();
}
if (!Clazz.isClassDefined ("org.ivis.layout.LayoutOptionsPack.CiSE")) {
org.ivis.layout.LayoutOptionsPack.$LayoutOptionsPack$CiSE$ ();
}
if (!Clazz.isClassDefined ("org.ivis.layout.LayoutOptionsPack.AVSDF")) {
org.ivis.layout.LayoutOptionsPack.$LayoutOptionsPack$AVSDF$ ();
}
if (!Clazz.isClassDefined ("org.ivis.layout.LayoutOptionsPack.Spring")) {
org.ivis.layout.LayoutOptionsPack.$LayoutOptionsPack$Spring$ ();
}
if (!Clazz.isClassDefined ("org.ivis.layout.LayoutOptionsPack.Sgym")) {
org.ivis.layout.LayoutOptionsPack.$LayoutOptionsPack$Sgym$ ();
}
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "LayoutOptionsPack", null, java.io.Serializable);
Clazz.makeConstructor (c$, 
($fz = function () {
this.general = Clazz.innerTypeInstance (org.ivis.layout.LayoutOptionsPack.General, this, null);
this.coSE = Clazz.innerTypeInstance (org.ivis.layout.LayoutOptionsPack.CoSE, this, null);
this.cluster = Clazz.innerTypeInstance (org.ivis.layout.LayoutOptionsPack.Cluster, this, null);
this.ciSE = Clazz.innerTypeInstance (org.ivis.layout.LayoutOptionsPack.CiSE, this, null);
this.avsdf = Clazz.innerTypeInstance (org.ivis.layout.LayoutOptionsPack.AVSDF, this, null);
this.spring = Clazz.innerTypeInstance (org.ivis.layout.LayoutOptionsPack.Spring, this, null);
this.sgym = Clazz.innerTypeInstance (org.ivis.layout.LayoutOptionsPack.Sgym, this, null);
this.setDefaultLayoutProperties ();
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "setDefaultLayoutProperties", 
function () {
this.general.setAnimationPeriod (50);
this.general.setAnimationDuringLayout (false);
this.general.setAnimationOnLayout (true);
this.general.setLayoutQuality (1);
this.general.setIncremental (false);
this.general.setCreateBendsAsNeeded (false);
this.general.setUniformLeafNodeSizes (false);
this.coSE.setIdealEdgeLength (50);
this.coSE.setSmartEdgeLengthCalc (true);
this.coSE.setMultiLevelScaling (false);
this.coSE.setSmartRepulsionRangeCalc (true);
this.coSE.setSpringStrength (50);
this.coSE.setRepulsionStrength (50);
this.coSE.setGravityStrength (50);
this.coSE.setCompoundGravityStrength (50);
this.coSE.setGravityRange (50);
this.coSE.setCompoundGravityRange (50);
this.ciSE.setNodeSeparation (12);
this.ciSE.setDesiredEdgeLength (50);
this.ciSE.setInterClusterEdgeLengthFactor (50);
this.ciSE.setAllowNodesInsideCircle (false);
this.ciSE.setMaxRatioOfNodesInsideCircle (0.2);
this.avsdf.setNodeSeparation (60);
this.cluster.setIdealEdgeLength (50);
this.cluster.setClusterSeperation (50);
this.cluster.setClusterGravityStrength (50);
this.spring.setDisconnectedNodeDistanceSpringRestLength (Math.round (250.0));
this.spring.setNodeDistanceRestLength (Math.round (60.0));
this.sgym.setHorizontalSpacing (100);
this.sgym.setVerticalSpacing (80);
this.sgym.setVertical (true);
});
c$.getInstance = Clazz.defineMethod (c$, "getInstance", 
function () {
if (org.ivis.layout.LayoutOptionsPack.instance == null) {
($t$ = org.ivis.layout.LayoutOptionsPack.instance =  new org.ivis.layout.LayoutOptionsPack (), org.ivis.layout.LayoutOptionsPack.prototype.instance = org.ivis.layout.LayoutOptionsPack.instance, $t$);
}return org.ivis.layout.LayoutOptionsPack.instance;
});
Clazz.defineMethod (c$, "getSgym", 
function () {
return this.sgym;
});
Clazz.defineMethod (c$, "getCoSE", 
function () {
return this.coSE;
});
Clazz.defineMethod (c$, "getSpring", 
function () {
return this.spring;
});
Clazz.defineMethod (c$, "getCluster", 
function () {
return this.cluster;
});
Clazz.defineMethod (c$, "getCiSE", 
function () {
return this.ciSE;
});
Clazz.defineMethod (c$, "getAVSDF", 
function () {
return this.avsdf;
});
Clazz.defineMethod (c$, "getGeneral", 
function () {
return this.general;
});
c$.$LayoutOptionsPack$General$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.layoutQuality = 0;
this.animationDuringLayout = false;
this.animationOnLayout = false;
this.animationPeriod = 0;
this.incremental = false;
this.createBendsAsNeeded = false;
this.uniformLeafNodeSizes = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.LayoutOptionsPack, "General");
Clazz.defineMethod (c$, "getLayoutQuality", 
function () {
return this.layoutQuality;
});
Clazz.defineMethod (c$, "setLayoutQuality", 
function (a) {
this.layoutQuality = a;
}, "~N");
Clazz.defineMethod (c$, "isAnimationDuringLayout", 
function () {
return this.animationDuringLayout;
});
Clazz.defineMethod (c$, "setAnimationDuringLayout", 
function (a) {
this.animationDuringLayout = a;
}, "~B");
Clazz.defineMethod (c$, "isAnimationOnLayout", 
function () {
return this.animationOnLayout;
});
Clazz.defineMethod (c$, "setAnimationOnLayout", 
function (a) {
this.animationOnLayout = a;
}, "~B");
Clazz.defineMethod (c$, "getAnimationPeriod", 
function () {
return this.animationPeriod;
});
Clazz.defineMethod (c$, "setAnimationPeriod", 
function (a) {
this.animationPeriod = a;
}, "~N");
Clazz.defineMethod (c$, "isIncremental", 
function () {
return this.incremental;
});
Clazz.defineMethod (c$, "setIncremental", 
function (a) {
this.incremental = a;
}, "~B");
Clazz.defineMethod (c$, "isCreateBendsAsNeeded", 
function () {
return this.createBendsAsNeeded;
});
Clazz.defineMethod (c$, "setCreateBendsAsNeeded", 
function (a) {
this.createBendsAsNeeded = a;
}, "~B");
Clazz.defineMethod (c$, "isUniformLeafNodeSizes", 
function () {
return this.uniformLeafNodeSizes;
});
Clazz.defineMethod (c$, "setUniformLeafNodeSizes", 
function (a) {
this.uniformLeafNodeSizes = a;
}, "~B");
c$ = Clazz.p0p ();
};
c$.$LayoutOptionsPack$CoSE$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.idealEdgeLength = 0;
this.springStrength = 0;
this.repulsionStrength = 0;
this.smartRepulsionRangeCalc = false;
this.gravityStrength = 0;
this.compoundGravityStrength = 0;
this.gravityRange = 0;
this.compoundGravityRange = 0;
this.smartEdgeLengthCalc = false;
this.multiLevelScaling = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.LayoutOptionsPack, "CoSE");
Clazz.defineMethod (c$, "getIdealEdgeLength", 
function () {
return this.idealEdgeLength;
});
Clazz.defineMethod (c$, "setIdealEdgeLength", 
function (a) {
this.idealEdgeLength = a;
}, "~N");
Clazz.defineMethod (c$, "getSpringStrength", 
function () {
return this.springStrength;
});
Clazz.defineMethod (c$, "setSpringStrength", 
function (a) {
this.springStrength = a;
}, "~N");
Clazz.defineMethod (c$, "getRepulsionStrength", 
function () {
return this.repulsionStrength;
});
Clazz.defineMethod (c$, "setRepulsionStrength", 
function (a) {
this.repulsionStrength = a;
}, "~N");
Clazz.defineMethod (c$, "getGravityStrength", 
function () {
return this.gravityStrength;
});
Clazz.defineMethod (c$, "setGravityStrength", 
function (a) {
this.gravityStrength = a;
}, "~N");
Clazz.defineMethod (c$, "getCompoundGravityStrength", 
function () {
return this.compoundGravityStrength;
});
Clazz.defineMethod (c$, "setCompoundGravityStrength", 
function (a) {
this.compoundGravityStrength = a;
}, "~N");
Clazz.defineMethod (c$, "getGravityRange", 
function () {
return this.gravityRange;
});
Clazz.defineMethod (c$, "setGravityRange", 
function (a) {
this.gravityRange = a;
}, "~N");
Clazz.defineMethod (c$, "getCompoundGravityRange", 
function () {
return this.compoundGravityRange;
});
Clazz.defineMethod (c$, "setCompoundGravityRange", 
function (a) {
this.compoundGravityRange = a;
}, "~N");
Clazz.defineMethod (c$, "isSmartEdgeLengthCalc", 
function () {
return this.smartEdgeLengthCalc;
});
Clazz.defineMethod (c$, "setSmartEdgeLengthCalc", 
function (a) {
this.smartEdgeLengthCalc = a;
}, "~B");
Clazz.defineMethod (c$, "isMultiLevelScaling", 
function () {
return this.multiLevelScaling;
});
Clazz.defineMethod (c$, "setMultiLevelScaling", 
function (a) {
this.multiLevelScaling = a;
}, "~B");
Clazz.defineMethod (c$, "setSmartRepulsionRangeCalc", 
function (a) {
this.smartRepulsionRangeCalc = a;
}, "~B");
Clazz.defineMethod (c$, "isSmartRepulsionRangeCalc", 
function () {
return this.smartRepulsionRangeCalc;
});
c$ = Clazz.p0p ();
};
c$.$LayoutOptionsPack$Cluster$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.idealEdgeLength = 0;
this.clusterSeperation = 0;
this.clusterGravityStrength = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.LayoutOptionsPack, "Cluster");
Clazz.defineMethod (c$, "getClusterSeperation", 
function () {
return this.clusterSeperation;
});
Clazz.defineMethod (c$, "setClusterSeperation", 
function (a) {
this.clusterSeperation = a;
}, "~N");
Clazz.defineMethod (c$, "getIdealEdgeLength", 
function () {
return this.idealEdgeLength;
});
Clazz.defineMethod (c$, "setIdealEdgeLength", 
function (a) {
this.idealEdgeLength = a;
}, "~N");
Clazz.defineMethod (c$, "getClusterGravityStrength", 
function () {
return this.clusterGravityStrength;
});
Clazz.defineMethod (c$, "setClusterGravityStrength", 
function (a) {
this.clusterGravityStrength = a;
}, "~N");
c$ = Clazz.p0p ();
};
c$.$LayoutOptionsPack$CiSE$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.nodeSeparation = 0;
this.desiredEdgeLength = 0;
this.interClusterEdgeLengthFactor = 0;
this.allowNodesInsideCircle = false;
this.maxRatioOfNodesInsideCircle = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.LayoutOptionsPack, "CiSE");
Clazz.defineMethod (c$, "getNodeSeparation", 
function () {
return this.nodeSeparation;
});
Clazz.defineMethod (c$, "setNodeSeparation", 
function (a) {
this.nodeSeparation = a;
}, "~N");
Clazz.defineMethod (c$, "getDesiredEdgeLength", 
function () {
return this.desiredEdgeLength;
});
Clazz.defineMethod (c$, "setDesiredEdgeLength", 
function (a) {
this.desiredEdgeLength = a;
}, "~N");
Clazz.defineMethod (c$, "getInterClusterEdgeLengthFactor", 
function () {
return this.interClusterEdgeLengthFactor;
});
Clazz.defineMethod (c$, "setInterClusterEdgeLengthFactor", 
function (a) {
this.interClusterEdgeLengthFactor = a;
}, "~N");
Clazz.defineMethod (c$, "isAllowNodesInsideCircle", 
function () {
return this.allowNodesInsideCircle;
});
Clazz.defineMethod (c$, "setAllowNodesInsideCircle", 
function (a) {
this.allowNodesInsideCircle = a;
}, "~B");
Clazz.defineMethod (c$, "getMaxRatioOfNodesInsideCircle", 
function () {
return this.maxRatioOfNodesInsideCircle;
});
Clazz.defineMethod (c$, "setMaxRatioOfNodesInsideCircle", 
function (a) {
this.maxRatioOfNodesInsideCircle = a;
}, "~N");
c$ = Clazz.p0p ();
};
c$.$LayoutOptionsPack$AVSDF$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.nodeSeparation = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.LayoutOptionsPack, "AVSDF");
Clazz.defineMethod (c$, "getNodeSeparation", 
function () {
return this.nodeSeparation;
});
Clazz.defineMethod (c$, "setNodeSeparation", 
function (a) {
this.nodeSeparation = a;
}, "~N");
c$ = Clazz.p0p ();
};
c$.$LayoutOptionsPack$Spring$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.nodeDistanceRestLength = 0;
this.disconnectedNodeDistanceSpringRestLength = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.LayoutOptionsPack, "Spring");
Clazz.defineMethod (c$, "getNodeDistanceRestLength", 
function () {
return this.nodeDistanceRestLength;
});
Clazz.defineMethod (c$, "setNodeDistanceRestLength", 
function (a) {
this.nodeDistanceRestLength = a;
}, "~N");
Clazz.defineMethod (c$, "getDisconnectedNodeDistanceSpringRestLength", 
function () {
return this.disconnectedNodeDistanceSpringRestLength;
});
Clazz.defineMethod (c$, "setDisconnectedNodeDistanceSpringRestLength", 
function (a) {
this.disconnectedNodeDistanceSpringRestLength = a;
}, "~N");
c$ = Clazz.p0p ();
};
c$.$LayoutOptionsPack$Sgym$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.horizontalSpacing = 0;
this.verticalSpacing = 0;
this.vertical = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.LayoutOptionsPack, "Sgym");
Clazz.defineMethod (c$, "getHorizontalSpacing", 
function () {
return this.horizontalSpacing;
});
Clazz.defineMethod (c$, "setHorizontalSpacing", 
function (a) {
this.horizontalSpacing = a;
}, "~N");
Clazz.defineMethod (c$, "getVerticalSpacing", 
function () {
return this.verticalSpacing;
});
Clazz.defineMethod (c$, "setVerticalSpacing", 
function (a) {
this.verticalSpacing = a;
}, "~N");
Clazz.defineMethod (c$, "isVertical", 
function () {
return this.vertical;
});
Clazz.defineMethod (c$, "setVertical", 
function (a) {
this.vertical = a;
}, "~B");
c$ = Clazz.p0p ();
};
Clazz.defineStatics (c$,
"instance", null);
