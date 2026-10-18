import { test, expect } from '@playwright/test';

const PAGE = 'http://127.0.0.1:3333/debug/index.html';

const openWorkflow = async (page, scene) => {
  await page.goto(`${PAGE}?network=workflows&scene=${scene}&layout=preset`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#contextual-tools')).toBeVisible();
  await expect(page.locator('#contextual-controls')).not.toBeEmpty();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.cy?.nodes().length)))
    .toBe(true);
  const hasAdapter = await page.evaluate(async () => {
    if (navigator.gpu == null) return false;
    return (await navigator.gpu.requestAdapter()) != null;
  });

  test.skip(
    !hasAdapter,
    'no WebGPU adapter available for the renderer workflow',
  );
};

test('workflow selector routes to every canonical panel', async ({ page }) => {
  test.slow();
  await openWorkflow(page, 'algorithms');
  const scenes = [
    ['algorithms', 'Algorithms', 'Operation'],
    ['layouts', 'Layout callback recipes', 'Built-in layout'],
    ['inspector', 'Query and inspect', 'Structured query JSON'],
    ['mutation', 'Update and persist', 'Apply deterministic patch'],
    ['animation', 'Animation', 'Duration (ms)'],
    ['gestures', 'Gestures and events', 'Desktop tap threshold (px)'],
    ['export', 'Image export', 'Format'],
    ['runtime', 'Renderer and lifecycle', 'Renderer host (reloads the page)'],
  ];

  for (const [scene, title, control] of scenes) {
    if (new URL(page.url()).searchParams.get('scene') !== scene) {
      await page.getByLabel('Workflow').selectOption(scene);
      await expect
        .poll(() => new URL(page.url()).searchParams.get('scene'))
        .toBe(scene);
    }
    await expect(page.locator('#contextual-title')).toHaveText(title);
    if (control === 'Apply deterministic patch') {
      await expect(page.getByRole('button', { name: control })).toBeVisible();
    } else {
      await expect(page.getByLabel(control)).toBeVisible();
    }
  }
});

test('enables executor comparison after selecting a supported method and executor', async ({
  page,
}) => {
  await openWorkflow(page, 'algorithms');
  const controls = page.locator('#contextual-controls');
  await controls.getByLabel('Operation').selectOption('pageRank');
  await controls.getByLabel('Executor').selectOption('gpu');

  const compare = controls.getByRole('button', {
    name: 'Compare chosen executor with CPU',
  });
  await expect(compare).toBeEnabled();
  await compare.click();
  await expect(
    controls.locator('.feature-workflow-compare-summary'),
  ).toContainText('pageRank: CPU vs gpu — within tolerance', {
    timeout: 15000,
  });
});

