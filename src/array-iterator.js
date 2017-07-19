class ArrayIterator {
  constructor( array = [] ){
    this.values = array;
    this.index = 0;
  }

  next(){
    let value = this.values[ this.index ];
    let done = this.index >= this.values.length;

    this.index++;

    return { value, done };
  }
}

module.exports = ArrayIterator;
