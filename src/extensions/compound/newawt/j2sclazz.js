/******************************************************************************
 * Copyright (c) 2005-2006 ognize.com and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Web:
 *     http://j2s.sourceforge.net/
 *     http://sourceforge.net/projects/j2s/
 * Contributors:
 *     ognize.com - initial API and implementation
 *****************************************************************************/
/*******
 * @author josson smith
 * @create Nov 5, 2005
 *******/
 
/**
 * Class Clazz. All the methods are static in this class.
 */
/* static */
function Clazz () {
};

function NullObject () {
};

/**
 * Return the class name of the given class or object.
 *
 * @param clazzHost given class or object
 * @return class name
 */
/* public */
Clazz.getClassName = function (clazzHost) {
	if (clazzHost == null) {
		/* 
		 * null is always treated as Object.
		 * But what about "undefined"?
		 */
		return "NullObject";
	}
	if (typeof clazzHost == "function") {
		var clazz = clazzHost;
		if (clazz.__CLASS_NAME__ != null) {
			/* user defined class name */
			return clazz.__CLASS_NAME__;
		}
		var clazzStr = clazz.toString ();
		var idx0 = clazzStr.indexOf ("function");
		if (idx0 == -1) {
			// For Firefox 1.5.0.1+, those HTML element are no longer
			// bound with function () { [native] } constructors
			if (clazzStr.charAt (0) == '[') {
				return clazzStr.substring (1, clazzStr.length - 1);
			} else {
				return clazzStr.replace(/[^a-zA-Z0-9]/g, '');
			}
		}
		var idx1 = idx0 + 8;
		var idx2 = clazzStr.indexOf ("(", idx1);
		var clazzName = clazzStr.substring (idx1, idx2)
				.replace (/^\s+/, "").replace (/\s+$/, ""); // .trim ()
		if (clazzName == "anonymous") {
			return "Function";
		} else {
			return clazzName;
		}
	} else {
		var obj = clazzHost;
		if (obj instanceof Clazz.CastedNull) {
			return obj.clazzName;
		} else {
			var objType = typeof obj;
			if (objType == "string") {
				/* 
				 * Always treat the constant string as String object.
				 * This will be compatiable with Java String instance.
				 */
				return "String";
			} else if (objType == "object") {
				if (obj.__CLASS_NAME__ != null) {
					/* user defined class name */
					return obj.__CLASS_NAME__;
				} else {
					return Clazz.getClassName (obj.constructor);
				}
			}
			return Clazz.getClassName (obj.constructor);
		}
	}
};
/**
 * Return the class of the given class or object.
 *
 * @param clazzHost given class or object
 * @return class name
 */
/* public */
Clazz.getClass = function (clazzHost) {
	if (clazzHost == null) {
		/* 
		 * null is always treated as Object.
		 * But what about "undefined"?
		 */
		return Object;
	}
	if (typeof clazzHost == "function") {
		return clazzHost;
	} else {
		var clazzName = null;
		var obj = clazzHost;
		if (obj instanceof Clazz.CastedNull) {
			clazzName = obj.clazzName;
		} else {
			var objType = typeof obj;
			if (objType == "string") {
				return String;
			} else if (typeof obj == "object") {
				/* user defined class name */
				if (obj.__CLASS_NAME__ != null) {
					clazzName = obj.__CLASS_NAME__;
				} else {
					return obj.constructor;
				}
			}
		}
		if (clazzName != null) {
			//var hostedClazz = null;
			//eval ("hostedClazz = " + clazzName + ";");
			//return hostedClazz;
			return Clazz.evalType (clazzName, true);
		} else {
			return obj.constructor;
		}
	}
};

/*
 * Be used to copy members of class
 */
/* protected */
Clazz.extendsProperties = function (hostThis, hostSuper) {
	for (var o in hostSuper) {
		if (o != "prototype" && o != "superClazz"
				&& o != "__CLASS_NAME__" && o != "implementz"
				&& !Clazz.checkInnerFunction (hostSuper, o)) {
			hostThis[o] = hostSuper[o];
		}
	}
};

/* private */
Clazz.checkInnerFunction = function (hostSuper, funName) {
	for (var k = 0; k < Clazz.innerFunctionNames.length; k++) {
		if (funName == Clazz.innerFunctionNames[k] && 
				Clazz.innerFunctions[funName] == hostSuper[funName]) {
			return true;
		}
	}
	return false;
};

/*
 * Be used to copy members of interface
 */