test('algorithm controls use the chosen path IDs and report every leaf score', async ({
  page,
}, testInfo) => {
  await openWorkflow(page, 'algorithms');
  await page.setViewportSize({ width: 1280, height: 800 });

  const controls = page.locator('#contextual-controls');
  await controls.getByLabel('Operation').selectOption('dijkstra');
  await controls.getByLabel('Root example').selectOption('b');
  await controls.getByLabel('Goal example').selectOption('d');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const query = new URLSearchParams(location.search);
        return [
          query.get('workflowAlgorithm'),
          query.get('workflowExecutor'),
          query.get('workflowRoot'),
          query.get('workflowGoal'),
        ];
      }),
    )
    .toEqual(['dijkstra', 'cpu', 'b', 'd']);
  await page.reload();
  await expect(controls.getByLabel('Operation')).toHaveValue('dijkstra');
  await expect(controls.getByLabel('Root example')).toHaveValue('b');
  await expect(controls.getByLabel('Goal example')).toHaveValue('d');
  await controls.getByRole('button', { name: 'Run algorithm' }).click();
  await expect(
    controls.locator('.feature-workflow-output').nth(1),
  ).toContainText('distance b→d: 3');
  await expect(
    controls.locator('.feature-workflow-output').nth(1),
  ).toContainText('b → bc → c → cd → d');

  await controls.getByLabel('Operation').selectOption('pageRank');
  const executor = controls.getByLabel('Executor');
  for (const lane of ['cpu', 'auto', 'gpu', 'workers']) {
    await executor.selectOption(lane);
    await controls.getByRole('button', { name: 'Run algorithm' }).click();
    await expect(
      controls.locator('.feature-workflow-output').first(),
    ).toContainText(`completed with executor '${lane}'`, { timeout: 15000 });
  }
  const result = controls.locator('.feature-workflow-output').nth(1);
  await expect(result).toContainText('x:');
  await expect(result).toContainText('y:');

  await executor.selectOption('workers');
  await controls
    .getByRole('button', { name: 'Compare chosen executor with CPU' })
    .click();
  const comparison = controls.locator('.feature-workflow-output').nth(2);
  await expect(comparison).toContainText(
    'pageRank: CPU vs workers — within tolerance',
  );
  await expect(comparison).toContainText('Compared 7 values');
  const comparisonTable = controls.locator('.feature-workflow-table');
  const exactComparison = controls.locator('.feature-workflow-exact-values');
  await expect(comparisonTable).toContainText('rank.a');
  await expect(exactComparison).toContainText('rank.a: CPU=');
  await executor.selectOption('gpu');
  await controls
    .getByRole('button', { name: 'Compare chosen executor with CPU' })
    .click();
  await expect(comparison).toContainText(
    'pageRank: CPU vs gpu — within tolerance',
  );
  await expect(comparison).toContainText('abs 0.0001 + rel 0.0001');
  await expect(comparison).toContainText('max relative Δ');
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText(
    'pageRank CPU vs gpu comparison completed: within tolerance across 7 values',
  );
  await expect(
    controls.locator('.feature-workflow-output').nth(1),
  ).toContainText("Last run · pageRank / executor 'workers'");
  await expect(comparisonTable.locator('thead')).toContainText('gpu');
  await expect(comparisonTable.locator('tbody tr')).toHaveCount(7);
  await controls
    .getByRole('button', { name: 'Clear result highlight' })
    .evaluate((element) => element.click());
  await controls
    .locator('.feature-workflow-output')
    .nth(1)
    .evaluate((element) => {
      element.style.maxHeight = '4em';
    });
  await comparison.evaluate((element) => {
    const sidebar = document.querySelector('#commands');
    const elementTop =
      element.getBoundingClientRect().top -
      sidebar.getBoundingClientRect().top +
      sidebar.scrollTop;

    sidebar.scrollTop = Math.max(0, elementTop - 500);
  });
  await page.screenshot({
    path: testInfo.outputPath('executor-comparison-page.png'),
  });
  const comparisonReport = controls.locator('.feature-workflow-compare-report');
  await comparisonReport.evaluate((element) => {
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';
    element.querySelector('.feature-workflow-exact-comparison').open = true;
    const exactValues = element.querySelector('.feature-workflow-exact-values');
    exactValues.style.maxHeight = 'none';
    exactValues.style.overflow = 'visible';
    exactValues.style.whiteSpace = 'pre-wrap';
    exactValues.style.overflowWrap = 'anywhere';
    const sidebar = document.querySelector('#commands');
    sidebar.style.position = 'static';
    sidebar.style.height = 'auto';
    sidebar.style.maxHeight = 'none';
    sidebar.style.overflow = 'visible';
  });
  await comparisonReport.screenshot({
    path: testInfo.outputPath('executor-comparison-report.png'),
  });

  await controls.getByLabel('Operation').selectOption('floydWarshall');
  await controls.getByLabel('Executor').selectOption('gpu');
  await controls.getByLabel('Root example').selectOption('a');
  await controls.getByLabel('Goal example').selectOption('x');
  await controls
    .getByRole('button', { name: 'Compare chosen executor with CPU' })
    .click();
  await expect(comparison).toContainText(
    'floydWarshall: CPU vs gpu — within tolerance',
  );
  await expect(exactComparison).toContainText(
    'distance.a→x: CPU=Infinity; gpu=Infinity; |Δ|=0',
  );

  await controls.getByLabel('Operation').selectOption('pageRank');
  await controls.getByLabel('Executor').selectOption('workers');
  const repeats = controls.getByLabel('Async repeat count');
  await repeats.fill('100');
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(location.search).get('workflowRepeats'),
      ),
    )
    .toBe('100');
  await page.evaluate(() => {
    const controls = document.querySelector('#contextual-controls');
    [...controls.querySelectorAll('button')]
      .find((button) => button.textContent === 'Run algorithm')
      .click();
    [...controls.querySelectorAll('button')]
      .find((button) => button.textContent === 'Cancel run')
      .click();
  });
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText(/Cancellation requested|CancelledError|Cancelled after/);
});

