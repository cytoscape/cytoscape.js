'use strict';

var util = require( '../util' );

var elesfn = ({
  classes: function( classes ){
    classes = classes.match( /\S+/g ) || [];
    var self = this;
    var changed = [];
    var classesMap = {};

    // fill in classes map
    for( var i = 0; i < classes.length; i++ ){
      var cls = classes[ i ];

      classesMap[ cls ] = true;
    }

    // check and update each ele
    for( var j = 0; j < self.length; j++ ){
      var ele = self[ j ];
      var _p = ele._private;
      var eleClasses = _p.classes;
      var changedEle = false;

      // check if ele has all of the passed classes
      for( var i = 0; i < classes.length; i++ ){
        var cls = classes[ i ];
        var eleHasClass = eleClasses[ cls ];

        if( !eleHasClass ){
          changedEle = true;
          break;
        }
      }

      // check if ele has classes outside of those passed
      if( !changedEle ){
        var classes = Object.keys( eleClasses );

        for( var i = 0; i < classes.length; i++ ){
          var eleCls = classes[i];
          var eleHasClass = eleClasses[ eleCls ];
          var specdClass = classesMap[ eleCls ]; // i.e. this class is passed to the function

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
        .trigger( 'class' )
      ;
    }

    return self;
  },

  addClass: function( classes ){
    return this.toggleClass( classes, true );
  },

  hasClass: function( className ){
    var ele = this[0];
    return ( ele != null && ele._private.classes[ className ] ) ? true : false;
  },

  toggleClass: function( classesStr, toggle ){
    var classes = classesStr.match( /\S+/g ) || [];
    var self = this;
    var changed = []; // eles who had classes changed

    for( var i = 0, il = self.length; i < il; i++ ){
      var ele = self[ i ];
      var changedEle = false;

      for( var j = 0; j < classes.length; j++ ){
        var cls = classes[ j ];
        var eleClasses = ele._private.classes;
        var hasClass = eleClasses[ cls ];
        var shouldAdd = toggle || (toggle === undefined && !hasClass);

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
        .trigger( 'class' )
      ;
    }

    return self;
  },

  removeClass: function( classes ){
    return this.toggleClass( classes, false );
  },

  flashClass: function( classes, duration ){
    var self = this;

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