/* protected */
Clazz.implementsProperties = function (hostThis, hostSuper) {
	for (var o in hostSuper) {
		if (o != "prototype" && o != "superClazz"
				&& o != "__CLASS_NAME__" && o != "implementz") {
			if (typeof hostSuper[o] == "function") {
				/*
				 * static final member of interface may be a class, which may
				 * be function.
				 */
				if (Clazz.checkInnerFunction (hostSuper, o)) {
					continue;
				}
			}
			hostThis[o] = hostSuper[o];
			hostThis.prototype[o] = hostSuper[o];
		}
	}
	/*
	 * There is no concrete fields or methods in interfaces!
	 * Folllowing lines see non-sense!
	 * March 10, 2006
	 */
	/*
	for (var o in hostSuper.prototype) { 
		if (o != "__CLASS_NAME__") {
			hostThis.prototype[o] = hostSuper.prototype[o];
		}
	}
	*/
};

Clazz.args4InheritClass = function () {
};
Clazz.inheritArgs = new Clazz.args4InheritClass ();

/**
 * Inherit class with "extends" keyword and also copy those static members. 
 * Example, as in Java, if NAME is a static member of ClassA, and ClassB 
 * extends ClassA then ClassB.NAME can be accessed in some ways.
 *
 * @param clazzThis child class to be extended
 * @param clazzSuper super class which is inherited from
 * @param objSuper super class instance
 */
/* public */
Clazz.inheritClass = function (clazzThis, clazzSuper, objSuper) {
	//var thisClassName = Clazz.getClassName (clazzThis);
	Clazz.extendsProperties (clazzThis, clazzSuper);
	if (objSuper != null) {
		// ! Unsafe of refrence prototype to an instance!
		// Feb 19, 2006 --josson
		clazzThis.prototype = objSuper; 
	} else if (clazzSuper != Number) {
		clazzThis.prototype = new clazzSuper (Clazz.inheritArgs);
	} else { // Number
		clazzThis.prototype = new Number ();
	}
	clazzThis.superClazz = clazzSuper;
	/*
	 * Is it necessary to reassign the class name?
	 * Mar 10, 2006 --josson
	 */
	//clazzThis.__CLASS_NAME__ = thisClassName;
	clazzThis.prototype.__CLASS_NAME__ = clazzThis.__CLASS_NAME__;
};

/**
 * Implementation of Java's keyword "implements".
 * As in JavaScript there are on "implements" keyword implemented, a property
 * of "implementz" is added to the class to record the interfaces the class
 * is implemented.
 * 
 * @param clazzThis the class to implement
 * @param interfacez Array of interfaces
 */
/* public */
Clazz.implementOf = function (clazzThis, interfacez) {
	if (arguments.length >= 2) {
		if (clazzThis.implementz == null) {
			clazzThis.implementz = new Array ();
		}
		var impls = clazzThis.implementz;
		if (arguments.length == 2) {
			if (typeof interfacez == "function") {
				impls[impls.length] = interfacez;
				Clazz.implementsProperties (clazzThis, interfacez);
			} else if (interfacez instanceof Array) {
				for (var i = 0; i < interfacez.length; i++) {
					impls[impls.length] = interfacez[i];
					Clazz.implementsProperties (clazzThis, interfacez[i]);
				}
			}
		} else {
			for (var i = 1; i < arguments.length; i++) {
				impls[impls.length] = arguments[i];
				Clazz.implementsProperties (clazzThis, arguments[i]);
			}
		}
	}
};

/**
 * TODO: More should be done for interface's inheritance
 */
/* public */
Clazz.extendInterface = Clazz.implementOf;

/* protected */
Clazz.equalsOrExtendsLevel = function (clazzThis, clazzAncestor) {
	if (clazzThis == clazzAncestor) {
		return 0;
	}
	if (clazzThis.implementz != null) {
		var impls = clazzThis.implementz;
		for (var i = 0; i < impls.length; i++) {
			var level = Clazz.equalsOrExtendsLevel (impls[i], clazzAncestor);
			if (level >= 0) {
				return level + 1;
			}
		}
	}
	return -1;
};

/* protected */
/*
Clazz.getClassNameEvalStr = function (clazzVarName, clazzName) {
	var innerTypes = new Array (
		"number", "string", "function", "object", "array", "boolean"
	);
	for (var i = 0; i < innerTypes.length; i++) {
		if (innerTypes[i] == clazzName) {
			return clazzVarName + " = " 
					+ clazzName.substring (0, 1).toUpperCase ()
					+ clazzName.substring (1) + ";";
		}
	}
	return clazzVarName + " = " + clazzName + ";";
};
*/

