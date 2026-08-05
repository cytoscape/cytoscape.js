// Results → single-page HTML report (pure function, Node-testable).
//
// The page is fully self-contained: inline CSS + a small inline tooltip
// script, no external assets, opens from file://.  Times are plotted as
// dots on a log₁₀ axis (position encoding — bar *length* on a log axis
// would mislead), v3-vs-gpu groups as dumbbells sharing a row.  Light and
// dark modes are both styled; values also live in plain text/tables so
// nothing is gated on color or hover.

import { THEME_CSS, esc, fmtBytes } from '../scripts/theme.mjs';

// -- formatting ---------------------------------------------------------------


const sig3 = v => v >= 100 ? Math.round( v ).toString() : v.toPrecision( 3 );

export function fmtTime( ns ){
  if( !isFinite( ns ) ){ return '–'; }
  if( ns < 1e3 ) { return `${sig3( ns )} ns`; }
  if( ns < 1e6 ) { return `${sig3( ns / 1e3 )} µs`; }
  if( ns < 1e9 ) { return `${sig3( ns / 1e6 )} ms`; }

  return `${sig3( ns / 1e9 )} s`;
}

export function fmtSpeedup( x ){
  if( !isFinite( x ) ){ return '–'; }
  if( x >= 10 ){ return `${Math.round( x )}×`; }
  if( x >= 2 ){ return `${x.toFixed( 1 )}×`; }

  return `${x.toFixed( 2 )}×`;
}

// decade tick labels: exact powers of ten need no mantissa digits
const fmtTick = ns => fmtTime( ns ).replace( '.00 ', ' ' ).replace( '.0 ', ' ' );

const fmtN = n => n >= 1000 ? `${n / 1000}k` : String( n );

const fmtMin = ms => ms >= 60000 ? `${( ms / 60000 ).toFixed( 1 )} min` : `${( ms / 1000 ).toFixed( 1 )} s`;

// -- data shaping --------------------------------------------------------------

// merge jobs by (suite, n): the per-BENCH_OP 200k processes fold back into
// one section; groups keep first-seen order and dedupe by name
function toSections( jobs ){
  const byKey = new Map();

  for( const job of jobs ){
    const key = `${job.suite}|${job.n}`;
    let s = byKey.get( key );

    if( s == null ){
      s = { suite: job.suite, n: job.n, groups: [], groupNames: new Set(), durationMs: 0, note: null };
      byKey.set( key, s );
    }

    s.durationMs += job.durationMs ?? 0;
    s.note = s.note ?? job.note ?? null;

    for( const g of job.groups ){
      if( s.groupNames.has( g.name ) ){ continue; }

      s.groupNames.add( g.name );
      s.groups.push( g );
    }
  }

  return [ ...byKey.values() ];
}

// a group is a comparison pair when it holds exactly the v3/gpu benches
function pairOf( group ){
  const v3 = group.benches.find( b => b.name === 'v3' );
  const gpu = group.benches.find( b => b.name === 'gpu' );

  if( v3 == null || gpu == null || !( gpu.stats.p50 > 0 ) ){ return null; }

  return { v3, gpu, speedup: v3.stats.p50 / gpu.stats.p50 };
}

// -- axis ----------------------------------------------------------------------

function logAxis( values ){
  const lo = Math.floor( Math.log10( Math.min( ...values ) ) );
  const hi = Math.ceil( Math.log10( Math.max( ...values ) ) );
  const span = Math.max( hi - lo, 1 );
  const pos = v => ( ( Math.log10( v ) - lo ) / span ) * 100;
  const ticks = [];

  for( let d = lo; d <= hi; d++ ){ ticks.push( { value: Math.pow( 10, d ), pct: ( ( d - lo ) / span ) * 100 } ); }

  return { pos, ticks };
}

const gridlines = ticks => ticks
  .map( t => `<i class="grid" style="left:${t.pct.toFixed( 2 )}%"></i>` ).join( '' );

const axisBand = ( ticks, fmt ) => `<div class="row axis-row"><span></span><div class="axis">${
  ticks.map( t => `<b style="left:${t.pct.toFixed( 2 )}%">${esc( fmt( t.value ) )}</b>` ).join( '' )
}</div><span></span></div>`;

// -- chart fragments -------------------------------------------------------------

