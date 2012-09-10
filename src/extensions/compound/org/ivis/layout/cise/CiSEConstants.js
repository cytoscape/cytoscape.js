Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.layout.fd.FDLayoutConstants"], "org.ivis.layout.cise.CiSEConstants", null, function () {
c$ = Clazz.declareType (org.ivis.layout.cise, "CiSEConstants", org.ivis.layout.fd.FDLayoutConstants);
Clazz.defineStatics (c$,
"$DEFAULT_SPRING_STRENGTH", 0.675,
"DEFAULT_NODE_SEPARATION", 12,
"DEFAULT_IDEAL_INTER_CLUSTER_EDGE_LENGTH_COEFF", 1.4,
"DEFAULT_ALLOW_NODES_INSIDE_CIRCLE", false,
"DEFAULT_MAX_RATIO_OF_NODES_INSIDE_CIRCLE", 0.2,
"DEFAULT_INNER_EDGE_LENGTH", 16,
"MAX_ROTATION_ANGLE", 0.08726646259971647,
"MIN_ROTATION_ANGLE", -0.08726646259971647,
"SWAP_IDLE_DURATION", 45,
"SWAP_PREPERATION_DURATION", 5,
"SWAP_PERIOD", 50,
"SWAP_HISTORY_CLEARANCE_PERIOD", 300,
"MIN_DISPLACEMENT_FOR_SWAP", 6,
"REVERSE_PERIOD", 25);
});
