import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/style-getters', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a', name: 'Node A' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: {
          'background-color': 'red',
          width: 40,
          height: 20,
          shape: 'rectangle',
          'border-width': 2,
          'border-color': '#00f',
          label: 'data(name)',
          'font-size': 12,
          color: '#333',
        },
        edges: {
          'line-color': 'rgb(10,20,30)',
          width: 3,
          opacity: 0.5,
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#0f0',
        },
      },
    });
  });

  describe('style()', function () {
    it('reads node props', function () {
      var a = cy.$id('a');

      expect(a.style('background-color')).to.equal('rgb(255,0,0)');
      expect(a.style('width')).to.equal(40);
      expect(a.style('height')).to.equal(20);
      expect(a.style('shape')).to.equal('rectangle');
      expect(a.style('border-width')).to.equal(2);
      expect(a.style('border-color')).to.equal('rgb(0,0,255)');
      expect(a.style('opacity')).to.equal(1);
      expect(a.style('label')).to.equal('Node A');
      expect(a.style('font-size')).to.equal(12);
      expect(a.style('color')).to.equal('rgb(51,51,51)');
    });

    it('reads edge props', function () {
      var ab = cy.$id('ab');

      expect(ab.style('line-color')).to.equal('rgb(10,20,30)');
      expect(ab.style('width')).to.equal(3);
      expect(ab.style('opacity')).to.equal(0.5);
      expect(ab.style('source-arrow-shape')).to.equal('none');
      expect(ab.style('target-arrow-shape')).to.equal('triangle');
    });

    it('accepts camelCase names', function () {
      expect(cy.$id('a').style('backgroundColor')).to.equal('rgb(255,0,0)');
      expect(cy.$id('ab').style('lineColor')).to.equal('rgb(10,20,30)');
    });

    it('returns all props of the group without a name', function () {
      var props = cy.$id('a').style();

      expect(props).to.be.an('object');
      expect(props['background-color']).to.equal('rgb(255,0,0)');
      expect(props.width).to.equal(40);
      expect(props).to.not.have.property('line-color');

      var eprops = cy.$id('ab').style();

      expect(eprops['line-color']).to.equal('rgb(10,20,30)');
      expect(eprops).to.not.have.property('background-color');
    });

    it('reads label channels off the sheet when the node has no label', function () {
      var b = cy.$id('b');

      expect(b.style('label')).to.equal(''); // data(name) with no name
      expect(b.style('font-size')).to.equal(12);
      expect(b.style('color')).to.equal('rgb(51,51,51)');
    });

    it('reports the stored channels for mapped sheets', function () {
      cy.style({
        nodes: {
          backgroundColor: {
            case: [{ when: { data: 'id', eq: 'a' }, then: '#0ff' }],
            else: '#999',
          },
          width: {
            case: [{ when: { data: 'id', eq: 'a' }, then: 11 }],
            else: 30,
          },
        },
      });

      expect(cy.$id('a').style('background-color')).to.equal('rgb(0,255,255)');
      expect(cy.$id('a').style('width')).to.equal(11);
      expect(cy.$id('b').style('width')).to.equal(30);
    });

    it('returns undefined for props of the other group', function () {
      expect(cy.$id('a').style('line-color')).to.be.undefined;
      expect(cy.$id('ab').style('background-color')).to.be.undefined;
    });

    it('throws on unknown props', function () {
      expect(function () {
        cy.$id('a').style('bogus-prop');
      }).to.throw();
    });

    it('throws on the bypass (setter) forms', function () {
      expect(function () {
        cy.$id('a').style('width', 99);
      }).to.throw(/bypass/);
      expect(function () {
        cy.$id('a').style({ width: 99 });
      }).to.throw(/bypass/);
    });

    it('returns undefined for empty and removed elements', function () {
      expect(cy.collection().style('width')).to.be.undefined;

      var a = cy.$id('a');

      a.remove();

      expect(a.style('width')).to.be.undefined;
      expect(a.style()).to.be.undefined;
    });

    it('is aliased as css()', function () {
      expect(cy.$id('a').css('width')).to.equal(40);
    });
  });

  describe('renderedStyle()', function () {
    it('scales length props by the zoom', function () {
      cy.zoom(2);

      var a = cy.$id('a');

      expect(a.renderedStyle('width')).to.equal(80);
      expect(a.renderedStyle('font-size')).to.equal(24);
      expect(a.renderedStyle('background-color')).to.equal('rgb(255,0,0)'); // colors unscaled
      expect(a.renderedStyle('opacity')).to.equal(1); // unitless props unscaled

      var props = a.renderedStyle();

      expect(props.width).to.equal(80);
      expect(props.height).to.equal(40);
    });
  });

  describe('numericStyle()', function () {
    it('returns numbers for numeric props', function () {
      expect(cy.$id('a').numericStyle('width')).to.equal(40);
      expect(cy.$id('ab').numericStyle('opacity')).to.equal(0.5);
    });

    it('throws for non-numeric props', function () {
      expect(function () {
        cy.$id('a').numericStyle('background-color');
      }).to.throw(/not numeric/);
    });
  });

  describe('derived getters', function () {
    it('effectiveOpacity() and transparent()', function () {
      expect(cy.$id('a').effectiveOpacity()).to.equal(1);
      expect(cy.$id('a').transparent()).to.be.false;
      expect(cy.$id('ab').effectiveOpacity()).to.equal(0.5);

      cy.style({ nodes: { opacity: 0 } });

      expect(cy.$id('a').effectiveOpacity()).to.equal(0);
      expect(cy.$id('a').transparent()).to.be.true;
    });

    it('takesUpSpace() and interactive() follow visibility', function () {
      var a = cy.$id('a');

      expect(a.takesUpSpace()).to.be.true;
      expect(a.interactive()).to.be.true;

      a.hide();

      expect(a.takesUpSpace()).to.be.false;
      expect(a.interactive()).to.be.false;
    });
  });
  // Round 34.5: normalizeProp is memoized, so the camelCase and
  // kebab-case spellings of a prop must keep answering identically, a
  // second read must not be served a stale entry, and an unknown name
  // must still throw *after* being normalized.
  describe('the normalization cache (34.5)', function () {
    it('answers both spellings of the same prop identically', function () {
      const n = cy.$id('a');

      expect(n.style('backgroundColor')).to.equal(n.style('background-color'));
      expect(n.style('borderWidth')).to.equal(n.style('border-width'));

      // and repeated reads (the cached path) agree with the first
      expect(n.style('backgroundColor')).to.equal(n.style('backgroundColor'));
    });

    it('reads the new value after a restyle, through both spellings', function () {
      const n = cy.$id('a');

      cy.style({ nodes: { 'background-color': '#010203' } });

      expect(n.style('background-color')).to.equal('rgb(1,2,3)');
      expect(n.style('backgroundColor')).to.equal('rgb(1,2,3)');
    });

    it('still throws on an unknown property, in either spelling', function () {
      const n = cy.$id('a');

      expect(() => n.style('notAProp')).to.throw(/unsupported/);
      expect(() => n.style('not-a-prop')).to.throw(/unsupported/);
      // twice, so a cached normalization cannot turn the second into a
      // silent success
      expect(() => n.style('notAProp')).to.throw(/unsupported/);
    });
  });
});
