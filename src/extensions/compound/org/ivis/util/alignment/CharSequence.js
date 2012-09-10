Clazz.declarePackage ("org.ivis.util.alignment");
Clazz.load (null, "org.ivis.util.alignment.CharSequence", ["java.io.BufferedReader", "java.lang.Character", "$.StringBuffer", "org.ivis.util.alignment.InvalidSequenceException"], function () {
c$ = Clazz.decorateAsClass (function () {
this.sequence = null;
Clazz.instantialize (this, arguments);
}, org.ivis.util.alignment, "CharSequence");
Clazz.makeConstructor (c$, 
function (reader) {
var ch;
var c;
var input =  new java.io.BufferedReader (reader);
var buf =  new StringBuffer ();
while ((ch = input.read ()) != -1) {
c = String.fromCharCode (ch);
if ((c).charCodeAt (0) == ('>').charCodeAt (0)) input.readLine ();
 else if (Character.isLetter (c)) buf.append (c);
 else if (!Character.isWhitespace (c)) throw  new org.ivis.util.alignment.InvalidSequenceException ("Sequences can contain letters only.");
}
if (buf.length () > 0) this.sequence =  Clazz.newArray (buf.length (), '\0');
 else throw  new org.ivis.util.alignment.InvalidSequenceException ("Empty sequence.");
buf.getChars (0, buf.length (), this.sequence, 0);
}, "java.io.Reader");
Clazz.defineMethod (c$, "length", 
function () {
return this.sequence.length;
});
Clazz.defineMethod (c$, "charAt", 
function (pos) {
return this.sequence[pos - 1];
}, "~N");
Clazz.overrideMethod (c$, "toString", 
function () {
return  String.instantialize (this.sequence);
});
Clazz.defineStatics (c$,
"COMMENT_CHAR", '>');
});
