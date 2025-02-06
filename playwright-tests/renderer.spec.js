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

  // test('bundled beziers move when adding to the bundle', async ({ page }) => {
  //   // const extent = await page.evaluate(() => {
  //   //   return window.cy.extent();
  //   // });

  //   // console.log('extent', extent);

  //   const stepSize = 40;

  //   const ctrlpts1 = await page.evaluate(() => {
  //     const cy = window.cy;

  //     cy.style().fromJson([
  //       {
  //         selector: 'edge',
  //         style: {
  //           'curve-style': 'bezier',
  //           'control-point-step-size': 40
  //         }
  //       }
  //     ]).update();

  //     cy.add([
  //       {
  //         data: { id: 'a' }
  //       },
  //       {
  //         data: { id: 'b' }
  //       },
  //       {
  //         data: { id: 'ab1', source: 'a', target: 'b' }
  //       },
  //       {
  //         data: { id: 'ab2', source: 'a', target: 'b' }
  //       }
  //     ]);

  //     cy.layout({ name: 'grid', rows: 1, cols: 2 }).run();

  //     return cy.edges().map(edge => edge.controlPoints()[0]);
  //   });
    
  //   let pt_ab1_1 = await page.evaluate(() => {
  //     return window.cy.$('#ab1').controlPoints()[0];
  //   });

  //   let pt_ab2_1 = await page.evaluate(() => {
  //     return window.cy.$('#ab2').controlPoints()[0];
  //   });

  //   expect(ctrlpts1.length).toBe(2);
  //   expectUniquePoints(ctrlpts1);

  //   // distance between the two control points
  //   let d_1_01 = dist(ctrlpts1[0], ctrlpts1[1]);

  //   expect(d_1_01).toBe(stepSize);

  //   const ctrlpts2 = await page.evaluate(() => {
  //     const cy = window.cy;

  //     cy.add([
  //       {
  //         data: { id: 'ab3', source: 'a', target: 'b' }
  //       },
  //       {
  //         data: { id: 'ab4', source: 'a', target: 'b' }
  //       }
  //     ]);

  //     return cy.edges().map(edge => edge.controlPoints()[0]);
  //   });

  //   // console.log(ctrlpts2);

  //   expect(ctrlpts2.length).toBe(4);
  //   expectUniquePoints(ctrlpts2);

  //   let d_2_01 = dist(ctrlpts2[0], ctrlpts2[1]);
  //   let d_2_12 = dist(ctrlpts2[1], ctrlpts2[2]);
  //   let d_2_23 = dist(ctrlpts2[2], ctrlpts2[3]);

  //   expect(d_2_01).toBeCloseTo(stepSize);
  //   expect(d_2_12).toBeCloseTo(stepSize);
  //   expect(d_2_23).toBeCloseTo(stepSize);

  //   let pt_ab1_2 = await page.evaluate(() => {
  //     return window.cy.$('#ab1').controlPoints()[0];
  //   });

  //   let pt_ab2_2 = await page.evaluate(() => {
  //     return window.cy.$('#ab2').controlPoints()[0];
  //   });

  //   // ctrl pts for ab1 and ab2 should have changed
  //   expect(pt_ab1_1).not.toEqual(pt_ab1_2);
  //   expect(pt_ab2_1).not.toEqual(pt_ab2_2);
  // });

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

}); // renderer