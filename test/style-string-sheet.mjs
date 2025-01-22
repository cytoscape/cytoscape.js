const expect = require('chai').expect;
const cytoscape = require('../src/test.js');

describe('String-sheet parsing', function(){
  let cy;
  let consoleWarn;

  this.beforeAll(function() {
    consoleWarn = console.warn;
    console.warn = function() {};
  });

  this.afterAll(function() {
    console.warn = consoleWarn;
  });

  beforeEach(function() {
    cy = cytoscape({
      styleEnabled: true,
      elements: {
        nodes: [
            { data: { id: 'n1' } },
        ],
      },
    });
  });

  afterEach(function(){
    cy.destroy();
  });

  [
    '#n1 { color: rgb(1,1,1); background-color: rgb(1,1,1); }',
    '#n1 { color: rgb(1,1,1); background-color: rgb(1,1,1) }',
    '#n1 {color: rgb(1,1,1);background-color: rgb(1,1,1);}',
    `#n1 {color: rgb(1,1,1);
      background-color: rgb(1,1,1);}`,
  ]
  .forEach((stringSheet) => {
    it('style block applied when parsed with no validity errors', function(){
      let style = cy.$('#n1').style();
      expect( style ).to.have.property('color');
      expect( style['color'] ).to.exist;
      expect( style['color'] ).not.to.equal('rgb(1,1,1)');
      expect( style ).to.have.property('background-color');
      expect( style['background-color'] ).to.exist;
      expect( style['background-color'] ).not.to.equal('rgb(1,1,1)');
  
      cy.style().fromString(stringSheet);
  
      style = cy.$('#n1').style();
      expect( style['color'] ).to.equal('rgb(1,1,1)');
      expect( style['background-color'] ).to.equal('rgb(1,1,1)');
    });
  });

  [
    '#n1 { color: rgb(1,1,1) }',
    '#n1 { color: rgb(1,1,1); }',
  ]
  .forEach((stringSheet) => {
    it('style block with one property applied when parsed with no validity errors', function(){
      let style = cy.$('#n1').style();
      expect( style ).to.have.property('color');
      expect( style['color'] ).to.exist;
      expect( style['color'] ).not.to.equal('rgb(1,1,1)');


      cy.style().fromString(stringSheet);

      style = cy.$('#n1').style();
      expect( style['color'] ).to.equal('rgb(1,1,1)');
    });
  });

  [
    '#n1 { color: rgb(1,1,1) background-color: rgb(1,1,1) }',
    '#n1 { color: rgb(1,1,1) background-color: rgb(1,1,1); }',
    `#n1 {color: rgb(1,1,1)
      background-color: rgb(1,1,1);}`,
  ]
  .forEach((stringSheet) => {
    it('style block ignored when parsed with validity error', function(){
      let style = cy.$('#n1').style();
      expect( style ).to.have.property('color');
      expect( style['color'] ).to.exist;
      expect( style['color'] ).not.to.equal('rgb(1,1,1)');
      expect( style ).to.have.property('background-color');
      expect( style['background-color'] ).to.exist;
      expect( style['background-color'] ).not.to.equal('rgb(1,1,1)');

      cy.style().fromString(stringSheet);

      style = cy.$('#n1').style();
      expect( style['color'] ).not.to.equal('rgb(1,1,1)');
      expect( style['background-color'] ).not.to.equal('rgb(1,1,1)');
    });
  });

});