/* protected */
Clazz.getInheritedLevel = function (clazzTarget, clazzBase) {
	if (clazzTarget == clazzBase) {
		return 0;
	}
	var isTgtStr = (typeof clazzTarget == "string");
	var isBaseStr = (typeof clazzBase == "string");
	if ((isTgtStr && ("void" == clazzTarget || "unknown" == clazzTarget)) 
			|| (isBaseStr && ("void" == clazzBase 
					|| "unknown" == clazzBase))) {
		return -1;
	}
	/*
	 * ? The following lines are confusing
	 * March 10, 2006
	 */
	if ((isTgtStr && "NullObject" == clazzTarget) 
			|| NullObject == clazzTarget) {
		if (clazzBase != Number && clazzBase != Boolean
				&& clazzBase != NullObject) {
			return 0;
		}
	}
	if (isTgtStr) {
		//eval (Clazz.getClassNameEvalStr ("clazzTarget", clazzTarget));
		clazzTarget = Clazz.evalType (clazzTarget);
	}
	if (isBaseStr) {
		//eval (Clazz.getClassNameEvalStr ("clazzBase", clazzBase));
		clazzBase = Clazz.evalType (clazzBase);
	}
	var level = 0;
	var zzalc = clazzTarget; // zzalc <--> clazz
	while (zzalc != clazzBase && level < 10) {
		/* maybe clazzBase is interface */
		if (zzalc.implementz != null) {
			var impls = zzalc.implementz;
			for (var i = 0; i < impls.length; i++) {
				var implsLevel = Clazz.equalsOrExtendsLevel (impls[i], 
						clazzBase);
				if (implsLevel >= 0) {
					return level + implsLevel + 1;
				}
			}
		}
		
		zzalc = zzalc.superClazz;
		if (zzalc == null) {
			if (clazzBase == Object) {
				return level + 1;
			} else {
				return -1;
			}
		}
		level++;
	}
	return level;
};

/**
 * Implements Java's keyword "instanceof" in JavaScript's way.
 * As in JavaScript part of the object inheritance is implemented in only-
 * JavaScript way.
 *
 * @param obj the object to be tested
 * @param clazz the class to be checked
 * @return whether the object is an instance of the class
 */
/* public */
Clazz.instanceOf = function (obj, clazz) {
	if (obj == null) {
		return clazz == undefined; // should usually false
	}
	if (clazz == null) {
		return false;
	}
	if (obj instanceof clazz) {
		return true;
	} else {
		/*
		 * To check all the inherited interfaces.
		 */
		var clazzName = Clazz.getClassName (obj);
		return Clazz.getInheritedLevel (clazzName, clazz) >= 0;
	}
};

/**
 * Call super method of the class. 
 * The same effect as Java's expression:
 * <code> super.* () </code>
 * 
 * @param objThis host object
 * @param clazzThis host object's class. Can not get the class me by host 
 * object. Because the clazzThis is used as one signal for the JavaScript
 * to determine which class is the super.* method calling.
 * For example, class B extends A, and override the method run() with a 
 * supper.run () call. And class C extends B. And then instance of C 
 * invokes the run method will have objThis of C. Now objThis#getClassName
 * is "C", so clazzThis can not be detected when run method is invoked. So
 * it's necessary to declare clazzThis as a parameter in Clazz.superCall.
 * @param funName method name to be called
 * @param funParams Array of method parameters
 */
