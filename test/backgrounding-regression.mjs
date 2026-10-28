import { expect } from 'chai';
import cytoscape from '../src/test.mjs';




describe('Regression test for background-image style flips',function(){
    var cy;

    beforeEach(function(done){
        cytoscape({
            container: null, 
            headless: true,
            
            elements:{
                nodes:[
                    { data: { id:'n1' } },// node with background image
                    { data: { id: 'n2' } }
                ]
            },

            style: [
                {
                    selector: 'node',
                    style: {
                        'background-opacity':0.5
                    }
                }
            ],
            ready: function(){
                cy= this;
                done();
            }
        });
    
        });

        afterEach(function(){
            if(cy){cy.destroy();}
        });

        it('does not trigger backgrounding style update when no background image URL is defined', function(){
            var n1 = cy.$('#n1');

            cy.forceRender();

            expect(n1.hasClass('backgrounding')).to.be.false;

        });

});