test('layout workflow runs real transform, ready, and stop callbacks', async ({
  page,
}) => {
  await openWorkflow(page, 'layouts');
  const controls = page.locator('#contextual-controls');
  await controls.getByLabel('Built-in layout').selectOption('circle');
  await controls.getByLabel('Transform x shift (model px)').fill('35');
  await controls
    .getByRole('button', { name: 'Run transform / ready / stop recipe' })
    .click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('completed; ready and stop each fired once');
  const trace = controls.locator('.feature-workflow-output').nth(1);
  await expect(trace).toContainText(
    'layoutstart → ready callback → layoutready',
  );
  await expect(trace).toContainText('stop callback → layoutstop');
  await expect(trace).toContainText('"transform":');
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(location.search).get('workflowLayout'),
      ),
    )
    .toBe('circle');
});

test('structured query selects live elements and inspector reports topology', async ({
  page,
}) => {
  await openWorkflow(page, 'inspector');
  const controls = page.locator('#contextual-controls');
  await controls.getByRole('button', { name: 'score > 1' }).click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('7 match(es): a, b, c, d, e, x, y');
  const inspection = controls.locator('.feature-workflow-output').nth(1);
  await expect(inspection).toContainText('"ancestors": [\n    "p"');
  await expect(inspection).toContainText('"connectedEdges": [\n    "ab"');
  const selected = await page.evaluate(() =>
    window.cy
      .nodes({ selected: true })
      .map((node) => node.id())
      .sort(),
  );
  expect(selected).toEqual(['a', 'b', 'c', 'd', 'e', 'x', 'y']);
});

