import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

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
