import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const COLUMNS = [
  'Category',
  'Feature',
  'Status',
  'Comments',
  'Reference',
];
export const STATUSES = {
  Implemented:
    'Available in the current v4 prototype; not a release-readiness claim.',
  Partial: 'Available with the limitations described in Comments.',
  Planned:
    'Explicitly scheduled or scoped in the development record; not implemented.',
  Proposed:
    'Suggested by the feature-direction review; not an approved scope or commitment.',
  'Not implemented':
    'Absent from the public v4 surface; no implementation commitment recorded.',
  Replaced: 'Use the v4 alternative named in Comments.',
  Excluded: 'Deliberately outside v4 scope, according to a recorded decision.',
  Undecided: 'An open design or scope decision remains.',
};

/** Strict CSV reader: quoted commas, doubled quotes, CRLF and multiline cells. */
export function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (c === ',' || c === '\n' || c === '\r') {
      finishCell();
      if (c !== ',') {
        rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (closed || (c === '"' && cell !== '')) {
      throw new Error(`features.csv: malformed quoting at character ${i + 1}`);
    } else if (c === '"') quoted = true;
    else cell += c;
  }
  if (quoted) throw new Error('features.csv: unterminated quoted field');
  if (cell !== '' || closed || row.length > 0) {
    finishCell();
    rows.push(row);
  }
  return rows;
}

/** Source references are repository-relative paths, optionally followed by :line. */
export function readInventory(
  root,
  csv = readFileSync(join(root, 'docs/features.csv'), 'utf8'),
) {
  const [header, ...records] = parseCsv(csv);
  if (JSON.stringify(header) !== JSON.stringify(COLUMNS)) {
    throw new Error(`features.csv: expected columns ${COLUMNS.join(',')}`);
  }
  if (records.length === 0) throw new Error('features.csv: empty inventory');
  const seen = new Set();
  return records.map((record, index) => {
    const fail = (why) => {
      throw new Error(`features.csv row ${index + 2}: ${why}`);
    };
    if (record.length !== COLUMNS.length) fail('expected five cells');
    const row = Object.fromEntries(COLUMNS.map((name, i) => [name, record[i]]));
    if (record.some((v) => v.trim() === '')) fail('every cell must be filled');
    if (!Object.hasOwn(STATUSES, row.Status))
      fail(`unknown status ${row.Status}`);
    const key = `${row.Category}\0${row.Feature}`;
    if (seen.has(key)) fail(`duplicate feature ${row.Feature}`);
    seen.add(key);
    const match = /^([\w./-]+?)(?::([1-9]\d*))?$/.exec(row.Reference);
    if (
      !match ||
      match[1].startsWith('/') ||
      match[1].split('/').includes('..')
    )
      fail('invalid reference');
    if (!existsSync(join(root, match[1])))
      fail(`missing reference ${row.Reference}`);
    if (
      match[2] &&
      Number(match[2]) >
        readFileSync(join(root, match[1]), 'utf8').split('\n').length
    )
      fail(`reference line out of range ${row.Reference}`);
    return row;
  });
}

/** v3's node/edge/element prefixes describe the same collection interface. */
export function apiName(name) {
  return name.replace(/^(ele|node|nodes|edge|edges)\./, 'eles.');
}

export function apiEntries(model) {
  const found = new Map();
  function visit(section, group = 'API') {
    for (const fn of section.fns ?? []) {
      for (const spelling of [fn.name, ...(fn.pureAliases ?? [])]) {
        const name = apiName(spelling);
        found.set(name, {
          ...fn,
          name,
          original: spelling,
          aliasOf: spelling === fn.name ? null : apiName(fn.name),
          group,
        });
      }
    }
    for (const child of section.sections ?? [])
      visit(child, child.name ?? group);
  }
  visit(model);
  return found;
}