/* public */
Clazz.superCall = function (objThis, clazzThis, funName, funParams) {
	var params = Clazz.getParamsType (funParams);
	if (objThis[funName] == null) {
		if ("construct" == funName) {
			/* No super constructor */
			return ;
		}
		throw new Clazz.MethodNotFoundException (objThis, clazzThis, 
				"super." + funName, params.typeString);
	}
	if (objThis[funName].claxxOwner != null) { 
		// claxxOwner is a mark for methods that is single.
		if (objThis[funName].claxxOwner == clazzThis) {
			if ("construct" == funName) {
				/* No super constructor */
				return ;
			}
			throw new Clazz.MethodNotFoundException (objThis, clazzThis, 
					"super." + funName, params.typeString);
		}
		/*
		 * This is a single method, call directly!
		 */
		return objThis[funName].apply (objThis, 
				(funParams == null) ? [] : funParams);
	}
	var length = objThis[funName].stacks.length;
	for (var i = 0; i < length; i++) {
		if (objThis[funName].stacks[i] == clazzThis) {
			if (i > 0) {
				var clazzParent = objThis[funName].stacks[i - 1];
				return clazzParent.prototype[funName]
						.apply (objThis, (funParams == null) ? [] : funParams);
			} else {
				/*
				 * Will this case be reachable?
				 * March 4, 2006
				 */
				var clazzParent = objThis[funName].stacks[0];
				var unknownFun = clazzParent.prototype[funName]["\\unknown"];
				if (unknownFun != null) {
					return unknownFun.apply (objThis, 
							(funParams == null) ? [] : funParams);
				}
			}
			break;
		}
	}
	var lastLevel;
	for (var i = length - 1; i >= 0; i--) {
		var level = Clazz.getInheritedLevel (clazzThis, 
				objThis[funName].stacks[i]);
		lastLevel = level;
		if (level > 0) { /* once ">" was ">=" */
			var clazzParent = objThis[funName].stacks[i];
			return clazzParent.prototype[funName]
					.apply (objThis, (funParams == null) ? [] :	funParams);
		}
	}
	if (/*lastLevel == 0 && */funName == "construct") {
		/* No super constructor! */
		return ;
	}
	throw Clazz.MethodNotFoundException (objThis, clazzThis, 
			funName, params.typeString);
};

/**
 * Call super constructor of the class. 
 * The same effect as Java's expression: 
 * <code> super () </code>
 */
/* public */
Clazz.superConstructor = function (objThis, clazzThis, funParams) {
	Clazz.superCall (objThis, clazzThis, "construct", funParams);
};

/**
 * Class for null with a given class as to be casted.
 * This class will be used as an implementation of Java's casting way.
 * For example,
 * <code> this.call ((String) null); </code>
 */
/* protcted */
Clazz.CastedNull = function (asClazz) {
	if (asClazz != null) {
		if (asClazz instanceof String) {
			this.clazzName = asClazz;
		} else if (asClazz instanceof Function) {
			this.clazzName = Clazz.getClassName (asClazz);
		} else {
			this.clazzName = "" + asClazz;
		}
	} else {
		this.clazzName = "Object";
	}
	this.toString = function () {
		return null;
	};
	this.valueOf = function () {
		return null;
	};
};

/**
 * API for Java's casting null.
 * @see Clazz.CastedNull
 *
 * @param asClazz given class
 * @return an instance of class Clazz.CastedNull
 */
/* public */
Clazz.castNullAs = function (asClazz) {
	return new Clazz.CastedNull (asClazz);
};

/** 
 * MethodException will be used as a signal to notify that the method is
 * not found in the current clazz hierarchy.
 */
/* private */
Clazz.MethodException = function () {
	/*
	this.message = "The static Clazz instance can not found the method!";
	this.toString = function () {
		return this.message;
	};
	*/
};
/* protected */
Clazz.MethodNotFoundException = function () {
	this.toString = function () {
		return "MethodNotFoundException";
	};
};

/* private */
Clazz.getParamsType = function (funParams) {
	var params = new Array ();
	var containsCastedNullParams = false;
	if (funParams != null) {
		for (var i = 0; i < funParams.length; i++) {
			params[i] = Clazz.getClassName (funParams[i]);
			if (funParams[i] instanceof Clazz.CastedNull) {
				containsCastedNullParams = true;
			}
		}
	}
	if (params.length == 0) {
		params[0] = "void";
	}
	params.typeString = "\\" + params.join ('\\');
	params.containsCastedNullParams = containsCastedNullParams;
	return params;
};
/**
 * Search the given class prototype, find the method with the same
 * method name and the same parameter signatures with the given 
 * parameters, and then run the method with the given parameters.
 *
 * @param objThis the current host object
 * @param claxxRef the current host object's class
 * @param fxName the method name
 * @param funParams the given arguments
 * @return the result of the specified method of the host object,
 * the return maybe void.
 * @throws Clazz.MethodNotFoundException if no matched method is found
 */
