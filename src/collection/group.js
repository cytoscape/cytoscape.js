let elesfn = ({
  isNode: function(){
    return this.group() === 'nodes';
  },

  isEdge: function(){
    return this.group() === 'edges';
  },

  isLoop: function(){
    return this.isEdge() && this.source().id() === this.target().id();
  },

  isSimple: function(){
    return this.isEdge() && this.source().id() !== this.target().id();
  },

  group: function(){
    let ele = this[0];

    if( ele ){
      return ele._private.group;
    }
  }
});


module.exports = elesfn;
