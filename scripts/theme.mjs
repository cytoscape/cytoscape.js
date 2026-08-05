// Round 46.5: the design tokens the benchmark report and the status site share.
//
// Extracted from `benchmark/report-html.mjs`, which defined them, so the two
// artifacts read as one system rather than two pages that happen to be near
// each other.  The report keeps inlining the string at render time, so it stays
// self-contained and openable from `file://` — a property its own spec asserts.
//
// Values are unchanged from the report's originals.  `--accent` and `--warn`
// are new, for the status site's links and its staleness warnings.

/** The `:root` + `body` custom properties, light and dark. */
export const THEME_CSS = `
:root { color-scheme: light dark; }
body {
  margin: 0; padding: 24px 32px 48px;
  font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: var(--page); color: var(--ink);
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e;
  --muted: #898781; --grid: #e1e0d9; --baseline: #c3c2b7;
  --border: rgba(11,11,11,0.10); --gpu: #2a78d6; --v3: #eb6834;
  --accent: #2a78d6; --warn: #b06a12;
}
@media (prefers-color-scheme: dark) {
  body {
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7;
    --muted: #898781; --grid: #2c2c2a; --baseline: #383835;
    --border: rgba(255,255,255,0.10); --gpu: #3987e5; --v3: #d95926;
    --accent: #6fb0ff; --warn: #e0a458;
  }
}`;

/**
 * HTML-escape.  Stringifies, so callers with nullable values want a wrapper:
 * `esc( null )` is the text "null", which is a bug every time.
 */
export const esc = s => String( s )
  .replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' )
  .replace( /"/g, '&quot;' );

/** `esc`, but `null` for anything empty — the form most call sites want. */
export const escOr = v => v == null || v === '' ? null : esc( v );

/** Bytes as the nearest binary unit; `null` for anything not a positive size. */
export function fmtBytes( n ){
  if( !Number.isFinite( n ) || n <= 0 ){ return null; }

  const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
  let i = 0;
  let v = n;

  while( v >= 1024 && i < units.length - 1 ){ v /= 1024; i++; }

  return `${v >= 100 || i === 0 ? Math.round( v ) : v.toFixed( 1 )} ${units[ i ]}`;
}

/**
 * A duration as an age — '3 hours ago', '2 days ago'.
 *
 * The status site prints a benchmark's *age* rather than only its date, so a
 * stale number looks stale at a glance instead of requiring arithmetic.
 */
export function fmtAge( ms ){
  if( !Number.isFinite( ms ) || ms < 0 ){ return null; }

  const units = [
    [ 'year', 365 * 24 * 3600e3 ], [ 'month', 30 * 24 * 3600e3 ],
    [ 'day', 24 * 3600e3 ], [ 'hour', 3600e3 ], [ 'minute', 60e3 ]
  ];

  for( const [ name, size ] of units ){
    const n = Math.floor( ms / size );

    if( n >= 1 ){ return `${n} ${name}${n === 1 ? '' : 's'} ago`; }
  }

  return 'just now';
}