test('mutation controls compare persistence, await clone sync, and restore the authored graph', async ({
  page,
}) => {
  await openWorkflow(page, 'mutation');
  const controls = page.locator('#contextual-controls');
  const before = await page.evaluate(() => {
    const { nodes, edges } = window.cy.json().elements;
    const byId = (left, right) => left.data.id.localeCompare(right.data.id);
    return JSON.stringify({
      nodes: nodes.slice().sort(byId),
      edges: edges.slice().sort(byId),
    });
  });

  await controls
    .getByRole('button', { name: 'Apply deterministic patch' })
    .click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('added [f, df]');
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('removed [de, e]');
  await controls
    .getByRole('button', { name: 'Toggle c under p / top level' })
    .click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('parent=p');

  await controls
    .getByRole('button', { name: 'Compare serialize → load' })
    .evaluate((element) => {
      element.click();
      element.click();
    });
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('persisted-field comparison: all equal', { timeout: 10000 });
  await controls
    .getByRole('button', { name: 'Clone, follow a.data change, compare' })
    .evaluate((element) => {
      element.click();
      element.click();
    });
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('Following clone emitted patch:', { timeout: 5000 });

  await controls
    .getByRole('button', { name: 'Restore authored graph' })
    .click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('c parent=none');
  const after = await page.evaluate(() => {
    const { nodes, edges } = window.cy.json().elements;
    const byId = (left, right) => left.data.id.localeCompare(right.data.id);
    return JSON.stringify({
      nodes: nodes.slice().sort(byId),
      edges: edges.slice().sort(byId),
    });
  });
  expect(JSON.parse(after)).toEqual(JSON.parse(before));

  await controls
    .getByRole('button', { name: 'Start progressive load' })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.cy
          .nodes()
          .filter((node) => node.id().startsWith('stream-'))
          .map((node) => node.id()),
      ),
    )
    .toEqual(['stream-a']);
  await expect(
    controls.locator('.feature-workflow-output').nth(1),
  ).toContainText('Chunk 1');
  await controls
    .getByRole('button', { name: 'Restore authored graph' })
    .click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('Restored authored snapshot');
  await expect(
    controls.locator('.feature-workflow-output').nth(1),
  ).toContainText(
    'Progressive load cancelled before restore; landed stream ids were removed (none remain).',
  );
  const streamIdsAfterRestore = () =>
    page.evaluate(() =>
      window.cy
        .nodes()
        .filter((node) => node.id().startsWith('stream-'))
        .map((node) => node.id()),
    );
  expect(await streamIdsAfterRestore()).toEqual([]);
  await page.waitForTimeout(650);
  expect(await streamIdsAfterRestore()).toEqual([]);
});