/* protected */
Clazz.searchAndExecuteMethod = function (objThis, claxxRef, fxName, funParams) {
	var params = Clazz.getParamsType (funParams);
	/*
	 * Search the inheritance stacks to get the given class' function
	 */

	/*
	 * First try to search method within the same class scope
	 */
	var length = objThis[fxName].stacks.length;
	//var clazzThis = Clazz.getClass (objThis);
	//var isSuper = claxxRef != clazzThis || clazzThis["@$" + fxName];
	for (var i = 0; i < length; i++) {
		if (objThis[fxName].stacks[i] == claxxRef) {
			var clazzFun = objThis[fxName].stacks[i].prototype[fxName];
			// March 10, 2006
			//if (clazzFun == null) {
				/*
				 * Will this case be reachable?
				 * March 4, 2006 josson
				 */
				/*
				 * Should try to call its super methods before throwing out
				 * exception.
				 */
			//	throw new Clazz.MethodNotFoundException (objThis, claxxRef, 
			//			fxName, params.typeString);
			//}
			try {
				return Clazz.tryToSearchAndExecute (objThis, clazzFun, params, 
						funParams/*, isSuper, clazzThis*/);
			} catch (e) {
				if (!(e instanceof Clazz.MethodException)) {
					throw e;
				}
			}
			/*
			 * Try to call its super methods before throwing out exception.
			 */
			break;
		}
	}
	/*
	 * Try to search method in the super methods.
	 */
	for (var i = length - 1; i >= 0; i--) {
		if (Clazz.getInheritedLevel (claxxRef, 
				objThis[fxName].stacks[i]) >= 0) {
			var clazzFun = objThis[fxName].stacks[i].prototype[fxName];
			// March 10, 2006
			//if (clazzFun == null) {
				/*
				 * Will this case be reachable?
				 * March 4, 2006 josson
				 */
				/*
				 * Should try to call its super methods before throwing out
				 * exception.
				 */
			//	throw new Clazz.MethodNotFoundException (objThis, claxxRef, 
			//			fxName, params.typeString);
			//}
			try {
				return Clazz.tryToSearchAndExecute (objThis, clazzFun, params, 
						funParams/*, isSuper, clazzThis*/);
			} catch (e) {
				if (!(e instanceof Clazz.MethodException)) {
					throw e;
				}
			}
			/*
			 * Try to call its super methods before throwing out exception.
			 */
			continue;
		}
	}
	if ("construct" == fxName) {
		/*
		 * For non existed constructors, just return without throwing
		 * exceptions. In Java codes, extending Object can call super
		 * default Object#constructor, which is not defined in JS.
		 */
		return ;
	}
	throw new Clazz.MethodNotFoundException (objThis, claxxRef, 
			fxName, params.typeString);
};

/* private */
Clazz.tryToSearchAndExecute = function (objThis, clazzFun, params, funParams/*, 
		isSuper, clazzThis*/) {
	var methodSignatures = new Array ();
	var xfparams = null;
	for (var fn in clazzFun) {
		if (fn.indexOf ('\\') == 0) {
			methodSignatures[methodSignatures.length] = fn.substring (1);
		}
		/*
		 * When there are only one method in the class, use the funParams
		 * to identify the parameter type.
		 *
		 * Fixed a bug of ArrayList.remove (Object)
		 */
		/*
		 * See Clazz#defineMethod --Mar 10, 2006, josson
		 */
		if (fn == "funParams" && clazzFun.funParams != null) {
			xfparams = clazzFun.funParams;
		}
	}
	var generic = false;
	if (methodSignatures.length == 0 && xfparams != null) {
		methodSignatures[0] = xfparams.substring (1);
		generic = true;
	}
	var method = Clazz.searchMethod (methodSignatures, params);
	if (method != null) {
		var f = null;
		if (generic) { /* Use the generic method */
			/*
			 * Will this case be reachable?
			 * March 4, 2006 josson
			 */
			f = clazzFun; // call it directly
		} else {
			f = clazzFun["\\" + method];
		}
		if (f != null) {
			var methodParams = null;
			if (params.containsCastedNullParams) {
				var methodParams = new Array ();
				for (var k = 0; k < funParams.length; k++) {
					if (funParams[k] instanceof Clazz.CastedNull) {
						/*
						 * For Clazz.CastedNull instances, the type name is
						 * already used to indentified the method in Clazz#
						 * searchMethod.
						 */
						methodParams[k] = null;
					} else {
						methodParams[k] = funParams[k];
					}
				}
			} else {
				methodParams = funParams;
			}
			return f.apply (objThis, methodParams);
		}
	}
	throw new Clazz.MethodException ();
};

/**
 * Search the existed polynomial methods to get the matched method with
 * the given parameter types.
 *
 * @param existedMethods Array of string which contains method parameters
 * @param paramTypes Array of string that is parameter type.
 * @return string of method parameters seperated by "\\"
 */
