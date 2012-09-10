Clazz.declarePackage ("org.ivis.util.alignment");
c$ = Clazz.decorateAsClass (function () {
this.gapped_seq1 = null;
this.score_tag_line = null;
this.gapped_seq2 = null;
this.score = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.util.alignment, "PairwiseAlignment", null, java.io.Serializable);
Clazz.makeConstructor (c$, 
function (gapped_seq1, score_tag_line, gapped_seq2, score) {
this.gapped_seq1 = gapped_seq1;
this.score_tag_line = score_tag_line;
this.gapped_seq2 = gapped_seq2;
this.score = score;
}, "~S,~S,~S,~N");
Clazz.defineMethod (c$, "getGappedSequence1", 
function () {
return this.gapped_seq1;
});
Clazz.defineMethod (c$, "getScoreTagLine", 
function () {
return this.score_tag_line;
});
Clazz.defineMethod (c$, "getGappedSequence2", 
function () {
return this.gapped_seq2;
});
Clazz.defineMethod (c$, "getScore", 
function () {
return this.score;
});
Clazz.overrideMethod (c$, "toString", 
function () {
return this.gapped_seq1 + "\n" + this.score_tag_line + "\n" + this.gapped_seq2 + "\nScore: " + this.score;
});
Clazz.overrideMethod (c$, "equals", 
function (obj) {
if (!(Clazz.instanceOf (obj, org.ivis.util.alignment.PairwiseAlignment))) return false;
var another_pa = obj;
if (this.score != another_pa.score) return false;
if (!this.gapped_seq1.equals (another_pa.gapped_seq1)) return false;
if (!this.score_tag_line.equals (another_pa.score_tag_line)) return false;
if (!this.gapped_seq2.equals (another_pa.gapped_seq2)) return false;
return true;
}, "~O");