test('animation transition and gesture controls change live state and event propagation', async ({
  page,
}) => {
  test.slow();
  await openWorkflow(page, 'animation');
  const controls = page.locator('#contextual-controls');
  const initial = await page.evaluate(() => window.cy.$id('a').position());

  await controls.getByLabel('Duration (ms)').fill('6000');
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(location.search).get('workflowAnimationDuration'),
      ),
    )
    .toBe('6000');
  await controls
    .getByRole('button', { name: 'Play transition + position/width tween' })
    .click();
  const progress = controls.locator(
    'progress[aria-label="Animation progress"]',
  );
  await expect
    .poll(() => progress.evaluate((element) => element.value), {
      timeout: 8000,
    })
    .toBeGreaterThan(0.08);
  const readout = controls.locator('.feature-workflow-output').nth(1);
  await expect(readout).toContainText('background-color opacity');
  await expect(readout).toContainText('lineColor');
  await expect(readout).toContainText('transition-property');
  await expect(readout).toContainText('position');
  await controls
    .getByRole('button', { name: 'Pick current animated location' })
    .click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText(/Mid-flight pick/);
  await controls.getByRole('button', { name: 'Stop in place' }).click();
  await controls
    .getByRole('button', { name: 'Restore captured geometry/style' })
    .click();
  const restored = await page.evaluate(() => window.cy.$id('a').position());
  expect(restored).toEqual(initial);
  await expect
    .poll(() =>
      page.evaluate(() => {
        return [
          window.cy.$id('a').style('transition-property'),
          window.cy.$id('ab').style('transition-property'),
        ];
      }),
    )
    .toEqual(['none', 'none']);

  await controls.getByLabel('Duration (ms)').fill('2400');
  await controls.getByLabel('Target width (px)').fill('90');
  const easingControl = controls.getByLabel('Transition timing function');
  const playTransition = controls.getByRole('button', {
    name: 'Play transition + position/width tween',
  });
  const animationProgress = controls.locator(
    'progress[aria-label="Animation progress"]',
  );
  const sampleAtMidFlight = async (read, what) => {
    const deadline = Date.now() + 8000;
    let sample;

    do {
      await page.screenshot();
      sample = await read();
      if (sample.progress == null) {
        throw new Error(
          `Animation progress control missing for ${what}: ${JSON.stringify(sample)}`,
        );
      }
      if (sample.progress >= 0.42 && sample.progress <= 0.58) return sample;
    } while (Date.now() < deadline);

    throw new Error(
      `No mid-flight sample for ${what}: ${JSON.stringify(sample)}`,
    );
  };
  const sampleWidthAtMidFlight = async (easingName) => {
    await easingControl.selectOption(easingName);
    await playTransition.click();
    const midFlight = await sampleAtMidFlight(
      () =>
        page.evaluate(() => {
          const progress = document.querySelector(
            'progress[aria-label="Animation progress"]',
          );
          return {
            progress: progress == null ? null : Number(progress.value),
            width: window.cy.$id('a').numericStyle('width'),
            url: location.href,
            status: document.querySelector(
              '#contextual-controls .feature-workflow-output',
            )?.textContent,
          };
        }),
      `${easingName} animation`,
    );
    await controls.getByRole('button', { name: 'Stop in place' }).click();
    await controls
      .getByRole('button', { name: 'Restore captured geometry/style' })
      .click();
    return midFlight.width;
  };
  const easeInWidth = await sampleWidthAtMidFlight('ease-in');
  const easeOutWidth = await sampleWidthAtMidFlight('ease-out');
  expect(easeInWidth).toBeGreaterThan(52);
  expect(easeOutWidth).toBeGreaterThan(easeInWidth);
  expect(easeOutWidth).toBeLessThan(90);

  await controls.getByLabel('Duration (ms)').fill('700');
  const timingFunctions = await page.evaluate(
    () => window.featureWorkflows.timingFunctions,
  );
  expect(timingFunctions).toHaveLength(26);
  const rgb = (value) =>
    Array.isArray(value)
      ? value
          .slice(0, 3)
          .map((channel) => (channel <= 1 ? channel * 255 : channel))
      : value
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
  const progressRatio = (startValue, middleValue, endValue) => {
    const startChannels = rgb(startValue);
    const middleChannels = rgb(middleValue);
    const endChannels = rgb(endValue);
    const vector = endChannels.map(
      (value, index) => value - startChannels[index],
    );
    const moved = middleChannels.map(
      (value, index) => value - startChannels[index],
    );
    const denominator = vector.reduce((sum, value) => sum + value * value, 0);

    return (
      vector.reduce((sum, value, index) => sum + value * moved[index], 0) /
      denominator
    );
  };
  const transitionProgress = {};
  for (const timing of timingFunctions) {
    await easingControl.selectOption(timing);
    await expect
      .poll(() =>
        page.evaluate(() =>
          new URLSearchParams(location.search).get(
            'workflowAnimationTimingFunction',
          ),
        ),
      )
      .toBe(timing);
    const startColors = await page.evaluate(() => ({
      node: window.cy.$id('a').style('background-color'),
      edge: window.cy.$id('ab').style('line-color'),
      nodeBorderWidth: window.cy.$id('a').numericStyle('border-width'),
      edgeWidth: window.cy.$id('ab').numericStyle('width'),
    }));
    await playTransition.click();
    const middle = await sampleAtMidFlight(
      () =>
        page.evaluate(() => {
          const progress = document.querySelector(
            'progress[aria-label="Animation progress"]',
          );
          return {
            progress: progress == null ? null : Number(progress.value),
            node: (() => {
              const ref = window.cy._store.lookup('a');
              const color = window.cy._store.column('node.fillColor');
              return Array.from(color.subarray(ref.slot * 4, ref.slot * 4 + 3));
            })(),
            edge: (() => {
              const ref = window.cy._store.lookup('ab');
              const color = window.cy._store.column('edge.lineColor');
              return Array.from(color.subarray(ref.slot * 4, ref.slot * 4 + 3));
            })(),
            nodeBorderWidth: window.cy.$id('a').numericStyle('border-width'),
            edgeWidth: window.cy.$id('ab').numericStyle('width'),
            url: location.href,
            status: document.querySelector(
              '#contextual-controls .feature-workflow-output',
            )?.textContent,
          };
        }),
      `${timing} node/edge transition`,
    );
    const middleColors = { node: middle.node, edge: middle.edge };
    await expect
      .poll(() =>
        page.evaluate(() => [
          window.cy.$id('a').numericStyle('border-width'),
          window.cy.$id('ab').numericStyle('width'),
        ]),
      )
      .toEqual([6, 4]);
    const state = await page.evaluate(() => ({
      nodeColor: window.cy.$id('a').style('background-color'),
      edgeColor: window.cy.$id('ab').style('line-color'),
      nodeBorderWidth: window.cy.$id('a').numericStyle('border-width'),
      edgeWidth: window.cy.$id('ab').numericStyle('width'),
      nodeEasing: window.cy.$id('a').style('transition-timing-function'),
      edgeEasing: window.cy.$id('ab').style('transition-timing-function'),
    }));
    expect(state.nodeEasing).toBe(timing);
    expect(state.edgeEasing).toBe(timing);
    expect(state.nodeColor).not.toBe(startColors.node);
    expect(state.edgeColor).not.toBe(startColors.edge);
    expect(middleColors.node).not.toBe(startColors.node);
    expect(middleColors.node).not.toBe(state.nodeColor);
    expect(middleColors.edge).not.toBe(startColors.edge);
    expect(middleColors.edge).not.toBe(state.edgeColor);
    expect(middle.nodeBorderWidth).toBeGreaterThan(startColors.nodeBorderWidth);
    expect(middle.nodeBorderWidth).toBeLessThan(state.nodeBorderWidth);
    expect(middle.edgeWidth).toBeGreaterThan(startColors.edgeWidth);
    expect(middle.edgeWidth).toBeLessThan(state.edgeWidth);
    transitionProgress[timing] = {
      node: progressRatio(startColors.node, middleColors.node, state.nodeColor),
      edge: progressRatio(startColors.edge, middleColors.edge, state.edgeColor),
    };
    expect(transitionProgress[timing].node).toBeGreaterThan(0);
    expect(transitionProgress[timing].node).toBeLessThan(1);
    expect(transitionProgress[timing].edge).toBeGreaterThan(0);
    expect(transitionProgress[timing].edge).toBeLessThan(1);
    await expect(
      controls.locator('.feature-workflow-output').nth(1),
    ).toContainText(`"transition-timing-function": "${timing}"`);
    await controls
      .getByRole('button', { name: 'Restore captured geometry/style' })
      .click();
  }
  expect(transitionProgress['ease-in'].node).toBeLessThan(
    transitionProgress.linear.node,
  );
  expect(transitionProgress['ease-out'].node).toBeGreaterThan(
    transitionProgress.linear.node,
  );
  expect(transitionProgress['ease-in'].edge).toBeLessThan(
    transitionProgress.linear.edge,
  );
  expect(transitionProgress['ease-out'].edge).toBeGreaterThan(
    transitionProgress.linear.edge,
  );

  await page.goto(`${PAGE}?network=workflows&scene=gestures&layout=preset`);
  await expect(page.locator('#contextual-title')).toHaveText(
    'Gestures and events',
  );
  const gestureControls = page.locator('#contextual-controls');
  await gestureControls.getByLabel('Desktop tap threshold (px)').fill('13');
  await gestureControls.getByLabel('Touch tap threshold (px)').fill('19');
  await gestureControls.getByLabel('Taphold duration (ms)').fill('620');
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(location.search).get('workflowTapholdDuration'),
      ),
    )
    .toBe('620');
  await gestureControls
    .getByRole('button', { name: 'Apply tap and hold thresholds' })
    .click();
  await expect(
    gestureControls.locator('.feature-workflow-output').first(),
  ).toContainText('desktop=13 px; touch=19 px; taphold=620 ms');
  const declutter = gestureControls.getByLabel('Label declutter');
  const applyDeclutter = gestureControls.getByRole('button', {
    name: 'Apply label declutter mode',
  });
  for (const mode of ['cull', 'none']) {
    await declutter.selectOption(mode);
    await expect
      .poll(() =>
        page.evaluate(() =>
          new URLSearchParams(location.search).get('workflowLabelDeclutter'),
        ),
      )
      .toBe(mode);
    await applyDeclutter.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.cy.style().json().core['label-declutter']),
      )
      .toBe(mode);
  }
  await gestureControls
    .getByRole('button', { name: 'Apply held-gesture core styles' })
    .click();
  const chrome = await page.evaluate(() => window.cy.style().json().core);
  expect(chrome['active-bg-color']).toBe('#2f7de1');
  expect(chrome['active-bg-opacity']).toBe(0.32);
  expect(chrome['active-bg-size']).toBe(48);
  expect(chrome['selection-box-color']).toBe('#ef7d35');
  expect(chrome['selection-box-opacity']).toBe(0.4);
  expect(chrome['selection-box-border-color']).toBe('#8b3f16');
  expect(chrome['selection-box-border-width']).toBe(2);
  const aEventsBefore = await page.evaluate(() =>
    window.cy.$id('a').style('events'),
  );
  const toggleEvents = gestureControls.getByRole('button', {
    name: 'Toggle a.events no/yes',
  });
  await toggleEvents.click();
  const aEventsChanged = await page.evaluate(() =>
    window.cy.$id('a').style('events'),
  );
  expect(aEventsChanged).not.toBe(aEventsBefore);
  await toggleEvents.click();
  await expect
    .poll(() => page.evaluate(() => window.cy.$id('a').style('events')))
    .toBe(aEventsBefore);

  const bTextEventsBefore = await page.evaluate(() =>
    window.cy.$id('b').style('text-events'),
  );
  const toggleTextEvents = gestureControls.getByRole('button', {
    name: 'Toggle b.text-events no/yes',
  });
  await toggleTextEvents.click();
  const bTextEventsChanged = await page.evaluate(() =>
    window.cy.$id('b').style('text-events'),
  );
  expect(bTextEventsChanged).not.toBe(bTextEventsBefore);
  await toggleTextEvents.click();
  await expect
    .poll(() => page.evaluate(() => window.cy.$id('b').style('text-events')))
    .toBe(bTextEventsBefore);
  const edgeEventsBefore = await page.evaluate(() =>
    window.cy.$id('ab').style('events'),
  );
  const toggleEdgeEvents = gestureControls.getByRole('button', {
    name: 'Toggle edge ab.events no/yes',
  });
  await toggleEdgeEvents.click();
  const edgeEventsChanged = await page.evaluate(() =>
    window.cy.$id('ab').style('events'),
  );
  expect(edgeEventsChanged).not.toBe(edgeEventsBefore);
  await toggleEdgeEvents.click();
  await expect
    .poll(() => page.evaluate(() => window.cy.$id('ab').style('events')))
    .toBe(edgeEventsBefore);
  expect(edgeEventsBefore).toBe('yes');
  await gestureControls
    .getByRole('button', { name: 'Attach / remove a→p delegated tap recipe' })
    .click();
  await page.evaluate(() => window.cy.$id('a').emit('tap'));
  await expect(
    gestureControls.locator('.feature-workflow-output').nth(1),
  ).toContainText('child phase · a');
  await expect(
    gestureControls.locator('.feature-workflow-output').nth(1),
  ).toContainText('parent phase · a');
  await expect(
    gestureControls.locator('.feature-workflow-output').nth(1),
  ).toContainText('delegated core phase · a');

  await gestureControls
    .getByRole('button', { name: 'Clear event log' })
    .click();
  await gestureControls.getByLabel('Stop at child phase').check();
  await page.evaluate(() => window.cy.$id('a').emit('tap'));
  const events = gestureControls.locator('.feature-workflow-output').nth(1);
  await expect(events).toContainText('child phase · a · stopPropagation()');
  await expect(events).not.toContainText('parent phase · a');
  await expect(events).not.toContainText('delegated core phase · a');
});

