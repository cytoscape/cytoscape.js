Clazz.declarePackage ("org.ivis.util.alignment");
Clazz.load (["org.ivis.util.alignment.ScoringScheme"], "org.ivis.util.alignment.BasicScoringScheme", ["java.lang.Character"], function () {
c$ = Clazz.decorateAsClass (function () {
this.match_reward = 0;
this.mismatch_penalty = 0;
this.gap_cost = 0;
this.max_absolute_score = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.util.alignment, "BasicScoringScheme", org.ivis.util.alignment.ScoringScheme);
Clazz.makeConstructor (c$, 
function (match_reward, mismatch_penalty, gap_cost) {
this.construct (match_reward, mismatch_penalty, gap_cost, true);
}, "~N,~N,~N");
Clazz.makeConstructor (c$, 
function (match_reward, mismatch_penalty, gap_cost, case_sensitive) {
Clazz.superConstructor (this, org.ivis.util.alignment.BasicScoringScheme, [case_sensitive]);
this.match_reward = match_reward;
this.mismatch_penalty = mismatch_penalty;
this.gap_cost = gap_cost;
if (Math.abs (match_reward) >= Math.abs (mismatch_penalty)) if (Math.abs (match_reward) >= Math.abs (gap_cost)) this.max_absolute_score = Math.abs (match_reward);
 else this.max_absolute_score = Math.abs (gap_cost);
 else if (Math.abs (mismatch_penalty) >= Math.abs (gap_cost)) this.max_absolute_score = Math.abs (mismatch_penalty);
 else this.max_absolute_score = Math.abs (gap_cost);
}, "~N,~N,~N,~B");
Clazz.overrideMethod (c$, "scoreSubstitution", 
function (a, b) {
if (this.isCaseSensitive ()) if ((a).charCodeAt (0) == (b).charCodeAt (0)) return this.match_reward;
 else return this.mismatch_penalty;
 else if ((Character.toLowerCase (a)).charCodeAt (0) == (Character.toLowerCase (b)).charCodeAt (0)) return this.match_reward;
 else return this.mismatch_penalty;
}, "~N,~N");
Clazz.overrideMethod (c$, "scoreInsertion", 
function (a) {
return this.gap_cost;
}, "~N");
Clazz.overrideMethod (c$, "scoreDeletion", 
function (a) {
return this.gap_cost;
}, "~N");
Clazz.overrideMethod (c$, "maxAbsoluteScore", 
function () {
return this.max_absolute_score;
});
Clazz.overrideMethod (c$, "isPartialMatchSupported", 
function () {
return false;
});
Clazz.overrideMethod (c$, "toString", 
function () {
return "Basic scoring scheme: match reward = " + this.match_reward + ", mismatch penalty = " + this.mismatch_penalty + ", gap cost = " + this.gap_cost;
});
});
