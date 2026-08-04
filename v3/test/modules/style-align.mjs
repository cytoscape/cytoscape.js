import { expect } from 'chai';
import align from '../../src/extensions/renderer/base/coord-ele-math/labels.mjs';
import { labelHalign, labelJustification, labelValign } from '../../src/style/align.mjs';

describe('Style alignment values', function(){
  it('classifies node label alignment values', function(){
    expect( labelHalign( 'left' ) ).to.equal( 'left' );
    expect( labelHalign( 'center' ) ).to.equal( 'center' );
    expect( labelHalign( 'right' ) ).to.equal( 'right' );
    expect( labelHalign( 'left-inside' ) ).to.equal( 'right' );
    expect( labelHalign( 'right-inside' ) ).to.equal( 'left' );

    expect( labelValign( 'top' ) ).to.equal( 'top' );
    expect( labelValign( 'center' ) ).to.equal( 'center' );
    expect( labelValign( 'bottom' ) ).to.equal( 'bottom' );
    expect( labelValign( 'top-inside' ) ).to.equal( 'bottom' );
    expect( labelValign( 'bottom-inside' ) ).to.equal( 'top' );

    expect( labelJustification( 'left' ) ).to.equal( 'right' );
    expect( labelJustification( 'center' ) ).to.equal( 'center' );
    expect( labelJustification( 'right' ) ).to.equal( 'left' );
    expect( labelJustification( 'left-inside' ) ).to.equal( 'left' );
    expect( labelJustification( 'right-inside' ) ).to.equal( 'right' );
  });

  it('projects node label values against the node edge', function(){
    let makeNode = ( halign, valign ) => ({
      pstyle: name => {
        let styles = {
          label: { strValue: 'label' },
          'text-halign': { strValue: halign },
          'text-valign': { strValue: valign }
        };

        return styles[ name ];
      },
      width: () => 100,
      height: () => 80,
      padding: () => 10,
      position: () => ({ x: 200, y: 300 }),
      _private: {
        rscratch: {},
        rstyle: {}
      }
    });

    let renderer = {
      calculateLabelAngles: () => {},
      applyLabelDimensions: () => {}
    };

    let outsideLeftTop = makeNode( 'left', 'top' );
    align.recalculateNodeLabelProjection.call( renderer, outsideLeftTop );
    expect( outsideLeftTop._private.rscratch.labelX ).to.equal( 140 );
    expect( outsideLeftTop._private.rscratch.labelY ).to.equal( 250 );

    let center = makeNode( 'center', 'center' );
    align.recalculateNodeLabelProjection.call( renderer, center );
    expect( center._private.rscratch.labelX ).to.equal( 200 );
    expect( center._private.rscratch.labelY ).to.equal( 300 );

    let outsideRightBottom = makeNode( 'right', 'bottom' );
    align.recalculateNodeLabelProjection.call( renderer, outsideRightBottom );
    expect( outsideRightBottom._private.rscratch.labelX ).to.equal( 260 );
    expect( outsideRightBottom._private.rscratch.labelY ).to.equal( 350 );

    let insideLeftTop = makeNode( 'left-inside', 'top-inside' );
    align.recalculateNodeLabelProjection.call( renderer, insideLeftTop );
    expect( insideLeftTop._private.rscratch.labelX ).to.equal( 160 );
    expect( insideLeftTop._private.rscratch.labelY ).to.equal( 270 );

    let insideRightBottom = makeNode( 'right-inside', 'bottom-inside' );
    align.recalculateNodeLabelProjection.call( renderer, insideRightBottom );
    expect( insideRightBottom._private.rscratch.labelX ).to.equal( 240 );
    expect( insideRightBottom._private.rscratch.labelY ).to.equal( 330 );
  });
});