test('image export returns real image bytes and renderer panel reports host readiness and lifecycle', async ({
  page,
}) => {
  await openWorkflow(page, 'export');
  const controls = page.locator('#contextual-controls');
  await controls.getByRole('button', { name: 'Render preview' }).click();
  await expect(controls.locator('img.feature-workflow-preview')).toBeVisible({
    timeout: 15000,
  });
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('PNG');
  await expect(
    controls.getByRole('link', { name: 'Download image' }),
  ).toBeVisible();
  const preview = controls.locator('img.feature-workflow-preview');
  const firstSize = await preview.evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  await controls.getByLabel('Format').selectOption('jpg');
  await controls.getByLabel('Scale').fill('3');
  await controls.getByLabel('Background').fill('#101820');
  await controls.getByLabel('Full graph bounds').check();
  await controls.getByRole('button', { name: 'Render preview' }).click();
  await expect(
    controls.locator('.feature-workflow-output').first(),
  ).toContainText('JPG', { timeout: 15000 });
  const exported = await preview.evaluate(async (image) => {
    const blob = await fetch(image.src).then((response) => response.blob());
    const bitmap = await createImageBitmap(blob);
    const result = {
      type: blob.type,
      size: blob.size,
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close();
    return result;
  });
  expect(exported.type).toBe('image/jpeg');
  expect(exported.size).toBeGreaterThan(0);
  expect(exported.width).toBeGreaterThan(firstSize.width);
  expect(exported.height).toBeGreaterThan(firstSize.height);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const query = new URLSearchParams(location.search);
        return [
          query.get('workflowExportFormat'),
          query.get('workflowExportScale'),
          query.get('workflowExportBackground'),
          query.get('workflowExportFull'),
        ];
      }),
    )
    .toEqual(['jpg', '3', '#101820', 'true']);

  await openWorkflow(page, 'runtime');
  await expect(page.locator('#contextual-title')).toHaveText(
    'Renderer and lifecycle',
  );
  const runtime = page.locator('#contextual-controls');
  await expect(runtime).toContainText('Actual host identity: not exposed');
  const runtimeStats = runtime.locator('.feature-workflow-output').nth(1);
  await expect(runtimeStats).toContainText(/Renderer ready; counts .*frames=/, {
    timeout: 15000,
  });
  const lifecycle = runtime.getByRole('button', {
    name: 'Unmount / mount renderer',
  });
  await lifecycle.click();
  await expect
    .poll(() => page.evaluate(() => window.cy.container() === null))
    .toBe(true);
  await expect(
    runtime.locator('.feature-workflow-output').first(),
  ).toContainText('Renderer unmounted; model remains live');
  await lifecycle.click();
  await expect
    .poll(() => page.evaluate(() => window.cy.container() !== null), {
      timeout: 15000,
    })
    .toBe(true);
  await expect(
    runtime.locator('.feature-workflow-output').first(),
  ).toContainText('Renderer mounted and ready', { timeout: 15000 });
  await expect(runtimeStats).toContainText(/Renderer ready; counts .*frames=/, {
    timeout: 15000,
  });

  await runtime
    .getByLabel('Renderer host (reloads the page)')
    .selectOption('true');
  await expect(page).toHaveURL(/rendererWorker=true/);
  await expect(page.locator('#contextual-title')).toHaveText(
    'Renderer and lifecycle',
  );
  const workerRuntime = page.locator('#contextual-controls');
  await expect(
    workerRuntime.locator('.feature-workflow-output').first(),
  ).toContainText('Requested host: worker; renderer ready: yes');
  await expect(
    workerRuntime.locator('.feature-workflow-output').nth(1),
  ).toContainText(/Renderer ready; counts .*frames=/, { timeout: 15000 });
});
