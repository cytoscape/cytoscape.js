// Detached application-facing mapper and chart metadata (round 147).

import {
  CHART_MAX_SLICES,
  CHART_NONE,
  CHART_PIE,
  CHART_STRIPES,
  GROUP_NODES,
  GROUP_EDGES,
  CHART_HEAT_STRIP,
  CHART_RADIAL_HEAT,
  CHART_BAR,
} from '../contract.mjs';
import type { Core } from '../core.mjs';
import type { LegendEntry, LegendGroup, Legend } from '../public-types.mjs';
import { isMapperSpec } from '../style-scales.mjs';
import { MAPPABLE } from '../style/mappable.mjs';
import { CHART_PROPS } from '../style/tables.mjs';
import { normalizeProp } from '../style/normalize.mjs';
import { PROP } from '../style-props.mjs';

const GROUPS: readonly LegendGroup[] = [GROUP_NODES, GROUP_EDGES, 'parents'];
const CHART_KEYS = new Set<string>([
  PROP.CHART,
  PROP.CHART_VALUES,
  PROP.CHART_COLORS,
  PROP.CHART_SCALE,
  PROP.CHART_DOMAIN,
  PROP.CHART_MISSING_COLOR,
  PROP.CHART_SIZE,
  PROP.CHART_HOLE,
  PROP.CHART_START_ANGLE,
  PROP.CHART_DIRECTION,
  PROP.CHART_OPACITY,
]);

const jsonCopy = <T,>(value: T): T =>
  value == null ? value : JSON.parse(JSON.stringify(value));

const sourceBlock = (core: Core, group: LegendGroup): Record<string, unknown> =>
  ((core._styleEngine.sheet as Record<string, unknown>)[group] ?? {}) as Record<
    string,
    unknown
  >;

const hasAuthored = (block: Record<string, unknown>, prop: string): boolean =>
  Object.keys(block).some((key) => normalizeProp(key) === prop);

const effectiveGroups = (
  group: LegendGroup,
  prop: string,
  blocks: Record<LegendGroup, Record<string, unknown>>,
): LegendGroup[] => {
  if (group === GROUP_NODES) {
    return hasAuthored(blocks.parents, prop)
      ? [GROUP_NODES]
      : [GROUP_NODES, 'parents'];
  }

  return [group];
};

const mapperFor = (core: Core, group: LegendGroup, prop: string) => {
  const def = core._styleEngine.defs[group];

  return def.mappers.find((bm) => bm.m.prop === prop)?.m ?? null;
};

const stopsFor = (mapper: ReturnType<typeof mapperFor>): number[] | null => {
  if (mapper == null) return null;
  const program = mapper.program;

  if (program.kind === 'continuous' || program.kind === 'discrete') {
    return program.resolvedDomain == null ? null : [...program.resolvedDomain];
  }

  return null;
};

const mappingEntry = (
  core: Core,
  group: LegendGroup,
  prop: string,
  authored: unknown,
  blocks: Record<LegendGroup, Record<string, unknown>>,
): LegendEntry | null => {
  if (!isMapperSpec(authored)) return null;

  const primary = mapperFor(core, group, prop);
  // chart-values and labels have their own passthrough paths and are not
  // scalar mapper programs. Chart metadata describes chart-values below.
  if (primary == null) return null;

  const source = authored as unknown as Record<string, unknown>;
  const program = primary.program;
  const isCase = program.kind === 'case';
  const isPassthrough = program.kind === 'passthrough';
  const scaled = program.kind === 'continuous' || program.kind === 'discrete';
  const appliesTo = effectiveGroups(group, prop, blocks);
  const resolvedDomains: Partial<Record<LegendGroup, number[] | null>> = {};

  for (const effective of appliesTo) {
    resolvedDomains[effective] = stopsFor(mapperFor(core, effective, prop));
  }

  const domain = source.domain ?? (scaled ? 'auto' : undefined);
  const scale = isCase
    ? undefined
    : (source.scale ??
      (scaled ? 'linear' : isPassthrough ? undefined : undefined));
  const status = isCase
    ? 'conditional'
    : isPassthrough
      ? 'passthrough'
      : scaled && !program.resolved
        ? 'unresolved'
        : 'resolved';

  const entry: LegendEntry = {
    id: `${group}:${prop}`,
    group,
    property: prop,
    kind: 'mapping',
    source: jsonCopy(source),
    status,
    appliesTo,
    missing: {
      usesChannelDefault: source.fallback === undefined,
      fallback:
        typeof source.fallback === 'string' ||
        typeof source.fallback === 'number'
          ? source.fallback
          : null,
    },
  };

  if (scale != null) entry.scale = String(scale);
  if (domain !== undefined)
    entry.domain = jsonCopy(domain) as LegendEntry['domain'];
  if (scaled) {
    entry.resolvedDomain = stopsFor(primary);
    if (appliesTo.length > 1) entry.resolvedDomains = resolvedDomains;
  }
  if (source.range !== undefined) {
    entry.range = jsonCopy(source.range) as LegendEntry['range'];
  }
  if (source.interpolate === 'oklab' || source.interpolate === 'srgb') {
    entry.interpolate = source.interpolate;
  }
  if (typeof source.clamp === 'boolean') entry.clamp = source.clamp;
  if (
    typeof source.fallback === 'string' ||
    typeof source.fallback === 'number'
  ) {
    entry.fallback = source.fallback;
  } else {
    entry.fallback = null;
  }

  return entry;
};

