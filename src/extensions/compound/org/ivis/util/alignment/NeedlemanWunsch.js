Clazz.declarePackage ("org.ivis.util.alignment");
Clazz.load (["org.ivis.util.alignment.PairwiseAlignmentAlgorithm"], "org.ivis.util.alignment.NeedlemanWunsch", ["java.lang.StringBuffer", "org.ivis.util.alignment.CharSequence", "$.PairwiseAlignment"], function () {
c$ = Clazz.decorateAsClass (function () {
this.seq1 = null;
this.seq2 = null;
this.matrix = null;
Clazz.instantialize (this, arguments);
}, org.ivis.util.alignment, "NeedlemanWunsch", org.ivis.util.alignment.PairwiseAlignmentAlgorithm);
Clazz.overrideMethod (c$, "loadSequencesInternal", 
function (input1, input2) {
this.seq1 =  new org.ivis.util.alignment.CharSequence (input1);
this.seq2 =  new org.ivis.util.alignment.CharSequence (input2);
}, "java.io.Reader,java.io.Reader");
Clazz.overrideMethod (c$, "unloadSequencesInternal", 
function () {
this.seq1 = null;
this.seq2 = null;
this.matrix = null;
});
Clazz.overrideMethod (c$, "computePairwiseAlignment", 
function () {
this.computeMatrix ();
var alignment = this.buildOptimalAlignment ();
this.matrix = null;
return alignment;
});
Clazz.defineMethod (c$, "computeMatrix", 
function () {
var r;
var c;
var rows;
var cols;
var ins;
var del;
var sub;
rows = this.seq1.length () + 1;
cols = this.seq2.length () + 1;
this.matrix =  Clazz.newArray (rows, cols, 0);
this.matrix[0][0] = 0;
for (c = 1; c < cols; c++) this.matrix[0][c] = 0;

for (r = 1; r < rows; r++) {
this.matrix[r][0] = 0;
for (c = 1; c < cols; c++) {
ins = this.matrix[r][c - 1] + this.scoreInsertion (this.seq2.charAt (c));
sub = this.matrix[r - 1][c - 1] + this.scoreSubstitution (this.seq1.charAt (r), this.seq2.charAt (c));
del = this.matrix[r - 1][c] + this.scoreDeletion (this.seq1.charAt (r));
this.matrix[r][c] = this.max (ins, sub, del);
}
}
});
Clazz.defineMethod (c$, "buildOptimalAlignment", 
function () {
var gapped_seq1;
var score_tag_line;
var gapped_seq2;
var r;
var c;
var sub;
var max_score;
gapped_seq1 =  new StringBuffer ();
score_tag_line =  new StringBuffer ();
gapped_seq2 =  new StringBuffer ();
max_score = -2147483648;
r = -1;
c = -1;
for (var i = 1; i < this.matrix.length; i++) {
var j = this.matrix[i].length - 1;
if (this.matrix[i][j] > max_score && this.matrix[i][j] == this.matrix[i - 1][j - 1] + this.scoreSubstitution (this.seq1.charAt (i), this.seq2.charAt (j))) {
max_score = this.matrix[r = i][c = j];
}}
var i = this.matrix.length - 1;
for (var j = 1; j < this.matrix[i].length; j++) {
if (this.matrix[i][j] > max_score && this.matrix[i][j] == this.matrix[i - 1][j - 1] + this.scoreSubstitution (this.seq1.charAt (i), this.seq2.charAt (j))) {
max_score = this.matrix[r = i][c = j];
}}
while ((r > 0) || (c > 0)) {
if (r == 0 || c == 0) {
break;
}if ((r > 0) && (c > 0)) {
sub = this.scoreSubstitution (this.seq1.charAt (r), this.seq2.charAt (c));
if (this.matrix[r][c] == this.matrix[r - 1][c - 1] + sub) {
gapped_seq1.insert (0, this.seq1.charAt (r));
if ((this.seq1.charAt (r)).charCodeAt (0) == (this.seq2.charAt (c)).charCodeAt (0)) if (this.useMatchTag ()) score_tag_line.insert (0, '|');
 else score_tag_line.insert (0, this.seq1.charAt (r));
 else if (sub > 0) score_tag_line.insert (0, '+');
 else score_tag_line.insert (0, ' ');
gapped_seq2.insert (0, this.seq2.charAt (c));
r = r - 1;
c = c - 1;
continue ;}}if (c > 0) if (this.matrix[r][c] == this.matrix[r][c - 1] + this.scoreInsertion (this.seq2.charAt (c))) {
gapped_seq1.insert (0, '-');
score_tag_line.insert (0, ' ');
gapped_seq2.insert (0, this.seq2.charAt (c));
c = c - 1;
continue ;}gapped_seq1.insert (0, this.seq1.charAt (r));
score_tag_line.insert (0, ' ');
gapped_seq2.insert (0, '-');
r = r - 1;
}
return  new org.ivis.util.alignment.PairwiseAlignment (gapped_seq1.toString (), score_tag_line.toString (), gapped_seq2.toString (), max_score);
});
Clazz.overrideMethod (c$, "computeScore", 
function () {
var array;
var r;
var c;
var rows;
var cols;
var tmp;
var ins;
var del;
var sub;
rows = this.seq1.length () + 1;
cols = this.seq2.length () + 1;
if (rows <= cols) {
array =  Clazz.newArray (rows, 0);
array[0] = 0;
for (r = 1; r < rows; r++) array[r] = array[r - 1] + this.scoreDeletion (this.seq1.charAt (r));

for (c = 1; c < cols; c++) {
tmp = array[0] + this.scoreInsertion (this.seq2.charAt (c));
for (r = 1; r < rows; r++) {
ins = array[r] + this.scoreInsertion (this.seq2.charAt (c));
sub = array[r - 1] + this.scoreSubstitution (this.seq1.charAt (r), this.seq2.charAt (c));
del = tmp + this.scoreDeletion (this.seq1.charAt (r));
array[r - 1] = tmp;
tmp = this.max (ins, sub, del);
}
array[rows - 1] = tmp;
}
return array[rows - 1];
} else {
array =  Clazz.newArray (cols, 0);
array[0] = 0;
for (c = 1; c < cols; c++) array[c] = array[c - 1] + this.scoreInsertion (this.seq2.charAt (c));

for (r = 1; r < rows; r++) {
tmp = array[0] + this.scoreDeletion (this.seq1.charAt (r));
for (c = 1; c < cols; c++) {
ins = tmp + this.scoreInsertion (this.seq2.charAt (c));
sub = array[c - 1] + this.scoreSubstitution (this.seq1.charAt (r), this.seq2.charAt (c));
del = array[c] + this.scoreDeletion (this.seq1.charAt (r));
array[c - 1] = tmp;
tmp = this.max (ins, sub, del);
}
array[cols - 1] = tmp;
}
return array[cols - 1];
}});
});
