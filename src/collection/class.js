import Set from '../set';
import * as is from '../is';

let elesfn = ({

  /**
 * @typedef {object} eles_classes
 * @property {object} NULL
 * @property {object} classes - An array (or a space-separated string) of class names that replaces the current class list.
 */

  /**
 * Get or replace the current list of classes on the elements with the specified list.
 * @memberof eles
 * @alias eles.className|eles.classNames
 * @sub_functions ele.classes|eles.classes
 * @param {...eles_classes} classes - Get the list of classes as an array for the element. | Replace the list of classes for all elements in the collection.
 * @namespace eles.classes
 */
  classes: function( classes ){
    let self = this;

    if( classes === undefined ){
      let ret = [];

      self[0]._private.classes.forEach(cls => ret.push(cls));

      return ret;
    } else if( !is.array( classes ) ){
      // extract classes from string
      classes = ( classes || '' ).match( /\S+/g ) || [];
    }

    let changed = [];
    let classesSet = new Set( classes );

    // check and update each ele
    for( let j = 0; j < self.length; j++ ){
      let ele = self[ j ];
      let _p = ele._private;
      let eleClasses = _p.classes;
      let changedEle = false;

      // check if ele has all of the passed classes
      for( let i = 0; i < classes.length; i++ ){
        let cls = classes[i];
        let eleHasClass = eleClasses.has(cls);

        if( !eleHasClass ){
          changedEle = true;
          break;
        }
      }

      // check if ele has classes outside of those passed
      if( !changedEle ){
        changedEle = eleClasses.size !== classes.length;
      }

      if( changedEle ){
        _p.classes = classesSet;

        changed.push( ele );
      }
    }

    // trigger update style on those eles that had class changes
    if( changed.length > 0 ){
      this.spawn( changed )
        .updateStyle()
        .emit( 'class' )
      ;
    }

    return self;
  },

  /**
 * @typedef {object} eles_addClass
 * @property {object} classes - An array (or a space-separated string) of class names to add to the elements.
 */

  /**
 * Add classes to elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
 * @memberof eles
 * @param {...eles_addClass} classes - Adding Class
 * @namespace eles.addClass
 */
  addClass: function( classes ){
    return this.toggleClass( classes, true );
  },

  /**
 * @typedef {object} eles_hasClass
 * @property {object} className - The name of the class to test for.
 */

  /**
 * Get whether an element has a particular class.
 * @memberof eles
 * @param {...eles_hasClass} className - Adding Class
 * @namespace eles.hasClass
 */
  hasClass: function( className ){
    let ele = this[0];
    return ( ele != null && ele._private.classes.has(className) );
  },

  /**
 * @typedef {object} eles_toggleClass_type
 * @property {object} classes - An array (or a space-separated string) of class names to toggle on the elements.
 * @property {object} toggle - [optional] Instead of automatically toggling, adds the classes on truthy values or removes them on falsey values.
 */

/**
 * @typedef {object} eles_toggleClass
 * @property {eles_toggleClass_type} eles_toggleClass_type
 */

/**
 * Toggle whether the elements have the specified classes.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
 * @memberof eles
 * @param {...eles_toggleClass} toggle - Toggle Event
 * @namespace eles.toggleClass
 */ 
  toggleClass: function( classes, toggle ){
    if( !is.array( classes ) ){
      // extract classes from string
      classes = classes.match( /\S+/g ) || [];
    }
    let self = this;
    let toggleUndefd = toggle === undefined;
    let changed = []; // eles who had classes changed

    for( let i = 0, il = self.length; i < il; i++ ){
      let ele = self[ i ];
      let eleClasses = ele._private.classes;
      let changedEle = false;

      for( let j = 0; j < classes.length; j++ ){
        let cls = classes[ j ];
        let hasClass = eleClasses.has(cls);
        let changedNow = false;

        if( toggle || (toggleUndefd && !hasClass) ){
          eleClasses.add(cls);
          changedNow = true;
        } else if( !toggle || (toggleUndefd && hasClass) ){
          eleClasses.delete(cls);
          changedNow = true;
        }

        if( !changedEle && changedNow ){
          changed.push( ele );
          changedEle = true;
        }

      } // for j classes
    } // for i eles

    // trigger update style on those eles that had class changes
    if( changed.length > 0 ){
      this.spawn( changed )
        .updateStyle()
        .emit( 'class' )
      ;
    }

    return self;
  },

  /**
 * @typedef {object} eles_removeClass
 * @property {object} classes - An array (or a space-separated string) of class names to add to the elements.
 */

  /**
 * Remove classes from elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
 * @memberof eles
 * @param {...eles_removeClass} classes - Adding Class
 * @namespace eles.removeClass
 */
  removeClass: function( classes ){
    return this.toggleClass( classes, false );
  },

  /**
 * @typedef {object} eles_flashClass_type
 * @property {object} classes - An array (or a space-separated string) of class names to flash on the elements.
 * @property {object} duration - [optional] The duration in milliseconds that the classes should be added on the elements. After the duration, the classes are removed.
 */

/**
 * @typedef {object} eles_flashClass
 * @property {eles_flashClass_type} eles_flashClass_type
 */

/**
 * Add classes to the elements, and then remove the classes after a specified duration.
 * @memberof eles
 * @param {...eles_flashClass} duration - flash Event
 * @namespace eles.flashClass
 */
  flashClass: function( classes, duration ){
    let self = this;

    if( duration == null ){
      duration = 250;
    } else if( duration === 0 ){
      return self; // nothing to do really
    }

    self.addClass( classes );
    setTimeout( function(){
      self.removeClass( classes );
    }, duration );

    return self;
  }
});

elesfn.className = elesfn.classNames = elesfn.classes;

export default elesfn;
