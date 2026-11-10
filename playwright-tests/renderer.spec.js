import { test, expect } from '@playwright/test';

const copy = obj => JSON.parse(JSON.stringify(obj));

const delay = async ms => new Promise(resolve => setTimeout(resolve, ms));

const expectUniquePoints = pts => {
  const toStringPt = pt => `(${pt.x},${pt.y})`;
  const toStringPts = pts => pts.map(toStringPt).join(' ');

  const str = toStringPts(pts);
  const strUnique = Array.from(new Set(pts.map(toStringPt))).join(' ');

  expect(str).toBe(strUnique);
};

const dist = (pt1, pt2) => Math.sqrt((pt1.x - pt2.x) ** 2 + (pt1.y - pt2.y) ** 2);

test.describe('Renderer', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[browser] ${msg.text()}`));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:3333/playwright-page/index.html');
  });

  test('starts with no nodes', async ({ page }) => {
    const numNodes = await page.evaluate(() => {
      const cy = window.cy;

      return cy.nodes().length;
    });

    expect(numNodes).toBe(0);
  });

  test('adds a node', async ({ page }) => {
    const numNodes = await page.evaluate(() => {
      const cy = window.cy;

      cy.add({
        data: { id: 'foo' }
      });

      return cy.nodes().length;
    });

    expect(numNodes).toBe(1);
  });

  test.describe('image export', () => {
    for( const [name, options] of [
      ['viewport', {}],
      ['scaled viewport', { scale: 1.5 }],
      ['full graph', { full: true, scale: 0.718394 }]
    ] ){
      test(`fills the entire ${name} PNG with an opaque background`, async ({ page }) => {
        const minimumAlpha = await page.evaluate(async options => {
          const cy = window.cy;
          const zoom = 0.718394;
          const pan = { x: 123456.7, y: -123456.7 };
          cy.add([
            { data: { id: 'a' }, position: { x: (100 - pan.x) / zoom, y: (100 - pan.y) / zoom } },
            { data: { id: 'b' }, position: { x: (240 - pan.x) / zoom, y: (200 - pan.y) / zoom } }
          ]);
          cy.zoom(zoom);
          cy.pan(pan);

          const image = new Image();
          image.src = cy.png({ ...options, bg: '#ffffff' });
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          let minimum = 255;

          for( let i = 3; i < data.length; i += 4 ){
            minimum = Math.min(minimum, data[i]);
          }

          return minimum;
        }, options);

        expect(minimumAlpha).toBe(255);
      });
    }

    for( const format of ['png', 'jpg'] ){
      test(`fills the ${format} background under a translucent triangle-cross arrow`, async ({ page }) => {
        const maxDifference = await page.evaluate(async format => {
          const cy = window.cy;
          cy.add([
            { data: { id: 'a' }, position: { x: 450, y: 300 } },
            { data: { id: 'b' }, position: { x: 200, y: 150 } },
            { data: { id: 'ab', source: 'a', target: 'b' } }
          ]);
          // triangle-cross arrows are drawn without Path2D, so their path stays on the context
          cy.edges().style({
            'curve-style': 'straight',
            'target-arrow-shape': 'triangle-cross',
            'arrow-scale': 6,
            width: 6,
            opacity: 0.4
          });

          const getPixels = async src => {
            const image = new Image();
            image.src = src;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            return context.getImageData(0, 0, canvas.width, canvas.height).data;
          };

          // the transparent export over a white background is what the export with a white bg should look like
          const transparent = await getPixels(cy.png());
          const actual = await getPixels(cy[format]({ bg: '#ffffff', quality: 1 }));
          let max = 0;

          for( let i = 0; i < transparent.length; i += 4 ){
            const alpha = transparent[i + 3] / 255;

            for( let j = 0; j < 3; j++ ){
              const expected = transparent[i + j] * alpha + 255 * (1 - alpha);
              max = Math.max(max, Math.abs(actual[i + j] - expected));
            }

            max = Math.max(max, 255 - actual[i + 3]);
          }

          return max;
        }, format);

        expect(maxDifference).toBeLessThan(16);
      });
    }
  });

  test.describe('backgrounding', () => {
    for( const explicitNone of [false, true] ){
      for( const containment of ['inside', 'over'] ){
        const background = explicitNone ? 'explicit none' : 'default';

        test(`nodes without images do not restyle on draw (${background}, ${containment})`, async ({ page }) => {
          const result = await page.evaluate(async ({ explicitNone, containment }) => {
            const cy = window.cy;
            const style = { 'background-image-containment': containment };

            if( explicitNone ){
              style['background-image'] = 'none';
            }

            cy.style().selector('node').style(style).update();

            const firstRender = cy.promiseOn('render');
            cy.add([
              { data: { id: 'parent' } },
              { data: { id: 'child', parent: 'parent' }, position: { x: 100, y: 100 } },
              { data: { id: 'standalone' }, position: { x: 300, y: 100 } }
            ]);
            await firstRender;

            const styleChanges = [];
            const backgrounding = [];
            const recordBackgrounding = () => {
              backgrounding.push(cy.nodes(':backgrounding').map(node => node.id()));
            };

            cy.on('style', 'node', event => {
              styleChanges.push({ id: event.target.id(), backgrounding: event.target.backgrounding() });
            });

            recordBackgrounding();

            // Compound parents bypass the texture cache and draw on each pan.
            // Await rendered frames so this cannot pass without drawing them.
            for( let i = 0; i < 5; i++ ){
              const rendered = cy.promiseOn('render');
              cy.panBy({ x: 1, y: 0 });
              await rendered;
              recordBackgrounding();
            }

            // Export also draws the leaves directly, rather than reusing textures.
            const png = cy.png({ full: true });
            recordBackgrounding();

            return { styleChanges, backgrounding, png };
          }, { explicitNone, containment });

          expect(result.png).toMatch(/^data:image\/png;base64,/);
          expect(result.backgrounding).toEqual(Array.from({ length: 7 }, () => []));
          expect(result.styleChanges).toEqual([]);
        });
      }
    }
  });

  test.describe('node style', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        const cy = window.cy;

        cy.add({ data: { id: 'a' } });

      });
    }); // beforeEach

    test('node bounding box extends beyond width and height for bordered triangle', async ({ page }) => {
      const bb = await page.evaluate(() => {
        const cy = window.cy;

        cy.style().fromJson([
          {
            selector: 'node',
            style: {
              'shape': 'triangle',
              'width': 100,
              'height': 100,
              'border-width': 10,
              'border-color': 'black',
            }
          }
        ]).update();

        return cy.$('#a').boundingBox();
      });

      expect(bb.w).toBeGreaterThan(105);
      expect(bb.h).toBeGreaterThan(105);
    } ); // node bounding box extends beyond width and height for triangle

    test('boundingBox() does not throw for polygon node with border and edge', async ({ page }) => {
      const bb = await page.evaluate(() => {
        const cy = window.cy;

        cy.add([
          {
            data: { id: 'p' },
            position: { x: 100, y: 100 }
          },
          {
            data: { id: 'q' },
            position: { x: 200, y: 200 }
          },
          {
            data: { id: 'pq', source: 'p', target: 'q' }
          }
        ]);

        cy.style().fromJson([
          {
            selector: '#p',
            style: {
              'shape': 'polygon',
              'shape-polygon-points': '-1 -1 1 -1 1 1 -1 1',
              'width': 50,
              'height': 50,
              'border-width': 5,
              'border-color': 'black',
            }
          }
        ]).update();

        return cy.$('#p').boundingBox();
      });

      expect(bb.w).toBeGreaterThan(0);
      expect(bb.h).toBeGreaterThan(0);
      expect(bb.x1).toBeDefined();
      expect(bb.x2).toBeDefined();
      expect(bb.y1).toBeDefined();
      expect(bb.y2).toBeDefined();
    }); // boundingBox() does not throw for polygon node with border and edge

    test('polygon node bounding box extends beyond width and height for border', async ({ page }) => {
      const bb = await page.evaluate(() => {
        const cy = window.cy;

        cy.style().fromJson([
          {
            selector: 'node',
            style: {
              'shape': 'polygon',
              'shape-polygon-points': '-1 -1 1 -1 1 1 -1 1',
              'width': 100,
              'height': 100,
              'border-width': 10,
              'border-color': 'black',
            }
          }
        ]).update();

        return cy.$('#a').boundingBox();
      });

      expect(bb.w).toBeGreaterThan(105);
      expect(bb.h).toBeGreaterThan(105);
    }); // polygon node bounding box extends beyond width and height for border

  });

  test.describe('straight edges', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        const cy = window.cy;
  
        cy.style().fromJson([
          {
            selector: 'edge',
            style: {
              'curve-style': 'straight'
            }
          }
        ]).update();
  
        cy.add([
          {
            data: { id: 'a' },
            position: { x: 0, y: 0 }
          },
          {
            data: { id: 'b' },
            position: { x: 0, y: 0 }
          },
          {
            data: { id: 'ab1', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab2', source: 'a', target: 'b' }
          }
        ]);
      });
    }); // beforeEach

    test('initial bounding box is zero', async ({ page }) => {
      let bb1 = await page.evaluate(() => cy.$('#ab1').boundingBox());
      let bb2 = await page.evaluate(() => cy.$('#ab2').boundingBox());

      expect(bb1.w).toEqual(0);
      expect(bb1.h).toEqual(0);

      expect(bb2.w).toEqual(0);
      expect(bb2.h).toEqual(0);
    }); // initial bounding box is zero

    test('moved bounding box is nonzero', async ({ page }) => {
      await delay(500);

      await page.evaluate(() => {
        cy.layout({ name: 'grid', rows: 1, cols: 2 }).run();
      });

      await delay(500);

      let bb1 = await page.evaluate(() => cy.$('#ab1').boundingBox());
      let bb2 = await page.evaluate(() => cy.$('#ab2').boundingBox());

      expect(bb1.w).not.toEqual(0);
      expect(bb1.h).not.toEqual(0);

      expect(bb2.w).not.toEqual(0);
      expect(bb2.h).not.toEqual(0);
    }); // initial bounding box is nonzero

    test('manual endpoints correct', async ({ page }) => {
      // Set the endpoints manually
      const {
        ab1Source, ab1Target, ab2Source, ab2Target,
        ab1Midpoint, ab2Midpoint
      } = await page.evaluate(() => {
        const cy = window.cy;

        cy.$('#1').position({ x: 0, y: 0 });
        cy.$('#b').position({ x: 100, y: 0 });

        // Set the endpoints for the fist edge via style
        cy.$('#ab1').style('source-endpoint', '10px 10px');
        cy.$('#ab1').style('target-endpoint', '20px 10px');

        // Set the endpoints for the second edge via style
        cy.$('#ab2').style('source-endpoint', '30px 20px');
        cy.$('#ab2').style('target-endpoint', '40px 20px');

        // Return the endpoints for verification
        return {
          ab1Source: cy.$('#ab1').sourceEndpoint(),
          ab1Target: cy.$('#ab1').targetEndpoint(),
          ab2Source: cy.$('#ab2').sourceEndpoint(),
          ab2Target: cy.$('#ab2').targetEndpoint(),
          ab1Midpoint: cy.$('#ab1').midpoint(),
          ab2Midpoint: cy.$('#ab2').midpoint()
        };
      });

      // Verify the endpoints
      expect(ab1Source.x).toBe(10);
      expect(ab1Source.y).toBe(10);
      expect(ab1Target.x).toBe(20 + 100);
      expect(ab1Target.y).toBe(10);
      expect(ab2Source.x).toBe(30);
      expect(ab2Source.y).toBe(20);
      expect(ab2Target.x).toBe(40 + 100);
      expect(ab2Target.y).toBe(20);

      // Verify the midpoint y values only
      expect(ab1Midpoint.y).toEqual(10);
      expect(ab2Midpoint.y).toEqual(20);
    }); // manual endpoints correct
  });

  test.describe('bundled beziers', () => {
    const stepSize = 40;
    let ctrlpts1;
    let pt_ab1_1, pt_ab2_1;

    test.beforeEach(async ({ page }) => {
      ctrlpts1 = await page.evaluate(() => {
        const cy = window.cy;
  
        cy.style().fromJson([
          {
            selector: 'edge',
            style: {
              'curve-style': 'bezier',
              'control-point-step-size': 40
            }
          }
        ]).update();
  
        cy.add([
          {
            data: { id: 'a' }
          },
          {
            data: { id: 'b' }
          },
          {
            data: { id: 'ab1', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab2', source: 'a', target: 'b' }
          }
        ]);
  
        cy.layout({ name: 'grid', rows: 1, cols: 2 }).run();
  
        return cy.edges().map(edge => edge.controlPoints()[0]);
      });

      pt_ab1_1 = await page.evaluate(() => {
        return window.cy.$('#ab1').controlPoints()[0];
      });
  
      pt_ab2_1 = await page.evaluate(() => {
        return window.cy.$('#ab2').controlPoints()[0];
      });
    }); // beforeEach

    test('move when adding to the bundle', async ({ page }) => {
      expect(ctrlpts1.length).toBe(2);
      expectUniquePoints(ctrlpts1);
  
      // distance between the two control points
      let d_1_01 = dist(ctrlpts1[0], ctrlpts1[1]);
  
      expect(d_1_01).toBe(stepSize);
  
      let ctrlpts2 = await page.evaluate(() => {
        const cy = window.cy;
  
        cy.add([
          {
            data: { id: 'ab3', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab4', source: 'a', target: 'b' }
          }
        ]);
  
        return cy.edges().map(edge => edge.controlPoints()[0]);
      });
  
      // console.log(ctrlpts2);
  
      expect(ctrlpts2.length).toBe(4);
      expectUniquePoints(ctrlpts2);
  
      let d_2_01 = dist(ctrlpts2[0], ctrlpts2[1]);
      let d_2_12 = dist(ctrlpts2[1], ctrlpts2[2]);
      let d_2_23 = dist(ctrlpts2[2], ctrlpts2[3]);
  
      expect(d_2_01).toBeCloseTo(stepSize);
      expect(d_2_12).toBeCloseTo(stepSize);
      expect(d_2_23).toBeCloseTo(stepSize);
  
      let pt_ab1_2 = await page.evaluate(() => {
        return window.cy.$('#ab1').controlPoints()[0];
      });
  
      let pt_ab2_2 = await page.evaluate(() => {
        return window.cy.$('#ab2').controlPoints()[0];
      });
  
      // ctrl pts for ab1 and ab2 should have changed
      expect(pt_ab1_1).not.toEqual(pt_ab1_2);
      expect(pt_ab2_1).not.toEqual(pt_ab2_2);
    }); // move when adding to the bundle

    test('move when removing from the bundle', async ({ page }) => {
      await page.evaluate(() => {
        const cy = window.cy;
  
        cy.add([
          {
            data: { id: 'ab3', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab4', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab5', source: 'a', target: 'b' }
          }
        ]);
      });

      let pt_ab1_2 = await page.evaluate(() => cy.$('#ab1').controlPoints()[0]);
      let pt_ab2_2 = await page.evaluate(() => cy.$('#ab2').controlPoints()[0]);

      let ctrlpts3 = await page.evaluate(() => {
        const cy = window.cy;

        cy.$('#ab3').remove(); // only ab1,2,4,5 left

        return cy.edges().map(edge => edge.controlPoints()[0]);
      });

      let pt_ab1_3 = await page.evaluate(() => cy.$('#ab1').controlPoints()[0]);
      let pt_ab2_3 = await page.evaluate(() => cy.$('#ab2').controlPoints()[0]);

      expectUniquePoints(ctrlpts3);

      expect(pt_ab1_2).not.toEqual(pt_ab1_3);
      expect(pt_ab2_2).not.toEqual(pt_ab2_3);

      let d_3_01 = dist(ctrlpts3[0], ctrlpts3[1]);
      let d_3_12 = dist(ctrlpts3[1], ctrlpts3[2]);
      let d_3_23 = dist(ctrlpts3[2], ctrlpts3[3]);
  
      expect(d_3_01).toBeCloseTo(stepSize);
      expect(d_3_12).toBeCloseTo(stepSize);
      expect(d_3_23).toBeCloseTo(stepSize);
    }); // move when removing from the bundle

    test('do not move when setting one edge to visibility:hidden', async ({ page }) => {
      await page.evaluate(() => {
        window.cy.$('#ab1').style('visibility', 'hidden');
      });

      let pt_ab1_2 = await page.evaluate(() => cy.$('#ab1').controlPoints()[0]);
      let pt_ab2_2 = await page.evaluate(() => cy.$('#ab2').controlPoints()[0]);

      expect(pt_ab1_1).toEqual(pt_ab1_2);
      expect(pt_ab2_1).toEqual(pt_ab2_2);
    }); // do not move when setting one edge to visibility:hidden

    test('move when setting one edge to display:none', async ({ page }) => {
      await page.evaluate(() => {
        window.cy.$('#ab1').style('display', 'none');
      });

      let pt_ab1_2 = await page.evaluate(() => cy.$('#ab1').controlPoints());
      let pt_ab2_2 = await page.evaluate(() => cy.$('#ab2').controlPoints());

      expect(pt_ab1_2).toBeUndefined(); // because display: none
      expect(pt_ab2_2).toBeUndefined(); // because only one edge left => straight
    }); // move when setting one edge to display:none

    test('move when setting one edge to display:none (bigger bundle)', async ({ page }) => {
      await page.evaluate(() => {
        window.cy.add([
          {
            data: { id: 'ab3', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab4', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab5', source: 'a', target: 'b' }
          }
        ]);

        cy.$('#ab1').style('display', 'none');
      });

      let pt_ab1_2 = await page.evaluate(() => cy.$('#ab1').controlPoints());
      let pt_ab2_2 = await page.evaluate(() => cy.$('#ab2').controlPoints()[0]);

      expect(pt_ab1_2).toBeUndefined(); // because display: none
      expect(pt_ab2_2).toBeDefined();
      
    }); // move when setting one edge to display:none

    test('move when setting one edge to curve-style:straight', async ({ page }) => {
      await page.evaluate(() => {
        window.cy.add([
          {
            data: { id: 'ab3', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab4', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab5', source: 'a', target: 'b' }
          }
        ]);

        cy.$('#ab1').style('curve-style', 'straight');
      });

      let pt_ab1_2 = await page.evaluate(() => window.cy.$('#ab1').controlPoints());
      let pt_ab2_2 = await page.evaluate(() => window.cy.$('#ab2').controlPoints()[0]);

      expect(pt_ab1_2).toBeUndefined(); // because curve-style:straight
      expect(pt_ab2_2).toBeDefined();
      
    }); // move when setting one edge to curve-style:straight

    test('diagonal bottom left to top right', async ({page}) => {
      let controlPoints = await page.evaluate(() => {
        const cy = window.cy;
        cy.style().fromJson([{
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'control-point-step-size': Math.sqrt(200)
          }
        }]).update();
        cy.add([{
          data: {id: 'a'}
        }, {
          data: {id: 'b'}
        }, {
          data: {id: 'ab1', source: 'a', target: 'b'}
        }, {
          data: {id: 'ab2', source: 'a', target: 'b'}
        }]);
        var presetOptions = {
          name: 'preset',
          positions: {
            a: {x: 0, y: 100},
            b: {x: 100, y: 0}
          }
        };
        cy.layout(presetOptions).run();
        let pt_ab1_1 = cy.$('#ab1').controlPoints()[0];
        let pt_ab2_1 = cy.$('#ab2').controlPoints()[0];
        return [pt_ab1_1, pt_ab2_1]
      });
      // Step size 14.14, sqrt(10*10+10*10).
      // Gives a 5 pixel translation away from the mid-point,
      // if the vector between the nodes are at a 45 deg angle.
      // Mid-point is at (50,50)
      expect(controlPoints[0].x).toBeCloseTo(45, 5);
      expect(controlPoints[0].y).toBeCloseTo(45, 5);
      expect(controlPoints[1].x).toBeCloseTo(55, 5);
      expect(controlPoints[1].y).toBeCloseTo(55, 5);
    });

    // test('do not move when straight edge added', async ({ page }) => {
    //   await page.evaluate(() => {
    //     window.cy.add([
    //       {
    //         data: { id: 'ab3', source: 'a', target: 'b' },
    //         style: {
    //           'curve-style': 'straight'
    //         }
    //       }
    //     ]);
    //   });

    //   // TODO...
      
    // }); // move when setting one edge to curve-style:straight

  }); // bundled beziers

  test.describe('rounded-edges', () => {
    let singleBentEdge;
    let midCollinearEdge;

    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        const cy = window.cy;

        cy.style().fromJson([
          {
            selector: 'edge',
            style: {
              'curve-style': 'round-segments',
              'segment-radii': 50,
              'radius-type': 'influence-radius'
            }
          },
          {
            selector: '#ab1',
            style: {
              'segment-weights': [0.5],
              'segment-distances': [50]
            }
          },
          {
            selector: '#ab2',
            style: {
              'segment-weights': [0.25 , 0.5, 0.75],
              'segment-distances': [50, 50, 50]
            }
          }
        ]).update();

        cy.add([
          {
            data: { id: 'a' }
          },
          {
            data: { id: 'b' }
          },
          {
            data: { id: 'ab1', source: 'a', target: 'b' }
          },
          {
            data: { id: 'ab2', source: 'a', target: 'b' }
          },
        ]);

        cy.layout({ name: 'grid', rows: 1, cols: 2 }).run();

        singleBentEdge = cy.$('#ab1');
        midCollinearEdge = cy.$('#ab2');
      });

    }) // Before Each

    test('collinear mid point correctly defined', async ({page}) => {
      const midpoint = await page.evaluate(() => midCollinearEdge.midpoint());
      const points = await page.evaluate(() => midCollinearEdge.segmentPoints());

      expect(midpoint.x).not.toBeNaN();
      expect(midpoint.y).not.toBeNaN();
      expect(midpoint).toMatchObject(points[1])
    });

    test('mid point correctly defined', async ({page}) => {
      const {midpoint, points, a,b} = await page.evaluate(() => ({
        midpoint: singleBentEdge.midpoint(),
        points: singleBentEdge.segmentPoints(),
        a: singleBentEdge.source().position(),
        b: singleBentEdge.target().position(),
      }));



      expect(midpoint.x).not.toBeNaN();
      expect(midpoint.y).not.toBeNaN();
      const controlPoint = points[0];
      expect(midpoint).not.toMatchObject(controlPoint); // The mid point is supposed to be on the curve and not on the control point

      const isInsideTriangle = (point, {a,b,c}) => {
        const dX = point.x - a.x, dY = point.y - a.y;
        const dX21 = b.x - a.x, dY21 = b.y - a.y;
        const dX31 = c.x - a.x, dY31 = c.y - a.y;
        const denom = dY21 * dX31 - dX21 * dY31;
        const alpha = (dY21 * dX - dX21 * dY) / denom;
        const beta = (dX31 * dY - dY31 * dX) / denom;
        const gamma = 1 - alpha - beta;
        return alpha >= 0 && beta >= 0 && gamma >= 0;
      };
      // The actual midpoint should be within a triangle between the source, the target and the defined control point
      expect(isInsideTriangle(midpoint, {a,b,c: controlPoint})).toBeTruthy()

    })


  }); // Rounded edges

  for( const target of ['viewport', 'node'] ){
    test(`draws every frame during a ${target} animation (issue #3544)`, async ({ page }) => {
      const drawsPerFrame = await page.evaluate(async target => {
        const cy = window.cy;
        const node = cy.add({ data: { id: 'a' }, position: { x: 100, y: 100 } });
        const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
        const animated = target === 'viewport' ? cy : node;
        const properties = target === 'viewport'
          ? { zoom: 2, pan: { x: -100, y: -100 } }
          : { position: { x: 300, y: 300 } };
        let draws = 0;
        const onRender = () => draws++;

        cy.on('render', onRender);
        animated.animate(properties, { duration: 10000 });
        await frame();
        await frame(); // allow the animation to request its first draw

        const counts = [];
        for( let i = 0; i < 10; i++ ){
          draws = 0;
          await frame();
          counts.push(draws);
        }

        animated.stop(true);
        cy.off('render', onRender);
        return counts;
      }, target);

      expect(drawsPerFrame).toEqual(Array(10).fill(1));
    });
  }

  test.describe('with layout', () => {

    test('single node cose layout with bounding box', async ({ page }) => {
      const pos = await page.evaluate(async () => {
        const cy = window.cy;

        // remove all eles
        cy.elements().remove();

        // add one node
        let node = cy.add({ data: { id: 'a' } }); 

        // run layout
        let layout = cy.layout({
          name: 'cose',
          boundingBox: {
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 100
          },
        });

        let layoutstop = layout.promiseOn('layoutstop');

        layout.run();

        await layoutstop;

        return node.position();
      });
      
      expect(pos.x).not.toBeNaN();
      expect(pos.y).not.toBeNaN();

    }); // single node cose layout

  }); // with layout

  test.describe('spatial queries', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        const cy = window.cy;

        cy.elements().remove();

        cy.style().fromJson([
          {
            selector: 'node',
            style: { 'width': 50, 'height': 50 }
          }
        ]).update();

        cy.add([
          { data: { id: 'a' }, position: { x: 100, y: 100 } },
          { data: { id: 'b' }, position: { x: 300, y: 100 } },
          { data: { id: 'ab', source: 'a', target: 'b' } }
        ]);
      });
    });

    test('hit() finds a rotated label shifted by text-margin, not the unmargined position', async ({ page }) => {
      const result = await page.evaluate(() => {
        const cy = window.cy;

        cy.elements().remove();

        cy.style().fromJson([
          {
            selector: 'node',
            style: {
              'width': 10,
              'height': 10,
              'label': 'data(id)',
              'text-halign': 'center',
              'text-valign': 'center',
              'text-margin-x': 30,
              'text-rotation': '180deg',
              'text-events': 'yes'
            }
          }
        ]).update();

        cy.add({ data: { id: 'e' }, position: { x: 100, y: 100 } });

        // the label sits 30px right of the node at 0deg; at 180deg the
        // margin shift stays flat (not rotated), so it should still be
        // found 30px to the right of the node, not back at the node's
        // own (unmargined) position
        return {
          atMargin: cy.$('#e').hit({ x: 130, y: 100 }, { includeBody: false }).map(ele => ele.id()),
          atUnmarginedPivot: cy.$('#e').hit({ x: 100, y: 100 }, { includeBody: false }).map(ele => ele.id())
        };
      });

      expect(result.atMargin).toEqual(['e']);
      expect(result.atUnmarginedPivot).toEqual([]);
    }); // hit() finds a rotated label shifted by text-margin, not the unmargined position

    test('hit() finds the node under a point and misses a point outside it', async ({ page }) => {
      const result = await page.evaluate(() => {
        const cy = window.cy;

        return {
          onNode: cy.$('#a').hit({ x: 100, y: 100 }).map(ele => ele.id()),
          offNode: cy.$('#a').hit({ x: 1000, y: 1000 }).map(ele => ele.id())
        };
      });

      expect(result.onNode).toEqual(['a']);
      expect(result.offNode).toEqual([]);
    }); // hit() finds the node under a point and misses a point outside it

    test('withinBox() returns nodes overlapping the box and excludes ones outside it', async ({ page }) => {
      const result = await page.evaluate(() => {
        const cy = window.cy;

        return {
          overlapping: cy.nodes().withinBox({ x1: 50, y1: 50, x2: 150, y2: 150 }).map(ele => ele.id()),
          empty: cy.nodes().withinBox({ x1: 1000, y1: 1000, x2: 1100, y2: 1100 }).map(ele => ele.id())
        };
      });

      expect(result.overlapping).toEqual(['a']);
      expect(result.empty).toEqual([]);
    }); // withinBox() returns nodes overlapping the box and excludes ones outside it

    test('withinBox() normalizes a reverse-dragged box', async ({ page }) => {
      const ids = await page.evaluate(() => {
        const cy = window.cy;

        // corners given bottom-right to top-left, as a reverse drag would produce
        return cy.nodes().withinBox({ x1: 150, y1: 150, x2: 50, y2: 50 }).map(ele => ele.id());
      });

      expect(ids).toEqual(['a']);
    }); // withinBox() normalizes a reverse-dragged box

    test('polygonIntersection() matches a node whose body intersects the polygon', async ({ page }) => {
      const result = await page.evaluate(() => {
        const cy = window.cy;
        const nearPolygon = [
          { x: 50, y: 50 },
          { x: 150, y: 50 },
          { x: 150, y: 150 },
          { x: 50, y: 150 }
        ];
        const farPolygon = [
          { x: 1000, y: 1000 },
          { x: 1100, y: 1000 },
          { x: 1100, y: 1100 },
          { x: 1000, y: 1100 }
        ];

        return {
          overlapping: cy.nodes().polygonIntersection(nearPolygon).map(ele => ele.id()),
          empty: cy.nodes().polygonIntersection(farPolygon).map(ele => ele.id())
        };
      });

      expect(result.overlapping).toEqual(['a']);
      expect(result.empty).toEqual([]);
    }); // polygonIntersection() matches a node whose body intersects the polygon

    test('polygonIntersection() excludes a diagonal edge\'s empty bounding-box corner', async ({ page }) => {
      const ids = await page.evaluate(() => {
        const cy = window.cy;

        cy.elements().remove();

        cy.style().selector('edge').style('curve-style', 'straight').update();

        cy.add([
          { data: { id: 'c' }, position: { x: 100, y: 100 } },
          { data: { id: 'd' }, position: { x: 300, y: 300 } },
          { data: { id: 'cd', source: 'c', target: 'd' } }
        ]);

        // near the top-right corner of the edge's axis-aligned bounding box,
        // far from the diagonal line itself
        const cornerPolygon = [
          { x: 260, y: 120 },
          { x: 300, y: 120 },
          { x: 300, y: 160 },
          { x: 260, y: 160 }
        ];

        return cy.edges().polygonIntersection(cornerPolygon).map(ele => ele.id());
      });

      expect(ids).toEqual([]);
    }); // polygonIntersection() excludes a diagonal edge's empty bounding-box corner

    for (const curve of ['bezier', 'unbundled-bezier', 'self', 'compound']) {
      test(`polygonIntersection() includes the ends of every ${curve} span`, async ({ page }) => {
        const results = await page.evaluate(curve => {
          const cy = window.cy;

          cy.elements().remove();
          cy.style().fromJson([
            { selector: 'node', style: { width: 10, height: 10 } },
            {
              selector: 'edge',
              style: {
                'curve-style': curve === 'unbundled-bezier' ? curve : 'bezier',
                'control-point-distances': [200, -200],
                'control-point-weights': [0.33, 0.67],
                'control-point-step-size': 200,
                'loop-direction': '0deg',
                'loop-sweep': '90deg'
              }
            }
          ]).update();

          cy.add([
            { data: { id: 'p' } },
            { data: { id: 'c', parent: 'p' }, position: { x: 100, y: 100 } },
            { data: { id: 'd' }, position: { x: 1100, y: 100 } },
            { data: { id: 'cd', source: curve === 'compound' ? 'p' : 'c', target: curve === 'self' || curve === 'compound' ? 'c' : 'd' } },
            { data: { id: 'parallel', source: 'c', target: 'd' } }
          ]);

          const edge = cy.$('#cd');
          edge.recalculateRenderedStyle();
          const rs = edge[0]._private.rscratch;
          const pts = rs.allpts;
          const matches = [];

          // The renderer samples at t = 0.05 through 0.95. Query the
          // missing ends of every span, including internal junctions.
          for (let i = 0; i + 5 < pts.length; i += 4) {
            for (const t of [0.02, 0.98]) {
              const x = (1 - t) ** 2 * pts[i] + 2 * t * (1 - t) * pts[i + 2] + t ** 2 * pts[i + 4];
              const y = (1 - t) ** 2 * pts[i + 1] + 2 * t * (1 - t) * pts[i + 3] + t ** 2 * pts[i + 5];
              const polygon = [
                { x: x - 2, y: y - 2 }, { x: x + 2, y: y - 2 },
                { x: x + 2, y: y + 2 }, { x: x - 2, y: y + 2 }
              ];

              matches.push(edge.polygonIntersection(polygon).map(ele => ele.id()));
            }
          }

          return { type: rs.edgeType, matches };
        }, curve);

        expect(results.type).toBe(curve === 'unbundled-bezier' ? 'multibezier' : curve);
        expect(results.matches.length).toBeGreaterThan(0);
        for (const ids of results.matches) {
          expect(ids).toEqual(['cd']);
        }
      });
    }
  }); // spatial queries

  test.describe('wheel zoom', () => {
    // each event's zoom ratio for a sequence of wheel deltas
    const wheel = async (page, deltas) => page.evaluate(deltas => {
      const cy = window.cy;
      const { x, y } = cy.container().getBoundingClientRect();

      return deltas.map(deltaY => {
        const before = cy.zoom();

        cy.container().dispatchEvent(new WheelEvent('wheel', {
          deltaY, deltaMode: 0, clientX: x + 100, clientY: y + 100, bubbles: true, cancelable: true
        }));

        return cy.zoom() / before;
      });
    }, deltas);

    const notchZoom = notches => Math.pow(10, notches * -3 / 250);
    const preciseZoom = delta => Math.pow(10, delta / -250);

    const expectZooms = (actual, expected) => {
      expect(actual.length).toBe(expected.length);
      actual.forEach((zoom, i) => expect(zoom).toBeCloseTo(expected[i], 6));
    };

    // the fifth event is the first one to use the sampled factor
    const sample = [120, 120, 120, 120, 120];
    const trackpad = [-20.34375, -2.015625, -69.1875, 44.8125, 4.078125];

    test('keeps the notch speed after using a trackpad (#3535)', async ({ page }) => {
      await wheel(page, sample);
      await wheel(page, trackpad);
      expectZooms(await wheel(page, [-120, 120]), [notchZoom(-1), notchZoom(1)]);
    });

    test('zooms trackpad deltas precisely after a mouse sample', async ({ page }) => {
      await wheel(page, sample);
      expectZooms(await wheel(page, trackpad), trackpad.map(preciseZoom));
    });

    test('ignores integer trackpad deltas far below the notch size', async ({ page }) => {
      const deltas = [1, 2, 3, 4, 5, 6, 10, 10, 10];
      await wheel(page, sample);
      expectZooms(await wheel(page, deltas), deltas.map(preciseZoom));
      expectZooms(await wheel(page, [120]), [notchZoom(1)]);
    });

    test('ignores single integer deltas that share a divisor with the notch size', async ({ page }) => {
      await wheel(page, sample);
      expectZooms(await wheel(page, [30]), [preciseZoom(5)]);
      expectZooms(await wheel(page, [120]), [notchZoom(1)]);
      await wheel(page, [90, 45, 60, 40]);
      expectZooms(await wheel(page, [120]), [notchZoom(1)]);
    });

    test('scales coalesced notches', async ({ page }) => {
      await wheel(page, sample);
      expectZooms(await wheel(page, [240, -360]), [notchZoom(2), notchZoom(-3)]);
    });

    test('recovers from a sample of only coalesced notches', async ({ page }) => {
      await wheel(page, [240, 240, 240, 240, 240]);
      expectZooms(await wheel(page, [120, 120, 240]), [preciseZoom(5), notchZoom(1), notchZoom(2)]);
    });

    test('recovers from a coalesced sample without a divisor of it', async ({ page }) => {
      await wheel(page, [240, 240, 240, 240, 240]);
      expectZooms(await wheel(page, [360, 360, 120]), [preciseZoom(5), notchZoom(3), notchZoom(1)]);
    });

    test('recovers from a sample of five coalesced notches', async ({ page }) => {
      await wheel(page, [600, 600, 600, 600, 600]);
      const zooms = await wheel(page, [-120, -120, -120]);
      expectZooms(zooms, [preciseZoom(-5), notchZoom(-1), notchZoom(-1)]);
    });

    for (const count of [9, 16]) {
      test(`recovers from a sample of ${count} coalesced integer notches`, async ({ page }) => {
        await wheel(page, Array(5).fill(count * 120));
        expectZooms(await wheel(page, [-120, -120, -240]), [preciseZoom(-5), notchZoom(-1), notchZoom(-2)]);
      });

      test(`recovers immediately from a sample of ${count} coalesced fractional notches`, async ({ page }) => {
        const notch = 100 / 1.1;
        await wheel(page, Array(5).fill(count * notch));
        expectZooms(await wheel(page, [-notch, -notch, -2 * notch]), [notchZoom(-1), notchZoom(-1), notchZoom(-2)]);
      });
    }

    test('keeps small precise deltas after a heavily coalesced sample', async ({ page }) => {
      await wheel(page, Array(5).fill(1080));
      const deltas = [1, 2, 3, 4, 5, 6, 10, 10, 10];
      expectZooms(await wheel(page, deltas), deltas.map(preciseZoom));
      expectZooms(await wheel(page, [1080]), [notchZoom(1)]);
    });

    test('recovers from fractional coalescing with alternating single and double notches', async ({ page }) => {
      const notch = 100 / 1.1;
      await wheel(page, Array(5).fill(notch * 2));
      const zooms = await wheel(page, [-notch, -notch * 2, -notch, -notch * 2, -notch]);
      expectZooms(zooms, [notchZoom(-1), notchZoom(-2), notchZoom(-1), notchZoom(-2), notchZoom(-1)]);
    });

    test('recovers from fractional coalescing with varying notch counts', async ({ page }) => {
      const notch = 100 / 1.1;
      await wheel(page, Array(5).fill(notch * 2));
      const counts = [-1, -3, -2, -1, -3, -2];
      expectZooms(await wheel(page, counts.map(n => n * notch)), counts.map(notchZoom));
    });

    test('bounds an unconfirmed fractional coalesced notch before recovering', async ({ page }) => {
      const notch = 100 / 1.1;
      await wheel(page, Array(5).fill(notch * 2));
      expectZooms(await wheel(page, [-3 * notch, -notch, -3 * notch]), [preciseZoom(-5), notchZoom(-1), notchZoom(-3)]);
    });

    test('keeps mouse-only notch scaling', async ({ page }) => {
      await wheel(page, sample);
      const counts = [-1, -2, -3, 1, 2, 3];
      expectZooms(await wheel(page, counts.map(n => n * 120)), counts.map(notchZoom));
    });

    test('keeps trackpad-only precise scaling', async ({ page }) => {
      await wheel(page, trackpad);
      expectZooms(await wheel(page, trackpad), trackpad.map(preciseZoom));
    });

    test('adapts to a new notch size', async ({ page }) => {
      await wheel(page, sample);
      expectZooms(await wheel(page, [100, 100, 100]), [preciseZoom(5), notchZoom(1), notchZoom(1)]);
      expectZooms(await wheel(page, [-120, -120]), [preciseZoom(-5), notchZoom(-1)]);
    });

    test('adapts to a new fractional notch size', async ({ page }) => {
      const notch = 400 / 3;
      await wheel(page, sample);
      expectZooms(await wheel(page, [notch, notch]), [preciseZoom(5), notchZoom(1)]);
    });

    test('scales coalesced notches of a fractional notch size', async ({ page }) => {
      const notch = 100 / 1.1; // e.g. a notch of 100 at a page zoom of 110%
      await wheel(page, [notch, notch, notch, notch, notch]);
      expectZooms(await wheel(page, [notch, notch + notch, notch + notch + notch]), [notchZoom(1), notchZoom(2), notchZoom(3)]);
    });
  }); // wheel zoom


  test.describe('webgl', () => {

    test('viewport change redraws screen even if picking occurs before frame (issue #3536)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

        const cy = cytoscape({
          container: document.getElementById('cytoscape'),
          renderer: { name: 'canvas', webgl: true },
          elements: [
            { data: { id: 'a' }, position: { x: 100, y: 100 } },
            { data: { id: 'b' }, position: { x: 300, y: 200 } }
          ]
        });

        await frame();
        await frame();

        const r = cy.renderer();

        // Mark the drag layer as pending before the picking query
        r.data.canvasNeedsRedraw[r.DRAG] = true;

        // Change zoom
        cy.zoom(2);
        const needsRedrawAfterZoom = r.data.canvasNeedsRedraw[r.NODE];

        // Query picking buffer before screen animation frame runs (as mousemove does)
        r.findNearestElements(50, 50);
        const needsRedrawAfterPicking = r.data.canvasNeedsRedraw[r.NODE];
        const dragNeedsRedrawAfterPicking = r.data.canvasNeedsRedraw[r.DRAG];

        // Wait for screen render frame
        await frame();
        await frame();

        const needsRedrawAfterScreenDraw = r.data.canvasNeedsRedraw[r.NODE];
        const dragNeedsRedrawAfterScreenDraw = r.data.canvasNeedsRedraw[r.DRAG];

        cy.destroy();

        return {
          needsRedrawAfterZoom,
          needsRedrawAfterPicking,
          needsRedrawAfterScreenDraw,
          dragNeedsRedrawAfterPicking,
          dragNeedsRedrawAfterScreenDraw
        };
      });

      expect(result.needsRedrawAfterZoom).toBe(true);
      expect(result.needsRedrawAfterPicking).toBe(true);
      expect(result.needsRedrawAfterScreenDraw).toBe(false);
      expect(result.dragNeedsRedrawAfterPicking).toBe(true);
      expect(result.dragNeedsRedrawAfterScreenDraw).toBe(false);
    });

  }); // webgl

}); // renderer