const chartTypeName = (kind: number): string =>
  kind === CHART_PIE
    ? 'pie'
    : kind === CHART_STRIPES
      ? 'stripes'
      : kind === CHART_HEAT_STRIP
        ? 'heat-strip'
        : kind === CHART_RADIAL_HEAT
          ? 'radial-heat'
          : kind === CHART_BAR
            ? 'bar'
            : 'none';

const chartEntry = (
  core: Core,
  group: LegendGroup,
  block: Record<string, unknown>,
  blocks: Record<LegendGroup, Record<string, unknown>>,
): LegendEntry | null => {
  const authoredChartProps = Object.keys(block)
    .map(normalizeProp)
    .filter((prop) => CHART_KEYS.has(prop));
  if (authoredChartProps.length === 0) return null;

  const def = core._styleEngine.defs[group];
  const values = Object.entries(block).find(
    ([key]) => normalizeProp(key) === PROP.CHART_VALUES,
  )?.[1];
  const valuesMapper = isMapperSpec(values)
    ? (values as { data?: unknown })
    : null;
  const rawChart = Object.entries(block).find(
    ([key]) => normalizeProp(key) === PROP.CHART,
  )?.[1];
  const chartMapper = isMapperSpec(rawChart);
  const chartKind =
    rawChart == null || chartMapper
      ? chartTypeName(def.computed.chartKind)
      : String(rawChart);
  const appliesTo = effectiveGroups(group, PROP.CHART, blocks);
  const chart: Record<string, unknown> = {
    type: chartMapper ? null : chartKind,
    source:
      valuesMapper && typeof valuesMapper.data === 'string'
        ? valuesMapper.data
        : null,
    slots: Array.isArray(values) ? values.length : CHART_MAX_SLICES,
    maxSlots: CHART_MAX_SLICES,
    palette:
      Object.entries(block).find(
        ([key]) => normalizeProp(key) === PROP.CHART_COLORS,
      )?.[1] ?? null,
    barGeometryDomain: def.computed.chartResolvedDomain,
    colorScale: def.computed.chartScaleSpec,
    colorDomain: (() => {
      const program = def.computed.chartScale?.program;
      return program != null &&
        (program.kind === 'continuous' || program.kind === 'discrete')
        ? program.resolvedDomain
        : null;
    })(),
    colorStatus: (() => {
      const program = def.computed.chartScale?.program;
      return program == null ||
        (program.kind !== 'continuous' && program.kind !== 'discrete')
        ? 'resolved'
        : program.resolved
          ? 'resolved'
          : 'unresolved';
    })(),
    missingColor: def.computed.chartMissingColor,
  };
  if (Array.isArray(values)) chart.values = jsonCopy(values);
  if (chartMapper) chart.typeSource = jsonCopy(rawChart);

  let observed = 0;
  let missing = 0;
  const liveSlots =
    group === 'parents' && !core._store.hasCompounds()
      ? []
      : core._styleEngine.allSlotsFor('nodes', def);
  for (const slot of liveSlots) {
    const rec = core._store.chartAt(slot);
    if (rec == null) continue;
    for (const value of rec.values) {
      observed++;
      if (value == null) missing++;
    }
  }
  chart.observations = observed;
  chart.missingValues = missing;

  for (const [key, value] of Object.entries(block)) {
    const prop = normalizeProp(key);
    if (
      CHART_KEYS.has(prop) &&
      prop !== PROP.CHART &&
      prop !== PROP.CHART_VALUES &&
      prop !== PROP.CHART_COLORS
    ) {
      chart[prop] = jsonCopy(value);
    }
  }

  const active =
    chartMapper ||
    (def.computed.chartKind !== CHART_NONE && def.computed.chartKind != null) ||
    values != null;
  if (!active) return null;

  return {
    id: `${group}:chart`,
    group,
    property: PROP.CHART,
    kind: 'chart',
    appliesTo,
    chart,
  };
};