/* private */
Clazz.searchMethod = function (existedMethods, paramTypes) {
	var roundOne = new Array ();
	for (var i = 0; i < existedMethods.length; i++) {
		var split = existedMethods[i].split (/\\/);
		if (split.length == paramTypes.length) {
			roundOne[roundOne.length] = split;
		}
	}
	var resultOne = roundOne;
	/*
	 * Filter out all the fitted methods for the given parameters
	 */
	var roundTwo = new Array ();
	for (var i = 0; i < resultOne.length; i++) {
		var fittedLevel = new Array ();
		var isFitted = true;
		for (var j = 0; j < resultOne[i].length; j++) {
			fittedLevel[j] = Clazz.getInheritedLevel (paramTypes[j], 
					resultOne[i][j]);
			if (fittedLevel[j] < 0) {
				isFitted = false;
				break;
			}
		}
		if (isFitted) {
			fittedLevel[paramTypes.length] = i; // Keep index for later use
			roundTwo[roundTwo.length] = fittedLevel;
		}
	}
	if (roundTwo.length == 0) {
		return null;
	}
	/*
	 * Find out the best method according to the inheritance.
	 */
	var resultTwo = roundTwo;
	var min = resultTwo[0];
	for (var i = 1; i < resultTwo.length; i++) {
		var isVectorLesser = true;
		for (var j = 0; j < paramTypes.length; j++) {
			if (min[j] < resultTwo[i][j]) {
				isVectorLesser = false;;
				break;
			}
		}
		if (isVectorLesser) {
			min = resultTwo[i];
		}
	}
	var index = min[paramTypes.length]; // Get the previously stored index
	var params = resultOne[index];
	var methodParams = "";
	for (var i = 0; i < params.length; i++) {
		methodParams += params[i];
		if (i != params.length - 1) {
			methodParams += "\\";
		}
	}
	/*
	 * Return the method parameters' type string as indentifier of the
	 * choosen method.
	 */
	return methodParams;
};

/**
 * Generate delegating function for the given method name.
 *
 * @param claxxRef the specified class for the method
 * @funName method name of the specified method
 * @return the method delegate which will try to search the method
 * from the given class by the parameters
 */
/* private */
Clazz.generateDelegatingMethod = function (claxxRef, funName) {
	/*
	 * Delegating method.
	 * Each time the following expression will generate a new 
	 * function object.
	 */
	var delegating = function () {
			var r = arguments;
			return SAEM (this, r.callee.claxxRefrence, r.callee.methodName, r);
	};
	delegating.methodName = funName;
	delegating.claxxRefrence = claxxRef;
	return delegating;
};

SAEM = Clazz.searchAndExecuteMethod;

/*
 * Define method for the class with the given method name and method
 * body and method parameter signature.
 *
 * @param clazzThis host class in which the method to be defined
 * @param funName method name
 * @param funBody function object, e.g function () { ... }
 * @funParams paramether signature, e.g ["string", "number"]
 */
