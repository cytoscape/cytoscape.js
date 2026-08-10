import cytoscape from '/home/user/Documents/workspace/cytoscape.js/src/index.mjs';
const els = [];
for (let i = 0; i < 2000; i++) els.push({ data: { id: 'n' + i }, position: { x: i, y: i } });
const cy = cytoscape({ elements: els });
const gn = cy.$id('n1000');
const time = (label, fn, iters = 3e5) => {
  for (let i = 0; i < 3e4; i++) fn(i);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn(i);
  console.log(label.padEnd(34), (Number(process.hrtime.bigint() - t0) / iters).toFixed(0), 'ns');
};
time('delayAnimation build', () => gn.delayAnimation(100));
const h = gn.delayAnimation(100);
time('stop() with nothing running', () => gn.stop());
time('play+stop prebuilt', () => { h.play(); h.stop(); });
time('_liveRefs()', () => gn._liveRefs());
process.exit(0);
