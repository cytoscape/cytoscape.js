import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { wheelAction } from '../src/interact/pointer-handlers.mjs';

// Round 20.1: the interaction option quartet — core ctor options with
// validated getter/setters (the multiClickDebounceTime pattern), read
// live by the pointer layer.  Defaults are v3's.
describe('gpu/core: interaction options (round 20.1)', function () {
  it('wheelSensitivity is a validated getter/setter with a ctor option', function () {
    var cy = cytoscape({});

    expect(cy.wheelSensitivity()).to.equal(1); // v3's default
    expect(cy.wheelSensitivity(2)).to.equal(cy);
    expect(cy.wheelSensitivity()).to.equal(2);
    expect(() => cy.wheelSensitivity(0)).to.throw(); // must be > 0
    expect(() => cy.wheelSensitivity(-1)).to.throw();
    expect(() => cy.wheelSensitivity(NaN)).to.throw();
    expect(() => cy.wheelSensitivity('fast')).to.throw();

    var cy2 = cytoscape({ wheelSensitivity: 0.5 });

    expect(cy2.wheelSensitivity()).to.equal(0.5);
  });

  it('a custom wheelSensitivity warns once per instance (v3 behavior)', function () {
    var warnings = [];
    var origWarn = console.warn;

    console.warn = (msg) => warnings.push(String(msg));

    try {
      var cy = cytoscape({ wheelSensitivity: 3 });

      expect(
        warnings.filter((w) => w.includes('wheel sensitivity')).length,
      ).to.equal(1);

      cy.wheelSensitivity(4); // still the same instance: no second warning

      expect(
        warnings.filter((w) => w.includes('wheel sensitivity')).length,
      ).to.equal(1);

      var defaulted = cytoscape({});

      defaulted.wheelSensitivity(2); // setter warns too, once

      expect(
        warnings.filter((w) => w.includes('wheel sensitivity')).length,
      ).to.equal(2);

      cytoscape({}); // the default never warns
      cytoscape({ wheelSensitivity: 1 }); // explicit default: no warning

      expect(
        warnings.filter((w) => w.includes('wheel sensitivity')).length,
      ).to.equal(2);
    } finally {
      console.warn = origWarn;
    }
  });

  it('desktopTapThreshold and touchTapThreshold are validated getter/setters with ctor options', function () {
    var cy = cytoscape({});

    expect(cy.desktopTapThreshold()).to.equal(4); // v3's defaults
    expect(cy.touchTapThreshold()).to.equal(8);

    expect(cy.desktopTapThreshold(10)).to.equal(cy);
    expect(cy.desktopTapThreshold()).to.equal(10);
    expect(cy.touchTapThreshold(12)).to.equal(cy);
    expect(cy.touchTapThreshold()).to.equal(12);

    expect(() => cy.desktopTapThreshold(-1)).to.throw();
    expect(() => cy.touchTapThreshold(-1)).to.throw();
    expect(() => cy.desktopTapThreshold(NaN)).to.throw();
    expect(() => cy.touchTapThreshold('big')).to.throw();

    expect(cy.desktopTapThreshold(0)).to.equal(cy); // zero is valid (every press drags)
    expect(cy.desktopTapThreshold()).to.equal(0);

    var cy2 = cytoscape({ desktopTapThreshold: 2, touchTapThreshold: 16 });

    expect(cy2.desktopTapThreshold()).to.equal(2);
    expect(cy2.touchTapThreshold()).to.equal(16);
  });

  it('tapholdDuration is a validated getter/setter with a ctor option', function () {
    var cy = cytoscape({});

    expect(cy.tapholdDuration()).to.equal(500); // v3's (hardcoded) duration

    expect(cy.tapholdDuration(200)).to.equal(cy);
    expect(cy.tapholdDuration()).to.equal(200);

    expect(() => cy.tapholdDuration(-1)).to.throw();
    expect(() => cy.tapholdDuration(NaN)).to.throw();
    expect(() => cy.tapholdDuration('long')).to.throw();

    var cy2 = cytoscape({ tapholdDuration: 750 });

    expect(cy2.tapholdDuration()).to.equal(750);
  });
});

// Round 75.5: wheelBehavior, and the decision the wheel handler takes from
// it.  wheelAction is what decides preventDefault — null means the event
// is left to the page — so the toggle rows here are the Node half of the
// "a zoom-disabled canvas lets the page scroll" fix; the browser half is
// in renderer.spec.js.  Control: swapping the 'pan' and 'modifier-zoom'
// branches fails the mode table.
describe('gpu/core: wheelBehavior (round 75.5)', function () {
  it('is a validated getter/setter with a ctor option, default zoom', function () {
    var cy = cytoscape();

    expect(cy.wheelBehavior()).to.equal('zoom');
    expect(cy.wheelBehavior('pan')).to.equal(cy);
    expect(cy.wheelBehavior()).to.equal('pan');
    expect(cy.wheelBehavior('modifier-zoom').wheelBehavior()).to.equal(
      'modifier-zoom',
    );
    expect(() => cy.wheelBehavior('ctrl-zoom')).to.throw(
      /Invalid wheel behavior 'ctrl-zoom'/,
    );
    expect(cy.wheelBehavior()).to.equal('modifier-zoom'); // unchanged by the throw

    expect(cytoscape({ wheelBehavior: 'pan' }).wheelBehavior()).to.equal('pan');
    expect(() => cytoscape({ wheelBehavior: 'scroll' })).to.throw(
      /Invalid wheel behavior/,
    );
  });

  it('a clone carries it', function () {
    var cy = cytoscape({ wheelBehavior: 'modifier-zoom' });

    expect(cy.clone().wheelBehavior()).to.equal('modifier-zoom');
  });

  var plain = { ctrlKey: false, metaKey: false };
  var ctrl = { ctrlKey: true, metaKey: false };
  var meta = { ctrlKey: false, metaKey: true };

  it('maps each mode and modifier to an action', function () {
    var cy = cytoscape();
    var table = {};

    for (var mode of ['zoom', 'pan', 'modifier-zoom']) {
      cy.wheelBehavior(mode);
      table[mode] = [plain, ctrl, meta].map((e) => wheelAction(cy, e));
    }

    expect(table).to.deep.equal({
      zoom: ['zoom', 'zoom', 'zoom'],
      pan: ['pan', 'zoom', 'zoom'], // the pinch (ctrl+wheel) still zooms
      'modifier-zoom': [null, 'zoom', 'zoom'], // the plain wheel is the page's
    });
  });

  it('leaves the wheel to the page when the toggles refuse the action', function () {
    var cy = cytoscape();

    cy.userZoomingEnabled(false);
    expect(wheelAction(cy, plain)).to.equal(null);
    cy.userZoomingEnabled(true).zoomingEnabled(false);
    expect(wheelAction(cy, plain)).to.equal(null);
    cy.zoomingEnabled(true);
    expect(wheelAction(cy, plain)).to.equal('zoom');

    cy.wheelBehavior('pan').userPanningEnabled(false);
    expect(wheelAction(cy, plain)).to.equal(null);
    expect(wheelAction(cy, ctrl)).to.equal('zoom'); // zooming still allowed
    cy.userPanningEnabled(true).panningEnabled(false);
    expect(wheelAction(cy, plain)).to.equal(null);
    cy.panningEnabled(true);
    expect(wheelAction(cy, plain)).to.equal('pan');
  });
});
