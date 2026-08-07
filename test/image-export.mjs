import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/core: image export', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'e1', source: 'n1', target: 'n2' } },
      ],
    });
  });

  var rejectionOf = async function (promise) {
    try {
      await promise;
    } catch (err) {
      return err;
    }

    throw new Error('expected the promise to reject');
  };

  it('png() rejects when headless', async function () {
    var err = await rejectionOf(cy.png());

    expect(err.message).to.contain('headless');
  });

  it('jpg() rejects when headless', async function () {
    var err = await rejectionOf(cy.jpg());

    expect(err.message).to.contain('headless');
  });

  it('jpeg is an alias of jpg', function () {
    expect(cy.jpeg).to.equal(cy.jpg);
  });

  it('rejects an invalid output form before rendering', async function () {
    var err = await rejectionOf(cy.png({ output: 'base65' }));

    expect(err.message).to.contain("Invalid image export output 'base65'");
  });
});
