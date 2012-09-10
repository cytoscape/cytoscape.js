Clazz.declarePackage ("newawt");
Clazz.load (["java.awt.AWTEventMulticaster", "java.awt.event.AWTEventListener", "java.beans.PropertyChangeSupport", "java.util.HashMap", "$.WeakHashMap", "sun.awt.DebugHelper"], "newawt.Toolkit", ["java.awt.AWTError", "$.Cursor", "$.GraphicsEnvironment", "$.Insets", "java.awt.event.AWTEventListenerProxy", "java.io.File", "$.FileInputStream", "java.lang.ClassLoader", "$.Compiler", "$.IllegalArgumentException", "$.UnsupportedOperationException", "java.security.AccessController", "$.PrivilegedAction", "java.util.ArrayList", "$.Properties", "$.ResourceBundle", "$.StringTokenizer", "newawt.Dimension", "sun.awt.HeadlessToolkit", "$.NullComponentPeer", "sun.security.action.LoadLibraryAction", "sun.security.util.SecurityConstants"], function () {
c$ = Clazz.decorateAsClass (function () {
this.desktopProperties = null;
this.desktopPropsSupport = null;
this.calls = null;
this.eventListener = null;
this.listener2SelectiveListener = null;
if (!Clazz.isClassDefined ("newawt.Toolkit.SelectiveAWTEventListener")) {
newawt.Toolkit.$Toolkit$SelectiveAWTEventListener$ ();
}
Clazz.instantialize (this, arguments);
}, newawt, "Toolkit");
Clazz.prepareFields (c$, function () {
this.desktopProperties =  new java.util.HashMap ();
this.desktopPropsSupport =  new java.beans.PropertyChangeSupport (this);
this.calls =  Clazz.newArray (64, 0);
this.listener2SelectiveListener =  new java.util.WeakHashMap ();
});
Clazz.defineMethod (c$, "getMouseInfoPeer", 
function () {
throw  new UnsupportedOperationException ("Not implemented");
});
Clazz.defineMethod (c$, "createComponent", 
function (target) {
if (newawt.Toolkit.lightweightMarker == null) {
($t$ = newawt.Toolkit.lightweightMarker =  new sun.awt.NullComponentPeer (), newawt.Toolkit.prototype.lightweightMarker = newawt.Toolkit.lightweightMarker, $t$);
}return newawt.Toolkit.lightweightMarker;
}, "java.awt.Component");
Clazz.defineMethod (c$, "loadSystemColors", 
function (systemColors) {
}, "~A");
Clazz.defineMethod (c$, "setDynamicLayout", 
function (dynamic) {
}, "~B");
Clazz.defineMethod (c$, "isDynamicLayoutSet", 
function () {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().isDynamicLayoutSet ();
} else {
return false;
}});
Clazz.defineMethod (c$, "isDynamicLayoutActive", 
function () {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().isDynamicLayoutActive ();
} else {
return false;
}});
Clazz.defineMethod (c$, "getScreenInsets", 
function (gc) {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().getScreenInsets (gc);
} else {
return  new java.awt.Insets (0, 0, 0, 0);
}}, "java.awt.GraphicsConfiguration");
c$.initAssistiveTechnologies = Clazz.defineMethod (c$, "initAssistiveTechnologies", 
($fz = function () {
var sep = java.io.File.separator;
var properties =  new java.util.Properties ();
($t$ = newawt.Toolkit.atNames = java.security.AccessController.doPrivileged (((Clazz.isClassDefined ("newawt.Toolkit$2") ? 0 : newawt.Toolkit.$Toolkit$2$ ()), Clazz.innerTypeInstance (newawt.Toolkit$2, this, Clazz.cloneFinals ("sep", sep, "properties", properties)))), newawt.Toolkit.prototype.atNames = newawt.Toolkit.atNames, $t$);
}, $fz.isPrivate = true, $fz));
c$.loadAssistiveTechnologies = Clazz.defineMethod (c$, "loadAssistiveTechnologies", 
($fz = function () {
if (newawt.Toolkit.atNames != null) {
var cl = ClassLoader.getSystemClassLoader ();
var parser =  new java.util.StringTokenizer (newawt.Toolkit.atNames, " ,");
var atName;
while (parser.hasMoreTokens ()) {
atName = parser.nextToken ();
try {
var clazz;
if (cl != null) {
clazz = cl.loadClass (atName);
} else {
clazz = Class.forName (atName);
}clazz.newInstance ();
} catch (e$$) {
if (Clazz.instanceOf (e$$, ClassNotFoundException)) {
var e = e$$;
{
throw  new java.awt.AWTError ("Assistive Technology not found: " + atName);
}
} else if (Clazz.instanceOf (e$$, InstantiationException)) {
var e = e$$;
{
throw  new java.awt.AWTError ("Could not instantiate Assistive" + " Technology: " + atName);
}
} else if (Clazz.instanceOf (e$$, IllegalAccessException)) {
var e = e$$;
{
throw  new java.awt.AWTError ("Could not access Assistive" + " Technology: " + atName);
}
} else if (Clazz.instanceOf (e$$, Exception)) {
var e = e$$;
{
throw  new java.awt.AWTError ("Error trying to install Assistive Technology: " + atName + " " + e);
}
} else {
throw e$$;
}
}
}
}}, $fz.isPrivate = true, $fz));
c$.getDefaultToolkit = Clazz.defineMethod (c$, "getDefaultToolkit", 
function () {
if (newawt.Toolkit.toolkit == null) {
try {
java.lang.Compiler.disable ();
java.security.AccessController.doPrivileged (((Clazz.isClassDefined ("newawt.Toolkit$32477") ? 0 : newawt.Toolkit.$Toolkit$32477$ ()), Clazz.innerTypeInstance (newawt.Toolkit$32477, this, null)));
newawt.Toolkit.loadAssistiveTechnologies ();
} finally {
java.lang.Compiler.enable ();
}
}return newawt.Toolkit.toolkit;
});
Clazz.defineMethod (c$, "createImage", 
function (imagedata) {
return this.createImage (imagedata, 0, imagedata.length);
}, "~A");
Clazz.defineMethod (c$, "getPrintJob", 
function (frame, jobtitle, jobAttributes, pageAttributes) {
if (java.awt.GraphicsEnvironment.isHeadless ()) {
throw  new IllegalArgumentException ();
}if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().getPrintJob (frame, jobtitle, jobAttributes, pageAttributes);
} else {
return this.getPrintJob (frame, jobtitle, null);
}}, "java.awt.Frame,~S,java.awt.JobAttributes,java.awt.PageAttributes");
Clazz.defineMethod (c$, "getSystemSelection", 
function () {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().getSystemSelection ();
} else {
java.awt.GraphicsEnvironment.checkHeadless ();
return null;
}});
Clazz.defineMethod (c$, "getMenuShortcutKeyMask", 
function () {
return 2;
});
Clazz.defineMethod (c$, "getLockingKeyState", 
function (keyCode) {
if (!(keyCode == 20 || keyCode == 144 || keyCode == 145 || keyCode == 262)) {
throw  new IllegalArgumentException ("invalid key for Toolkit.getLockingKeyState");
}throw  new UnsupportedOperationException ("Toolkit.getLockingKeyState");
}, "~N");
Clazz.defineMethod (c$, "setLockingKeyState", 
function (keyCode, on) {
if (!(keyCode == 20 || keyCode == 144 || keyCode == 145 || keyCode == 262)) {
throw  new IllegalArgumentException ("invalid key for Toolkit.setLockingKeyState");
}throw  new UnsupportedOperationException ("Toolkit.setLockingKeyState");
}, "~N,~B");
c$.getNativeContainer = Clazz.defineMethod (c$, "getNativeContainer", 
function (c) {
return c.getNativeContainer ();
}, "java.awt.Component");
Clazz.defineMethod (c$, "createCustomCursor", 
function (cursor, hotSpot, name) {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().createCustomCursor (cursor, hotSpot, name);
} else {
return  new java.awt.Cursor (0);
}}, "java.awt.Image,newawt.Point,~S");
Clazz.defineMethod (c$, "getBestCursorSize", 
function (preferredWidth, preferredHeight) {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().getBestCursorSize (preferredWidth, preferredHeight);
} else {
return  new newawt.Dimension (0, 0);
}}, "~N,~N");
Clazz.defineMethod (c$, "getMaximumCursorColors", 
function () {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().getMaximumCursorColors ();
} else {
return 0;
}});
Clazz.defineMethod (c$, "isFrameStateSupported", 
function (state) {
if (this !== newawt.Toolkit.getDefaultToolkit ()) {
return newawt.Toolkit.getDefaultToolkit ().isFrameStateSupported (state);
} else {
return (state == 0);
}}, "~N");
c$.loadLibraries = Clazz.defineMethod (c$, "loadLibraries", 
function () {
if (!newawt.Toolkit.loaded) {
java.security.AccessController.doPrivileged ( new sun.security.action.LoadLibraryAction ("awt"));
($t$ = newawt.Toolkit.loaded = true, newawt.Toolkit.prototype.loaded = newawt.Toolkit.loaded, $t$);
}});
c$.getProperty = Clazz.defineMethod (c$, "getProperty", 
function (key, defaultValue) {
if (newawt.Toolkit.resources != null) {
try {
return newawt.Toolkit.resources.getString (key);
} catch (e) {
if (Clazz.instanceOf (e, java.util.MissingResourceException)) {
} else {
throw e;
}
}
}return defaultValue;
}, "~S,~S");
Clazz.defineMethod (c$, "getSystemEventQueue", 
function () {
var security = System.getSecurityManager ();
if (security != null) {
security.checkAwtEventQueueAccess ();
}return this.getSystemEventQueueImpl ();
});
c$.getEventQueue = Clazz.defineMethod (c$, "getEventQueue", 
function () {
return newawt.Toolkit.getDefaultToolkit ().getSystemEventQueueImpl ();
});
Clazz.defineMethod (c$, "createDragGestureRecognizer", 
function (abstractRecognizerClass, ds, c, srcActions, dgl) {
return null;
}, "Class,java.awt.dnd.DragSource,java.awt.Component,~N,java.awt.dnd.DragGestureListener");
Clazz.defineMethod (c$, "getDesktopProperty", 
function (propertyName) {
if (Clazz.instanceOf (this, sun.awt.HeadlessToolkit)) {
return (this).getUnderlyingToolkit ().getDesktopProperty (propertyName);
}if (this.desktopProperties.isEmpty ()) {
this.initializeDesktopProperties ();
}var value;
if (propertyName.equals ("awt.dynamicLayoutSupported")) {
value = this.lazilyLoadDesktopProperty (propertyName);
return value;
}value = this.desktopProperties.get (propertyName);
if (value == null) {
value = this.lazilyLoadDesktopProperty (propertyName);
if (value != null) {
this.setDesktopProperty (propertyName, value);
}}return value;
}, "~S");
Clazz.defineMethod (c$, "setDesktopProperty", 
function (name, newValue) {
if (Clazz.instanceOf (this, sun.awt.HeadlessToolkit)) {
(this).getUnderlyingToolkit ().setDesktopProperty (name, newValue);
return ;
}var oldValue;
{
oldValue = this.desktopProperties.get (name);
this.desktopProperties.put (name, newValue);
}this.desktopPropsSupport.firePropertyChange (name, oldValue, newValue);
}, "~S,~O");
Clazz.defineMethod (c$, "lazilyLoadDesktopProperty", 
function (name) {
return null;
}, "~S");
Clazz.defineMethod (c$, "initializeDesktopProperties", 
function () {
});
Clazz.defineMethod (c$, "addPropertyChangeListener", 
function (name, pcl) {
if (pcl == null) {
return ;
}this.desktopPropsSupport.addPropertyChangeListener (name, pcl);
}, "~S,java.beans.PropertyChangeListener");
Clazz.defineMethod (c$, "removePropertyChangeListener", 
function (name, pcl) {
if (pcl == null) {
return ;
}this.desktopPropsSupport.removePropertyChangeListener (name, pcl);
}, "~S,java.beans.PropertyChangeListener");
Clazz.defineMethod (c$, "getPropertyChangeListeners", 
function () {
return this.desktopPropsSupport.getPropertyChangeListeners ();
});
Clazz.defineMethod (c$, "getPropertyChangeListeners", 
function (propertyName) {
return this.desktopPropsSupport.getPropertyChangeListeners (propertyName);
}, "~S");
c$.deProxyAWTEventListener = Clazz.defineMethod (c$, "deProxyAWTEventListener", 
($fz = function (l) {
var localL = l;
if (localL == null) {
return null;
}if (Clazz.instanceOf (l, java.awt.event.AWTEventListenerProxy)) {
localL = (l).getListener ();
}return localL;
}, $fz.isPrivate = true, $fz), "java.awt.event.AWTEventListener");
Clazz.defineMethod (c$, "addAWTEventListener", 
function (listener, eventMask) {
var localL = newawt.Toolkit.deProxyAWTEventListener (listener);
if (localL == null) {
return ;
}var security = System.getSecurityManager ();
if (security != null) {
security.checkPermission (sun.security.util.SecurityConstants.ALL_AWT_EVENTS_PERMISSION);
}{
var selectiveListener = this.listener2SelectiveListener.get (localL);
if (selectiveListener == null) {
selectiveListener = Clazz.innerTypeInstance (newawt.Toolkit.SelectiveAWTEventListener, this, null, localL, eventMask);
this.listener2SelectiveListener.put (localL, selectiveListener);
this.eventListener = newawt.Toolkit.ToolkitEventMulticaster.add (this.eventListener, selectiveListener);
}selectiveListener.orEventMasks (eventMask);
($t$ = newawt.Toolkit.enabledOnToolkitMask |= eventMask, newawt.Toolkit.prototype.enabledOnToolkitMask = newawt.Toolkit.enabledOnToolkitMask, $t$);
var mask = eventMask;
for (var i = 0; i < 64; i++) {
if (mask == 0) {
break;
}if ((mask & 1) != 0) {
this.calls[i]++;
}mask >>>= 1;
}
}}, "java.awt.event.AWTEventListener,~N");
Clazz.defineMethod (c$, "removeAWTEventListener", 
function (listener) {
var localL = newawt.Toolkit.deProxyAWTEventListener (listener);
if (listener == null) {
return ;
}var security = System.getSecurityManager ();
if (security != null) {
security.checkPermission (sun.security.util.SecurityConstants.ALL_AWT_EVENTS_PERMISSION);
}{
var selectiveListener = this.listener2SelectiveListener.get (localL);
if (selectiveListener != null) {
this.listener2SelectiveListener.remove (localL);
var listenerCalls = selectiveListener.getCalls ();
for (var i = 0; i < 64; i++) {
this.calls[i] -= listenerCalls[i];
if (this.calls[i] == 0) {
($t$ = newawt.Toolkit.enabledOnToolkitMask &= ~(1 << i), newawt.Toolkit.prototype.enabledOnToolkitMask = newawt.Toolkit.enabledOnToolkitMask, $t$);
}}
}this.eventListener = newawt.Toolkit.ToolkitEventMulticaster.remove (this.eventListener, (selectiveListener == null) ? localL : selectiveListener);
}}, "java.awt.event.AWTEventListener");
c$.enabledOnToolkit = Clazz.defineMethod (c$, "enabledOnToolkit", 
function (eventMask) {
return (newawt.Toolkit.enabledOnToolkitMask & eventMask) != 0;
}, "~N");
Clazz.defineMethod (c$, "countAWTEventListeners", 
function (eventMask) {
if (newawt.Toolkit.dbg.on) {
newawt.Toolkit.dbg.assertion (eventMask != 0);
}var ci = 0;
for (; eventMask != 0; eventMask >>>= 1, ci++) {
}
ci--;
return this.calls[ci];
}, "~N");
Clazz.defineMethod (c$, "getAWTEventListeners", 
function () {
var security = System.getSecurityManager ();
if (security != null) {
security.checkPermission (sun.security.util.SecurityConstants.ALL_AWT_EVENTS_PERMISSION);
}{
var la = newawt.Toolkit.ToolkitEventMulticaster.getListeners (this.eventListener, java.awt.event.AWTEventListener);
var ret =  new Array (la.length);
for (var i = 0; i < la.length; i++) {
var sael = la[i];
var tempL = sael.getListener ();
ret[i] =  new java.awt.event.AWTEventListenerProxy (sael.getEventMask (), tempL);
}
return ret;
}});
Clazz.defineMethod (c$, "getAWTEventListeners", 
function (eventMask) {
var security = System.getSecurityManager ();
if (security != null) {
security.checkPermission (sun.security.util.SecurityConstants.ALL_AWT_EVENTS_PERMISSION);
}{
var la = newawt.Toolkit.ToolkitEventMulticaster.getListeners (this.eventListener, java.awt.event.AWTEventListener);
var list =  new java.util.ArrayList (la.length);
for (var i = 0; i < la.length; i++) {
var sael = la[i];
if ((sael.getEventMask () & eventMask) == eventMask) {
list.add ( new java.awt.event.AWTEventListenerProxy (sael.getEventMask (), sael.getListener ()));
}}
return list.toArray ( new Array (0));
}}, "~N");
Clazz.defineMethod (c$, "notifyAWTEventListeners", 
function (theEvent) {
if (Clazz.instanceOf (this, sun.awt.HeadlessToolkit)) {
(this).getUnderlyingToolkit ().notifyAWTEventListeners (theEvent);
return ;
}var eventListener = this.eventListener;
if (eventListener != null) {
eventListener.eventDispatched (theEvent);
}}, "java.awt.AWTEvent");
c$.$Toolkit$SelectiveAWTEventListener$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
this.listener = null;
this.eventMask = 0;
this.calls = null;
Clazz.instantialize (this, arguments);
}, newawt.Toolkit, "SelectiveAWTEventListener", null, java.awt.event.AWTEventListener);
Clazz.prepareFields (c$, function () {
this.calls =  Clazz.newArray (64, 0);
});
Clazz.defineMethod (c$, "getListener", 
function () {
return this.listener;
});
Clazz.defineMethod (c$, "getEventMask", 
function () {
return this.eventMask;
});
Clazz.defineMethod (c$, "getCalls", 
function () {
return this.calls;
});
Clazz.defineMethod (c$, "orEventMasks", 
function (a) {
this.eventMask |= a;
for (var b = 0; b < 64; b++) {
if (a == 0) {
break;
}if ((a & 1) != 0) {
this.calls[b]++;
}a >>>= 1;
}
}, "~N");
Clazz.makeConstructor (c$, 
function (a, b) {
this.listener = a;
this.eventMask = b;
}, "java.awt.event.AWTEventListener,~N");
Clazz.defineMethod (c$, "eventDispatched", 
function (a) {
var b = 0;
if (((b = this.eventMask & 1) != 0 && a.id >= 100 && a.id <= 103) || ((b = this.eventMask & 2) != 0 && a.id >= 300 && a.id <= 301) || ((b = this.eventMask & 4) != 0 && a.id >= 1004 && a.id <= 1005) || ((b = this.eventMask & 8) != 0 && a.id >= 400 && a.id <= 402) || ((b = this.eventMask & 131072) != 0 && a.id == 507) || ((b = this.eventMask & 32) != 0 && (a.id == 503 || a.id == 506)) || ((b = this.eventMask & 16) != 0 && a.id != 503 && a.id != 506 && a.id != 507 && a.id >= 500 && a.id <= 507) || ((b = this.eventMask & 64) != 0 && a.id >= 200 && a.id <= 209) || ((b = this.eventMask & 128) != 0 && a.id >= 1001 && a.id <= 1001) || ((b = this.eventMask & 256) != 0 && a.id >= 601 && a.id <= 601) || ((b = this.eventMask & 512) != 0 && a.id >= 701 && a.id <= 701) || ((b = this.eventMask & 1024) != 0 && a.id >= 900 && a.id <= 900) || ((b = this.eventMask & 2048) != 0 && a.id >= 1100 && a.id <= 1101) || ((b = this.eventMask & 8192) != 0 && a.id >= 800 && a.id <= 801) || ((b = this.eventMask & 16384) != 0 && a.id >= 1200 && a.id <= 1200) || ((b = this.eventMask & 32768) != 0 && a.id == 1400) || ((b = this.eventMask & 65536) != 0 && (a.id == 1401 || a.id == 1402)) || ((b = this.eventMask & 262144) != 0 && a.id == 209) || ((b = this.eventMask & 524288) != 0 && (a.id == 207 || a.id == 208))) {
var c = 0;
for (var d = b; d != 0; d >>>= 1, c++) {
}
c--;
for (var e = 0; e < this.calls[c]; e++) {
this.listener.eventDispatched (a);
}
}}, "java.awt.AWTEvent");
c$ = Clazz.p0p ();
};
c$.$Toolkit$2$ = function () {
Clazz.pu$h ();
c$ = Clazz.declareAnonymous (newawt, "Toolkit$2", null, java.security.PrivilegedAction);
Clazz.overrideMethod (c$, "run", 
function () {
try {
var propsFile =  new java.io.File (System.getProperty ("user.home") + this.f$.sep + ".accessibility.properties");
var $in =  new java.io.FileInputStream (propsFile);
this.f$.properties.load ($in);
$in.close ();
} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
} else {
throw e;
}
}
if (this.f$.properties.size () == 0) {
try {
var propsFile =  new java.io.File (System.getProperty ("java.home") + this.f$.sep + "lib" + this.f$.sep + "accessibility.properties");
var $in =  new java.io.FileInputStream (propsFile);
this.f$.properties.load ($in);
$in.close ();
} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
} else {
throw e;
}
}
}var magPresent = System.getProperty ("javax.accessibility.screen_magnifier_present");
if (magPresent == null) {
magPresent = this.f$.properties.getProperty ("screen_magnifier_present", null);
if (magPresent != null) {
System.setProperty ("javax.accessibility.screen_magnifier_present", magPresent);
}}var classNames = System.getProperty ("javax.accessibility.assistive_technologies");
if (classNames == null) {
classNames = this.f$.properties.getProperty ("assistive_technologies", null);
if (classNames != null) {
System.setProperty ("javax.accessibility.assistive_technologies", classNames);
}}return classNames;
});
c$ = Clazz.p0p ();
};
c$.$Toolkit$32477$ = function () {
Clazz.pu$h ();
c$ = Clazz.declareAnonymous (newawt, "Toolkit$32477", null, java.security.PrivilegedAction);
Clazz.overrideMethod (c$, "run", 
function () {
var nm = null;
var cls = null;
try {
var defaultToolkit;
if (System.getProperty ("os.name").equals ("Linux")) {
defaultToolkit = "sun.awt.X11.XToolkit";
} else {
defaultToolkit = "sun.awt.motif.MToolkit";
}nm = System.getProperty ("awt.toolkit", defaultToolkit);
try {
cls = Class.forName (nm);
} catch (e) {
if (Clazz.instanceOf (e, ClassNotFoundException)) {
var cl = ClassLoader.getSystemClassLoader ();
if (cl != null) {
try {
cls = cl.loadClass (nm);
} catch (ee) {
if (Clazz.instanceOf (ee, ClassNotFoundException)) {
throw  new java.awt.AWTError ("Toolkit not found: " + nm);
} else {
throw ee;
}
}
}} else {
throw e;
}
}
if (cls != null) {
($t$ = newawt.Toolkit.toolkit = cls.newInstance (), newawt.Toolkit.prototype.toolkit = newawt.Toolkit.toolkit, $t$);
if (java.awt.GraphicsEnvironment.isHeadless ()) {
($t$ = newawt.Toolkit.toolkit =  new sun.awt.HeadlessToolkit (newawt.Toolkit.toolkit), newawt.Toolkit.prototype.toolkit = newawt.Toolkit.toolkit, $t$);
}}} catch (e$$) {
if (Clazz.instanceOf (e$$, InstantiationException)) {
var e = e$$;
{
throw  new java.awt.AWTError ("Could not instantiate Toolkit: " + nm);
}
} else if (Clazz.instanceOf (e$$, IllegalAccessException)) {
var e = e$$;
{
throw  new java.awt.AWTError ("Could not access Toolkit: " + nm);
}
} else {
throw e$$;
}
}
return null;
});
c$ = Clazz.p0p ();
};
c$.$Toolkit$1$ = function () {
Clazz.pu$h ();
c$ = Clazz.declareAnonymous (newawt, "Toolkit$1", null, java.security.PrivilegedAction);
Clazz.overrideMethod (c$, "run", 
function () {
try {
($t$ = newawt.Toolkit.resources = java.util.ResourceBundle.getBundle ("sun.awt.resources.awt"), newawt.Toolkit.prototype.resources = newawt.Toolkit.resources, $t$);
} catch (e) {
if (Clazz.instanceOf (e, java.util.MissingResourceException)) {
} else {
throw e;
}
}
return null;
});
c$ = Clazz.p0p ();
};
Clazz.pu$h ();
c$ = Clazz.declareType (newawt.Toolkit, "ToolkitEventMulticaster", java.awt.AWTEventMulticaster, java.awt.event.AWTEventListener);
c$.add = Clazz.defineMethod (c$, "add", 
function (a, b) {
if (a == null) return b;
if (b == null) return a;
return  new newawt.Toolkit.ToolkitEventMulticaster (a, b);
}, "java.awt.event.AWTEventListener,java.awt.event.AWTEventListener");
c$.remove = Clazz.defineMethod (c$, "remove", 
function (a, b) {
return java.awt.AWTEventMulticaster.removeInternal (a, b);
}, "java.awt.event.AWTEventListener,java.awt.event.AWTEventListener");
Clazz.defineMethod (c$, "remove", 
function (a) {
if (a === this.a) return this.b;
if (a === this.b) return this.a;
var b = java.awt.AWTEventMulticaster.removeInternal (this.a, a);
var c = java.awt.AWTEventMulticaster.removeInternal (this.b, a);
if (b === this.a && c === this.b) {
return this;
}return newawt.Toolkit.ToolkitEventMulticaster.add (b, c);
}, "java.util.EventListener");
Clazz.defineMethod (c$, "eventDispatched", 
function (a) {
(this.a).eventDispatched (a);
(this.b).eventDispatched (a);
}, "java.awt.AWTEvent");
c$ = Clazz.p0p ();
Clazz.defineStatics (c$,
"lightweightMarker", null,
"toolkit", null,
"atNames", null,
"resources", null,
"loaded", false);
{
java.security.AccessController.doPrivileged (((Clazz.isClassDefined ("newawt.Toolkit$1") ? 0 : newawt.Toolkit.$Toolkit$1$ ()), Clazz.innerTypeInstance (newawt.Toolkit$1, this, null)));
newawt.Toolkit.loadLibraries ();
newawt.Toolkit.initAssistiveTechnologies ();
if (!java.awt.GraphicsEnvironment.isHeadless ()) {
newawt.Toolkit.initIDs ();
}}c$.dbg = c$.prototype.dbg = sun.awt.DebugHelper.create (newawt.Toolkit);
Clazz.defineStatics (c$,
"LONG_BITS", 64,
"enabledOnToolkitMask", 0);
});
