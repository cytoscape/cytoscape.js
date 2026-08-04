import Set from '../set.mjs';
import * as is from '../is.mjs';
import type { Collection, Element } from './eles-types.mjs';

/** Class manipulation methods contributed to the collection prototype. */
export interface CollectionClass {
  classes(): string[];
  classes( classes: string | string[] ): Collection;
  className(): string[];
  className( classes: string | string[] ): Collection;
  classNames(): string[];
  classNames( classes: string | string[] ): Collection;
  addClass( classes: string | string[] ): Collection;
  hasClass( className: string ): boolean;
  toggleClass( classes: string | string[], toggle?: boolean ): Collection;
  removeClass( classes: string | string[] ): Collection;
  flashClass( classes: string | string[], duration?: number ): Collection;
}

let elesfn = ({
  classes: function( this: Collection, classes?: string | string[] ){
    let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

    if( classes === undefined ){
      let ret: string[] = [];

      self[0]._private.classes.forEach( cls => ret.push( cls ) );

      return ret;
    } else if( !is.array( classes ) ){
      // extract classes from string
      classes = ( classes || '' ).match( /\S+/g ) || [];
    }

    let changed: Element[] = [];
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

  addClass: function( this: Collection, classes: string | string[] ){
    return this.toggleClass( classes, true );
  },

  hasClass: function( this: Collection, className: string ){
    let ele = this[0];
    return ( ele != null && ele._private.classes.has(className) );
  },

  toggleClass: function( this: Collection, classes: string | string[], toggle?: boolean ){
    if( !is.array( classes ) ){
      // extract classes from string
      classes = classes.match( /\S+/g ) || [];
    }
    let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let toggleUndefd = toggle === undefined;
    let changed: Element[] = []; // eles who had classes changed

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

  removeClass: function( this: Collection, classes: string | string[] ){
    return this.toggleClass( classes, false );
  },

  flashClass: function( this: Collection, classes: string | string[], duration?: number ){
    let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

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
}) as CollectionClass;

elesfn.className = elesfn.classNames = elesfn.classes;

export default elesfn;