function dot( cls, pct, tip ){
  return `<i class="dot ${cls}" style="left:${pct.toFixed( 2 )}%" tabindex="0" data-tip="${esc( tip )}"></i>`;
}

const tipFor = ( side, stats ) =>
  `${side} — p50 ${fmtTime( stats.p50 )} · avg ${fmtTime( stats.avg )} · p99 ${fmtTime( stats.p99 )} · min ${fmtTime( stats.min )}`;

function pairRow( group, pair, axis ){
  const a = axis.pos( pair.gpu.stats.p50 );
  const b = axis.pos( pair.v3.stats.p50 );
  const lo = Math.min( a, b );
  const w = Math.abs( a - b );
  const losing = pair.speedup < 1;

  return `<div class="row">
    <span class="lbl" title="${esc( group.name )}">${esc( group.name )}</span>
    <div class="track">${gridlines( axis.ticks )}
      <i class="link" style="left:${lo.toFixed( 2 )}%;width:${w.toFixed( 2 )}%"></i>
      ${dot( 'v3', b, tipFor( 'v3', pair.v3.stats ) )}
      ${dot( 'gpu', a, tipFor( 'v4 (gpu)', pair.gpu.stats ) )}
    </div>
    <span class="val${losing ? ' losing' : ''}">${fmtSpeedup( pair.speedup )}</span>
  </div>`;
}

function benchRow( group, bench, axis ){
  const label = `${group.name} — ${bench.name}`;

  return `<div class="row">
    <span class="lbl" title="${esc( label )}">${esc( label )}</span>
    <div class="track">${gridlines( axis.ticks )}
      ${dot( 'gpu', axis.pos( bench.stats.p50 ), tipFor( bench.name, bench.stats ) )}
    </div>
    <span class="val">${fmtTime( bench.stats.p50 )}</span>
  </div>`;
}

function detailsTable( section ){
  const rows = section.groups.flatMap( g => g.benches.map( b => `<tr>
    <td>${esc( g.name )}</td><td>${esc( b.name )}</td>
    <td>${fmtTime( b.stats.p50 )}</td><td>${fmtTime( b.stats.avg )}</td>
    <td>${fmtTime( b.stats.p99 )}</td><td>${fmtTime( b.stats.min )}</td>
    <td>${b.stats.samples ?? '–'}</td>
  </tr>` ) ).join( '' );

  return `<details><summary>All stats (table view)</summary>
    <table><thead><tr><th>group</th><th>bench</th><th>p50</th><th>avg</th><th>p99</th><th>min</th><th>samples</th></tr></thead>
    <tbody>${rows}</tbody></table></details>`;
}

function sectionHtml( section ){
  const times = section.groups.flatMap( g => g.benches.map( b => b.stats.p50 ) ).filter( v => v > 0 );

  if( times.length === 0 ){ return ''; }

  const axis = logAxis( times );
  const hasPair = section.groups.some( g => pairOf( g ) != null );
  const rows = section.groups.map( g => {
    const pair = pairOf( g );

    return pair != null ? pairRow( g, pair, axis )
      : g.benches.map( b => benchRow( g, b, axis ) ).join( '' );
  } ).join( '' );

  const legend = hasPair
    ? `<span class="legend"><i class="key gpu"></i>v4 (gpu) <i class="key v3"></i>v3</span>`
    : '';

  return `<section>
    <h2>${esc( section.suite )} <small>N=${Number( section.n ).toLocaleString( 'en-US' )} · ${fmtMin( section.durationMs )}</small>${legend}</h2>
    ${section.note != null ? `<p class="note">${esc( section.note )}</p>` : ''}
    <div class="chart">${rows}${axisBand( axis.ticks, fmtTick )}</div>
    ${detailsTable( section )}
  </section>`;
}

// -- summary --------------------------------------------------------------------

function collectPairs( sections ){
  const pairs = [];

  for( const s of sections ){
    for( const g of s.groups ){
      const p = pairOf( g );

      if( p != null ){ pairs.push( { suite: s.suite, n: s.n, name: g.name, ...p } ); }
    }
  }

  return pairs;
}

