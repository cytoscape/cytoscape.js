'use strict';

let util = require( '../util' );

let elesfn = ({
  classes: function( classes ){
    classes = ( classes || '' ).match( /\S+/g ) || [];
    let self = this;
    let changed = [];
    let classesMap = {};

    // fill in classes map
    for( let i = 0; i < classes.length; i++ ){
      let cls = classes[ i ];

      classesMap[ cls ] = true;
    }

    // check and update each ele
    for( let j = 0; j < self.length; j++ ){
      let ele = self[ j ];
      let _p = ele._private;
      let eleClasses = _p.classes;
      let changedEle = false;

      // check if ele has all of the passed classes
      for( let i = 0; i < classes.length; i++ ){
        let cls = classes[ i ];
        let eleHasClass = eleClasses[ cls ];

        if( !eleHasClass ){
          changedEle = true;
          break;
        }
      }

      // check if ele has classes outside of those passed
      if( !changedEle ){
        let classes = Object.keys( eleClasses );

        for( let i = 0; i < classes.length; i++ ){
          let eleCls = classes[i];
          let eleHasClass = eleClasses[ eleCls ];
          let specdClass = classesMap[ eleCls ]; // i.e. this class is passed to the function

          if( eleHasClass && !specdClass ){
            changedEle = true;
            break;
          }
        }
      }

      if( changedEle ){
        _p.classes = util.copy( classesMap );

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

  addClass: function( classes ){
    return this.toggleClass( classes, true );
  },

  hasClass: function( className ){
    let ele = this[0];
    return ( ele != null && ele._private.classes[ className ] ) ? true : false;
  },

  toggleClass: function( classesStr, toggle ){
    let classes = classesStr.match( /\S+/g ) || [];
    let self = this;
    let changed = []; // eles who had classes changed

    for( let i = 0, il = self.length; i < il; i++ ){
      let ele = self[ i ];
      let changedEle = false;

      for( let j = 0; j < classes.length; j++ ){
        let cls = classes[ j ];
        let eleClasses = ele._private.classes;
        let hasClass = eleClasses[ cls ];
        let shouldAdd = toggle || (toggle === undefined && !hasClass);

        if( shouldAdd ){
          eleClasses[ cls ] = true;

          if( !hasClass && !changedEle ){
            changed.push( ele );
            changedEle = true;
          }
        } else { // then remove
          eleClasses[ cls ] = false;

          if( hasClass && !changedEle ){
            changed.push( ele );
            changedEle = true;
          }
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

  removeClass: function( classes ){
    return this.toggleClass( classes, false );
  },

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

module.exports = elesfn;