/* public */
Clazz.defineMethod = function (clazzThis, funName, funBody, funParams) {
	var fpName = "";
	if (funParams != null) {
		/* 
		 * If funParams is Array, funParams.toString() will
		 * also return "*,*,..." string.
		 */
		var paramStr = funParams.toString ().replace (/\s/g, "");
		if (paramStr.length != 0) {
			var params = paramStr.split (/,/);
			fpName += "\\" + params.join ('\\');
		} else {
			fpName += "\\void";
		}
	} else {
		fpName += "\\void";
	}
	/*
	 `* For method the first time is defined, just keep it rather than
	 * wrapping into deep hierarchies!
	 */
	if (clazzThis.prototype[funName] == null) {
		//*
		// property "funParams" will be used as a mark of only-one method
		funBody.funParams = fpName; 
		funBody.claxxOwner = clazzThis;
		clazzThis.prototype[funName] = funBody;
		return ;
		// */
	} else if (clazzThis.prototype[funName].claxxOwner == clazzThis
			&& clazzThis.prototype[funName].funParams == fpName) {
		return ;
	}
	var oldFun = null;
	var oldStacks = new Array ();
	if (clazzThis.prototype[funName] != null) {
		if (clazzThis.prototype[funName].stacks == null) {
			/* method is not defined by Clazz.defineMethod () */
			oldFun = clazzThis.prototype[funName];
		} else {
			oldStacks = clazzThis.prototype[funName].stacks;
		}
	}
	
	if (oldFun != null && oldFun.claxxOwner != null) {
		// oldFun is not defined by Clazz.defineMethod
		
		/*
		 * oldStacks should be "new Array ()";
		 */
		/*
		 * Here try to fix up the method into Clazz compatiable.
		 */
		oldStacks[0] = oldFun.claxxOwner;
		/*
		if (oldFun.claxxOwner != clazzThis) {
			if ("releaseChild" == funName) {
				error (" in here ");
			}
			oldFun.claxxOwner.prototype[funName].stacks = oldStacks;
			oldFun.claxxOwner.prototype[funName] = Clazz
					.generateDelegatingMethod (oldFun.claxxOwner, funName);
			oldFun.claxxOwner.prototype[funName][oldFun.funParams] = oldFun;
			oldFun.claxxOwner = null;
			oldFun.funParams = null;
			oldFun = null;
		}
		//*/
	}
	/*
	 * Method that is already defined in super class will be overriden
	 * with a new proxy method with class hierarchy stored in a stack.
	 * That is to say, the super methods are lost in this class' proxy
	 * method. 
	 * When method are being called, methods defined in the new proxy 
	 * method will be searched through first. And if no method fitted, 
	 * it will then try to search method in the super class stacks.
	 */
	/* method has not been defined yet */
	/* method is not defined by Clazz.defineMethod () */
	/* method is defined in super class */
	if (clazzThis.prototype[funName] == null 
			|| clazzThis.prototype[funName].stacks == null 
			|| clazzThis.prototype[funName].claxxRefrence != clazzThis) {
		/*
		 * Generate a new delegating method for the class
		 */
		clazzThis.prototype[funName] = Clazz
				.generateDelegatingMethod (clazzThis, funName);
		/*
		 * March 10, 2006
		 */
		/*
		clazzThis.prototype[funName] = (function (claxxRef, methodName) {
			var proxy = function () {
				return Clazz.searchAndExecuteMethod (this, claxxRef, 
					methodName, arguments);
			};
			proxy.claxxRefrence = claxxRef;
			return proxy;
		}) (clazzThis, funName);
		//*/
		/*
		 * Keep the class inheritance stacks
		 */
		var arr = new Array ();
		for (var i = 0; i < oldStacks.length; i++) {
			arr[i] = oldStacks[i];
		}
		clazzThis.prototype[funName].stacks = arr;
	}
	var ss = clazzThis.prototype[funName].stacks;

	if (ss.length == 0/* || ss[ss.length - 1] != clazzThis*/) {
		ss[ss.length] = clazzThis;
	} else {
		var existed = false;
		for (var i = ss.length - 1; i >= 0; i--) {
			if (ss[i] == clazzThis) {
				existed = true;
				break;
			}
		}
		if (!existed) {
			ss[ss.length] = clazzThis;
		}
	}

	if (oldFun != null) {
		if (oldFun.claxxOwner == clazzThis) {
			clazzThis.prototype[funName][oldFun.funParams] = oldFun;
			oldFun.claxxOwner = null;
			// property "funParams" will be used as a mark of only-one method
			oldFun.funParams = null; // null ? safe ? // safe for " != null"
		} else {
			/*
			 * The function is not defined Clazz.defineMethod ().
			 * Try to fixup the method ...
			 * As a matter of lost method information, I just suppose
			 * the method to be fixed is with void parameter!
			 */
			clazzThis.prototype[funName]["\\unknown"] = oldFun;
		}
	}
	clazzThis.prototype[funName][fpName] = funBody;
};

/**
 * Make constructor for the class with the given function body and parameters
 * signature.
 * 
 * @param clazzThis host class
 * @param funBody constructor body
 * @param funParams constructor parameters signature
 */
/* public */
Clazz.makeConstructor = function (clazzThis, funBody, funParams) {
	var funName = "construct";
	Clazz.defineMethod (clazzThis, funName, funBody, funParams);
};

/* protected */
Clazz.allPackage = new Object ();

/* public */
Clazz.declarePackage = function (pkgName) {
	if (pkgName != null && pkgName.length != 0) {
		var pkgFrags = pkgName.split (/\./);
		var pkg = Clazz.allPackage;
		for (var i = 0; i < pkgFrags.length; i++) {
			if (pkg[pkgFrags[i]] == null) {
				pkg[pkgFrags[i]] = new Object ();
				if (i == 0) {
					// eval ...
					window[pkgFrags[i]] = pkg[pkgFrags[i]];
				}
			}
			pkg = pkg[pkgFrags[i]]
		}
		return pkg;
	}
};