function tiles( pairs, meta ){
  if( pairs.length === 0 ){ return ''; }

  const geo = Math.exp( pairs.reduce( ( sum, p ) => sum + Math.log( p.speedup ), 0 ) / pairs.length );
  const best = pairs.reduce( ( a, b ) => ( b.speedup > a.speedup ? b : a ) );
  const losing = pairs.filter( p => p.speedup < 1 ).length;

  const tile = ( label, value, sub ) => `<div class="tile">
    <span class="tile-label">${esc( label )}</span>
    <span class="tile-value">${value}</span>
    ${sub != null ? `<span class="tile-sub">${esc( sub )}</span>` : ''}
  </div>`;

  return `<div class="tiles">
    ${tile( 'Median speedup (geo-mean)', fmtSpeedup( geo ), `${pairs.length} v3-vs-gpu comparisons` )}
    ${tile( 'Biggest win', fmtSpeedup( best.speedup ), `${best.name} @ N=${fmtN( best.n )}` )}
    ${tile( 'v3 still ahead', String( losing ), losing === 1 ? 'comparison' : 'comparisons' )}
    ${tile( 'Total run time', fmtMin( meta.totalMs ?? 0 ), meta.profile === 'full' ? 'full profile' : 'quick profile' )}
  </div>`;
}

function overview( pairs ){
  if( pairs.length === 0 ){ return ''; }

  const sorted = [ ...pairs ].sort( ( a, b ) => b.speedup - a.speedup );
  const axis = logAxis( [ ...sorted.map( p => p.speedup ), 1 ] );
  const rows = sorted.map( p => {
    const label = `${p.name} @ ${fmtN( p.n )}`;
    const losing = p.speedup < 1;

    return `<div class="row">
      <span class="lbl" title="${esc( label )}">${esc( label )}</span>
      <div class="track">${gridlines( axis.ticks )}
        <i class="one" style="left:${axis.pos( 1 ).toFixed( 2 )}%"></i>
        ${dot( 'gpu', axis.pos( p.speedup ),
    `${fmtSpeedup( p.speedup )} — v3 p50 ${fmtTime( p.v3.stats.p50 )} vs gpu p50 ${fmtTime( p.gpu.stats.p50 )}` )}
      </div>
      <span class="val${losing ? ' losing' : ''}">${fmtSpeedup( p.speedup )}</span>
    </div>`;
  } ).join( '' );

  return `<section>
    <h2>Speedup overview <small>v3 p50 ÷ gpu p50, log scale · right of the 1× line = gpu faster</small></h2>
    <div class="chart">${rows}${axisBand( axis.ticks, v => `${v >= 1 ? Math.round( v ) : v}×` )}</div>
  </section>`;
}

// scaling table: per suite present at multiple N, speedup per group per N
function scaling( sections ){
  const bySuite = new Map();

  for( const s of sections ){
    if( !bySuite.has( s.suite ) ){ bySuite.set( s.suite, [] ); }

    bySuite.get( s.suite ).push( s );
  }

  const parts = [];

  for( const [ suite, list ] of bySuite ){
    if( list.length < 2 ){ continue; }

    const ns = list.map( s => s.n ).sort( ( a, b ) => a - b );
    const names = [ ...new Set( list.flatMap( s => s.groups.map( g => g.name ) ) ) ];
    const rows = names.map( name => {
      const cells = ns.map( n => {
        const sec = list.find( s => s.n === n );
        const g = sec?.groups.find( g => g.name === name );
        const p = g != null ? pairOf( g ) : null;

        return `<td>${p != null ? fmtSpeedup( p.speedup ) : '–'}</td>`;
      } ).join( '' );

      return `<tr><td>${esc( name )}</td>${cells}</tr>`;
    } ).join( '' );

    parts.push( `<h3>${esc( suite )}</h3>
      <table><thead><tr><th>group</th>${ns.map( n => `<th>×  @ N=${fmtN( n )}</th>` ).join( '' )}</tr></thead>
      <tbody>${rows}</tbody></table>` );
  }

  if( parts.length === 0 ){ return ''; }

  return `<section><h2>Scaling <small>speedup vs graph size</small></h2>${parts.join( '' )}</section>`;
}

// -- page -----------------------------------------------------------------------