/** Read the explicit v4 read registries and core compiler without importing the library. */
export function v4StyleNames(root) {
  // the readable-prop registries and the core sheet resolver live in
  // src/style/tables.mts since round 130 split style.mts
  const source = readFileSync(join(root, 'src/style/tables.mts'), 'utf8');
  // round 127: the registries name properties through the PROP table
  // (`PROP.BACKGROUND_COLOR`), so resolve each member against the table's
  // own text rather than importing it — the reader stays import-free
  const props = readFileSync(join(root, 'src/style-props.mts'), 'utf8');
  const table = new Map();
  for (const m of props.matchAll(/^\s+([A-Z_]+): '([^']+)',/gm)) {
    table.set(m[1], m[2]);
  }
  if (table.size === 0) throw new Error('Missing style property table PROP');
  const collect = (block, names) => {
    for (const m of block.matchAll(/PROP\.([A-Z_]+)/g)) {
      const name = table.get(m[1]);
      if (name == null) throw new Error(`Unknown style property PROP.${m[1]}`);
      names.add(name);
    }
    for (const m of block.matchAll(/'([^']+)'/g)) names.add(m[1]);
  };
  const names = new Set();
  for (const registry of ['NODE_READ', 'EDGE_READ']) {
    const block = source.match(
      new RegExp(`const ${registry}[^=]*= new Set\\(\\[([\\s\\S]*?)\\]\\)`),
    );
    if (!block) throw new Error(`Missing style registry ${registry}`);
    collect(block[1], names);
  }
  const core = source.slice(
    source.indexOf('const resolveCoreProps ='),
    source.indexOf('const GLOBAL_FONT_PROPS'),
  );
  const coreNames = new Set();
  for (const m of core.matchAll(/case (PROP\.[A-Z_]+|'[^']+')/g)) {
    collect(m[1], coreNames);
  }
  for (const name of coreNames) names.add(name);
  return names;
}

/** Frozen v3 property declarations, including its numbered chart families and aliases. */
export function v3StyleNames(root) {
  const source = readFileSync(
    join(root, 'v3/src/style/properties.mts'),
    'utf8',
  );
  const declarations = source.slice(
    source.indexOf('(function(){'),
    source.indexOf('// list of property names'),
  );
  const names = new Set(
    [...declarations.matchAll(/\bname: '([^']+)'\s*[,}]/g)].map((m) => m[1]),
  );
  for (const family of ['pie', 'stripe']) {
    const count = Number(
      declarations.match(
        new RegExp(`styfn\\.${family}BackgroundN = (\\d+)`),
      )?.[1],
    );
    if (!count) throw new Error(`Missing v3 ${family} count`);
    for (let i = 1; i <= count; i++) {
      for (const prop of ['color', 'size', 'opacity'])
        names.add(`${family}-${i}-background-${prop}`);
    }
  }
  for (const suffix of ['shape', 'color', 'fill', 'width']) {
    names.delete(`arrow-${suffix}`);
    for (const prefix of ['source', 'target', 'mid-source', 'mid-target'])
      names.add(`${prefix}-arrow-${suffix}`);
  }
  return names;
}

/** A new API member or property requires a reviewed row, never an inferred status. */
export function checkCoverage(rows, model, root) {
  const v4 = apiEntries(model);
  const v3 = apiEntries(
    JSON.parse(
      readFileSync(join(root, 'v3/documentation/docmaker.json'), 'utf8'),
    ),
  );
  const styles = v4StyleNames(root);
  const missing = [];
  for (const [category, names] of [
    ['API', new Set([...v4.keys(), ...v3.keys()])],
    ['Style', new Set([...styles, ...v3StyleNames(root)])],
  ]) {
    const present = new Set(
      rows.filter((r) => r.Category === category).map((r) => r.Feature),
    );
    for (const name of names)
      if (!present.has(name)) missing.push(`${category}: ${name}`);
  }
  if (missing.length)
    throw new Error(`Feature inventory missing rows: ${missing.join(', ')}`);
  for (const row of rows) {
    if (row.Category !== 'API' && row.Category !== 'Style') continue;
    const available =
      row.Category === 'API' ? v4.has(row.Feature) : styles.has(row.Feature);
    const supported = row.Status === 'Implemented' || row.Status === 'Partial';
    if (available !== supported)
      throw new Error(
        `Feature status disagrees with v4 surface: ${row.Feature} (${row.Status})`,
      );
  }
}
