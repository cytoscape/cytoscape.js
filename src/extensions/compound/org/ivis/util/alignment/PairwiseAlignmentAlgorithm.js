Clazz.declarePackage ("org.ivis.util.alignment");
Clazz.load (null, "org.ivis.util.alignment.PairwiseAlignmentAlgorithm", ["java.lang.IllegalArgumentException", "$.IllegalStateException"], function () {
c$ = Clazz.decorateAsClass (function () {
this.use_match_tag = false;
this.scoring = null;
this.alignment = null;
this.score = 0;
this.score_computed = false;
this.sequences_loaded = false;
Clazz.instantialize (this, arguments);
}, org.ivis.util.alignment, "PairwiseAlignmentAlgorithm");
Clazz.defineMethod (c$, "setScoringScheme", 
function (scoring) {
if (scoring == null) throw  new IllegalArgumentException ("Null scoring scheme object.");
this.scoring = scoring;
if (scoring.isPartialMatchSupported ()) this.use_match_tag = false;
 else this.use_match_tag = true;
this.alignment = null;
this.score_computed = false;
}, "org.ivis.util.alignment.ScoringScheme");
Clazz.defineMethod (c$, "useMatchTag", 
function () {
return this.use_match_tag;
});
Clazz.defineMethod (c$, "loadSequences", 
function (input1, input2) {
this.alignment = null;
this.score_computed = false;
this.sequences_loaded = false;
this.loadSequencesInternal (input1, input2);
this.sequences_loaded = true;
}, "java.io.Reader,java.io.Reader");
Clazz.defineMethod (c$, "unloadSequences", 
function () {
this.alignment = null;
this.score_computed = false;
this.unloadSequencesInternal ();
this.sequences_loaded = false;
});
Clazz.defineMethod (c$, "getPairwiseAlignment", 
function () {
if (!this.sequences_loaded) throw  new IllegalStateException ("Sequences have not been loaded.");
if (this.scoring == null) throw  new IllegalStateException ("Scoring scheme has not been set.");
if (this.alignment == null) {
{
this.alignment = this.computePairwiseAlignment ();
}this.score = this.alignment.getScore ();
this.score_computed = true;
}return this.alignment;
});
Clazz.defineMethod (c$, "getScore", 
function () {
if (!this.sequences_loaded) throw  new IllegalStateException ("Sequences have not been loaded.");
if (this.scoring == null) throw  new IllegalStateException ("Scoring scheme has not been set.");
if (!this.score_computed) {
{
this.score = this.computeScore ();
}this.score_computed = true;
}return this.score;
});
Clazz.defineMethod (c$, "scoreSubstitution", 
function (a, b) {
return this.scoring.scoreSubstitution (a, b);
}, "~N,~N");
Clazz.defineMethod (c$, "scoreInsertion", 
function (a) {
return this.scoring.scoreInsertion (a);
}, "~N");
Clazz.defineMethod (c$, "scoreDeletion", 
function (a) {
return this.scoring.scoreDeletion (a);
}, "~N");
Clazz.defineMethod (c$, "max", 
function (v1, v2) {
return (v1 >= v2) ? v1 : v2;
}, "~N,~N");
Clazz.defineMethod (c$, "max", 
function (v1, v2, v3) {
return (v1 >= v2) ? ((v1 >= v3) ? v1 : v3) : ((v2 >= v3) ? v2 : v3);
}, "~N,~N,~N");
Clazz.defineMethod (c$, "max", 
function (v1, v2, v3, v4) {
var m1 = ((v1 >= v2) ? v1 : v2);
var m2 = ((v3 >= v4) ? v3 : v4);
return (m1 >= m2) ? m1 : m2;
}, "~N,~N,~N,~N");
Clazz.defineStatics (c$,
"MATCH_TAG", '|',
"APPROXIMATE_MATCH_TAG", '+',
"MISMATCH_TAG", ' ',
"GAP_TAG", ' ',
"GAP_CHARACTER", '-');
});