const CSS = `
${THEME_CSS}
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 0 0 12px; }
h2 small, .meta { font-weight: 400; color: var(--ink-2); font-size: 13px; }
h3 { font-size: 13px; margin: 16px 0 6px; color: var(--ink-2); }
.note { font-size: 12px; color: var(--muted); margin: -4px 0 12px; max-width: 78ch; }
section {
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  padding: 16px 20px; margin: 16px 0; overflow-x: auto;
}
.legend { float: right; font-size: 12px; color: var(--ink-2); }
.key { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin: 0 4px 0 10px; }
.key.gpu, .dot.gpu { background: var(--gpu); }
.key.v3, .dot.v3 { background: var(--v3); }
.tiles { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
.tile {
  flex: 1 1 160px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 2px;
}
.tile-label { font-size: 12px; color: var(--ink-2); }
.tile-value { font-size: 26px; font-weight: 600; }
.tile-sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chart { min-width: 640px; }
.row { display: grid; grid-template-columns: minmax(200px, 300px) 1fr 76px; align-items: center; gap: 12px; height: 26px; }
.lbl { font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.val { font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; }
.val.losing::after { content: ' ▾'; color: var(--muted); }
.track { position: relative; height: 100%; }
.grid { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--grid); }
.one { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--baseline); }
.link { position: absolute; top: 50%; height: 2px; margin-top: -1px; background: var(--grid); }
.dot {
  position: absolute; top: 50%; width: 9px; height: 9px; border-radius: 50%;
  transform: translate(-50%, -50%); box-shadow: 0 0 0 2px var(--surface); cursor: default;
}
.dot:focus { outline: 2px solid var(--gpu); outline-offset: 2px; }
.axis-row { height: 18px; }
.axis { position: relative; height: 100%; }
.axis b {
  position: absolute; transform: translateX(-50%); font-weight: 400;
  font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap;
}
details { margin-top: 10px; }
summary { font-size: 12px; color: var(--ink-2); cursor: pointer; }
table { border-collapse: collapse; font-size: 12px; margin-top: 8px; }
th, td { text-align: left; padding: 3px 14px 3px 0; border-bottom: 1px solid var(--grid); }
th { color: var(--ink-2); font-weight: 500; }
td:not(:first-child), th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
.fail { color: #d03b3b; }
/* the machine table is prose, not figures: the generic right-align +
   tabular-nums above is for stats columns and reads badly on device strings */
.machine td { text-align: left; font-variant-numeric: normal; }
.machine th { white-space: nowrap; padding-right: 20px; vertical-align: top; }
.machine table { max-width: 78ch; }
.muted { color: var(--muted); }
#tip {
  position: fixed; display: none; max-width: 420px; padding: 6px 10px; font-size: 12px;
  background: var(--surface); color: var(--ink); border: 1px solid var(--border);
  border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); pointer-events: none; z-index: 10;
}
footer { color: var(--muted); font-size: 12px; margin-top: 24px; }
`;

const TIP_JS = `
const tip = document.getElementById('tip');
const show = ( el, x, y ) => {
  tip.textContent = el.getAttribute('data-tip');
  tip.style.display = 'block';
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(x + 12, innerWidth - r.width - 8) + 'px';
  tip.style.top = Math.min(y + 12, innerHeight - r.height - 8) + 'px';
};
addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip]');
  if( el ){ show(el, e.clientX, e.clientY); } else { tip.style.display = 'none'; }
});
addEventListener('focusin', e => {
  const el = e.target.closest('[data-tip]');
  if( el ){ const r = el.getBoundingClientRect(); show(el, r.left, r.bottom); }
});
addEventListener('focusout', () => { tip.style.display = 'none'; });
`;

/**
 * The provenance block: which box, which GPU, which commit.
 *
 * Returns `''` when `meta.machine` is absent, which is the backward
 * compatibility contract — every results file written before round 46.5 lacks
 * it, and the status site re-renders every published run it can find.  So this
 * is additive by construction rather than by care.
 */