const effectiveOrigin = (
  actual: LegendGroup,
  prop: string,
  blocks: Record<LegendGroup, Record<string, unknown>>,
): LegendGroup => {
  if (actual === 'parents') {
    return hasAuthored(blocks.parents, prop)
      ? 'parents'
      : hasAuthored(blocks.nodes, prop)
        ? GROUP_NODES
        : 'parents';
  }
  return actual;
};

const exceptionCounts = (
  core: Core,
  blocks: Record<LegendGroup, Record<string, unknown>>,
): Map<string, number> => {
  const counts = new Map<string, Set<string>>();

  for (const [id, props] of core._styleEngine.bypassRaw) {
    const ref = core._store.lookup(id);
    if (ref == null) continue;

    const actual: LegendGroup =
      ref.group === GROUP_EDGES
        ? GROUP_EDGES
        : core._styleEngine.defFor(ref) === core._styleEngine.defs.parents
          ? 'parents'
          : GROUP_NODES;

    for (const prop of Object.keys(props)) {
      const norm = normalizeProp(prop);
      const origin = effectiveOrigin(actual, norm, blocks);
      const key = `${origin}:${norm}`;
      const ids = counts.get(key) ?? new Set<string>();
      ids.add(id);
      counts.set(key, ids);
    }
  }

  return new Map([...counts].map(([key, ids]) => [key, ids.size]));
};

/** Build the per-instance shared legend from its installed definitions. */
export function buildLegend(core: Core): Legend {
  const blocks = Object.fromEntries(
    GROUPS.map((group) => [group, sourceBlock(core, group)]),
  ) as Record<LegendGroup, Record<string, unknown>>;
  const counts = exceptionCounts(core, blocks);
  const entries: LegendEntry[] = [];
  const known = new Set<string>();

  for (const group of GROUPS) {
    const block = blocks[group];

    for (const [key, value] of Object.entries(block)) {
      const prop = normalizeProp(key);
      const entry = mappingEntry(core, group, prop, value, blocks);

      if (entry != null) {
        entries.push(entry);
        known.add(`${group}:${prop}`);
      }

      if (CHART_KEYS.has(prop) && !known.has(`${group}:chart`)) {
        const chart = chartEntry(core, group, block, blocks);
        if (chart != null) {
          entries.push(chart);
          known.add(`${group}:chart`);
        }
      }
    }
  }

  // Bypasses do not create a per-element legend. A property-level entry
  // makes a mapped or chart property introduced only by bypass visible.
  for (const [key, elementCount] of counts) {
    if (elementCount === 0) continue;
    const [group, prop] = key.split(':') as [LegendGroup, string];
    const entryKey = `${group}:${prop}`;
    const existing = entries.find(
      (entry) =>
        (entry.id === entryKey ||
          (entry.kind === 'chart' && entry.group === group)) &&
        (entry.property === prop || entry.kind === 'chart'),
    );
    const exception = { properties: [prop], elementCount };

    if (existing != null) {
      (existing.exceptions ??= []).push(exception);
      continue;
    }

    const chartProperty = CHART_PROPS.has(prop);
    if (!chartProperty && MAPPABLE[prop] == null) continue;

    entries.push({
      id: entryKey,
      group,
      property: prop,
      kind: chartProperty ? 'chart' : 'mapping',
      status: 'exception-only',
      appliesTo: [group === 'parents' ? 'parents' : group],
      ...(chartProperty ? { chart: { exceptionOnly: true } } : {}),
      exceptions: [exception],
    });
  }

  // Existing scalar entries carry just their own property's bypass count.
  for (const entry of entries) {
    if (entry.status === 'exception-only' || entry.kind === 'chart') continue;
    const count = counts.get(`${entry.group}:${entry.property}`);
    if (count != null && count > 0) {
      entry.exceptions = [
        { properties: [entry.property], elementCount: count },
      ];
    }
  }

  return { entries };
}
