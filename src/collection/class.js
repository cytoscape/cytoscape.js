let Set = require('../set');

let elesfn = ({
  classes: function( classes ){
    classes = ( classes || '' ).match( /\S+/g ) || [];
    let self = this;
    let changed = [];
    let classesMap = new Set( classes );

    // check and update each ele
    for( let j = 0; j < self.length; j++ ){
      let ele = self[ j ];
      let _p = ele._private;
      let eleClasses = _p.classes;
      let changedEle = false;

      // check if ele has all of the passed classes
      classesMap.forEach( cls => {
        let eleHasClass = eleClasses.has(cls);

        if( !eleHasClass ){
          changedEle = true;
        }
      });

      // check if ele has classes outside of those passed
      if( !changedEle ){
        eleClasses.forEach( eleCls => {
          let specdClass = classesMap.has(eleCls);

          if( !specdClass ){
            changedEle = true;
          }
        });
      }

      if( changedEle ){
        _p.classes = new Set( classesMap );

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
    return ( ele != null && ele._private.classes.has(className) );
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
        let hasClass = eleClasses.has(cls);
        let shouldAdd = toggle || (toggle === undefined && !hasClass);

        if( shouldAdd ){
          eleClasses.add(cls);

          if( !hasClass && !changedEle ){
            changed.push( ele );
            changedEle = true;
          }
        } else { // then remove
          eleClasses.delete(cls);

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