/* protected */
Clazz.evalType = function (typeStr, isQualified) {
	var idx = typeStr.lastIndexOf (".");
	if (idx != -1) {
		var pkgName = typeStr.substring (0, idx);
		var pkg = Clazz.declarePackage (pkgName);
		var clazzName = typeStr.substring (idx + 1);
		return pkg[clazzName];
	} else if (isQualified) {
		return window[typeStr];
	} else if (typeStr == "number") {
		return Number;
	} else if (typeStr == "object") {
		return Object;
	} else if (typeStr == "string") {
		return String;
	} else if (typeStr == "boolean") {
		return Boolean;
	} else if (typeStr == "function") {
		return Function;
	} else if (typeStr == "void" || typeStr == "undefined"
			|| typeStr == "unknown") {
		return typeStr;
	} else if (typeStr == "NullObject") {
		return NullObject;
	} else {
		return window[typeStr];
	}
};

/**
 * Define a class or interface.
 *
 * @param qClazzName String presents the qualified name of the class
 * @param clazzFun Function of the body
 * @param clazzParent Clazz to inherit from, may be null
 * @param interfacez Clazz may implement one or many interfaces
 *   interfacez can be Clazz object or Array of Clazz objects.
 * @return Ruturn the modified Clazz object
 */
/* public */
Clazz.defineType = function (qClazzName, clazzFun, clazzParent, interfacez) {
	var idx = qClazzName.lastIndexOf (".");
	if (idx != -1) {
		var pkgName = qClazzName.substring (0, idx);
		var pkg = Clazz.declarePackage (pkgName);
		var clazzName = qClazzName.substring (idx + 1);
		if (pkg[clazzName] != null) {
			// already defined! Should throw exception!
			return pkg[clazzName];
		}
		pkg[clazzName] = clazzFun;
	} else {
		if (window[qClazzName] != null) {
			// already defined! Should throw exception!
			return window[qClazzName];
		}
		window[qClazzName] = clazzFun;
	}
	clazzFun.__CLASS_NAME__ = qClazzName;
	clazzFun.prototype.__CLASS_NAME__ = qClazzName;
	Clazz.enhanceTypeFunction (clazzFun);
	if (clazzParent != null) {
		Clazz.inheritClass (clazzFun, clazzParent);
	}
	if (interfacez != null) {
		Clazz.implementOf (clazzFun, interfacez);
	}
	return clazzFun;
};

/* protected */
Clazz.instantialize = function (objThis, args) {
	if (args != null && args.length == 1 && args[0] != null 
			&& args[0] instanceof Clazz.args4InheritClass) {
		return ;
	}
	if (objThis.construct != null) {
		objThis.construct.apply (objThis, args);
	}
};

/**
 * Once there are other methods registered to the Function.prototype, 
 * those method names should be add to the following Array.
 */
/*
 * static final member of interface may be a class, which may
 * be function.
 */
/* protected */
Clazz.innerFunctionNames = [
	"equals", "getName", "defineMethod", "defineStaticMethod",
	"makeConstructor"
];

/*
 * Static methods
 */
Clazz.innerFunctions = {
	/*
	 * Similar to Object#equals
	 */
	equals : function (aFun) {
		return this == aFun;
	},

	/*
	 * Similar to Class#getName
	 */
	getName : function () {
		return Clazz.getClassName (this);
	},

	/*
	 * For JavaScript programmers
	 */
	defineMethod : function (methodName, funBody, paramTypes) {
		Clazz.defineMethod (this, methodName, funBody, paramTypes);
	},

	/*
	 * For JavaScript programmers
	 */
	defineStaticMethod : function (methodName, funBody, paramTypes) {
		Clazz.defineMethod (this, methodName, funBody, paramTypes);
		this[methodName] = this.prototype[methodName];
	},
	
	/*
	 * For JavaScript programmers
	 */
	makeConstructor : function (funBody, paramTypes) {
		Clazz.makeConstructor (this, funBody, paramTypes);
	}
};

/* private */
Clazz.enhanceTypeFunction = function (typeFun) {
	for (var i = 0; i < Clazz.innerFunctionNames.length; i++) {
		var methodName = Clazz.innerFunctionNames[i];
		typeFun[methodName] = Clazz.innerFunctions[methodName];
	}
};