function machineBlock( meta ){
  const m = meta.machine;

  if( m == null ){ return ''; }

  const cores = m.cpu?.physicalCores != null && m.cpu?.logicalCores != null
    ? `${m.cpu.physicalCores} physical / ${m.cpu.logicalCores} logical` : null;
  const clocks = [
    m.cpu?.baseGHz != null ? `${m.cpu.baseGHz} GHz base` : null,
    m.cpu?.maxGHz != null ? `${m.cpu.maxGHz} GHz max` : null
  ].filter( v => v != null ).join( ' · ' );

  const gpuRows = ( m.gpus ?? [] ).map( g => {
    const vram = fmtBytes( g.vramBytes );

    return [ g.model, vram != null ? `(${vram})` : null, g.driver ]
      .filter( v => v != null ).join( ' ' );
  } );

  // every value here is other programs' output — `lspci`'s device strings, a
  // git subject line, a WebGPU adapter description — so each is escaped as it
  // is placed.  The two rows that carry markup build it from escaped parts.
  // `esc` stringifies, so a null would render the word "null": hence `e`.
  const e = v => v == null || v === '' ? null : esc( v );
  const rows = [
    [ 'CPU', e( m.cpu?.model ) ],
    [ 'Cores', e( [ cores, clocks ].filter( v => v != null && v !== '' ).join( ' · ' ) ) ],
    [ 'Memory', e( fmtBytes( m.memory?.totalBytes ) ) ],
    [ 'GPU', gpuRows.length > 0 ? gpuRows.map( esc ).join( '<br>' ) : null ],
    // which adapter actually rendered — only a browser run knows, and only it
    // sets this; the GPU row above is the machine's inventory, not the choice
    [ 'Adapter', meta.adapter != null
      ? e( [ meta.adapter.vendor, meta.adapter.architecture || meta.adapter.description ]
        .filter( v => v != null && v !== '' ).join( ' ' ) ) : null ],
    [ 'Browser', m.browser != null ? e( `${m.browser.name} ${m.browser.version}` ) : null ],
    [ 'OS', e( [ m.os?.distro ?? m.os?.platform, m.os?.kernel, m.os?.arch ].filter( v => v != null ).join( ' · ' ) ) ],
    [ 'Node', m.node?.version != null ? e( `${m.node.version}${m.node.v8 ? ` (v8 ${m.node.v8})` : ''}` ) : null ],
    [ 'Commit', meta.commit != null
      ? esc( meta.commit )
        + ( meta.dirty === true ? ' <span class="fail">+ uncommitted changes</span>' : '' )
        + ( meta.commitSubject != null ? `<br><span class="muted">${esc( meta.commitSubject )}</span>` : '' )
      : null ],
    [ 'Machine id', e( m.fingerprint ) ]
  ].filter( ( [ , v ] ) => v != null && v !== '' );

  if( rows.length === 0 ){ return ''; }

  return `<details class="machine"><summary>Machine and provenance</summary>
    <table>${rows.map( ( [ k, v ] ) => `<tr><th>${esc( k )}</th><td>${v}</td></tr>` ).join( '' )}</table>
  </details>`;
}

export function renderReport( results ){
  const meta = results.meta ?? {};
  const sections = toSections( results.jobs ?? [] );
  const pairs = collectPairs( sections );

  const metaLine = [
    meta.date != null ? meta.date.replace( 'T', ' ' ).slice( 0, 16 ) : null,
    meta.commit != null ? `${meta.commit}${meta.branch ? ` (${meta.branch})` : ''}` : null,
    meta.cpu,
    meta.runtime != null ? `${meta.runtime} ${meta.nodeVersion ?? ''}`.trim() : meta.nodeVersion,
    meta.profile != null ? `${meta.profile} profile` : null
  ].filter( v => v != null ).map( esc ).join( ' · ' );

  const failures = ( meta.failures ?? [] ).length === 0 ? '' : `<section>
    <h2 class="fail">Failed jobs</h2>
    <ul>${meta.failures.map( f => `<li class="fail">${esc( f.job )} (exit ${esc( f.exitCode )})</li>` ).join( '' )}</ul>
  </section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cytoscape.js GPU benchmarks</title>
<style>${CSS}</style>
</head>
<body>
<h1>Cytoscape.js GPU benchmarks</h1>
<p class="meta">v4 (src/) vs v3 (v3/src/) · Mitata · times are per-iteration p50${metaLine ? ` · ${metaLine}` : ''}</p>
${machineBlock( meta )}
${failures}
${tiles( pairs, meta )}
${overview( pairs )}
${scaling( sections )}
${sections.map( sectionHtml ).join( '' )}
<footer>Generated by benchmark/report.mjs — hover or focus a dot for full stats; each section has a table view.</footer>
<div id="tip" role="status"></div>
<script>${TIP_JS}</script>
</body>
</html>`;
}
