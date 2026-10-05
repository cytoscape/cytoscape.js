// Definition-owned numeric chart scales. The shared mapper compiler and
// evaluator keep chart colours on the same CPU semantics as scalar styles.
import {
  applyAutoExtent,
  compileMapper,
  evaluateNumericProgram,
} from '../style-scales.mjs';
import type { CompiledMapper, Program } from '../style-scales.mjs';
import type { Mapper } from '../public-types.mjs';

export type ChartScaleSpec = Omit<Mapper, 'data'>;

/** Compile a chart-owned scale with the shared mapper compiler. @internal */
export function compileChartScale(value: unknown): {
  mapper: CompiledMapper;
  source: Record<string, unknown>;
} {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error("The 'chart-scale' value must be a scale object");
  }

  let source: Record<string, unknown>;
  try {
    source = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    throw new Error("The 'chart-scale' value must be JSON serializable");
  }

  if ('data' in source || 'case' in source || 'fallback' in source) {
    throw new Error(
      "'chart-scale' takes scale options only; data, case and fallback are unsupported",
    );
  }
  if (!Array.isArray(source.domain)) {
    throw new Error(
      "'chart-scale' requires an explicit domain array; use endpoint 'auto' for shared bounds",
    );
  }
  if (source.range == null) {
    throw new Error("'chart-scale' requires an explicit colour range");
  }

  const mapper = compileMapper(
    {
      ...(source as unknown as Omit<Mapper, 'data'>),
      data: '__chart_value__',
      scale: (source.scale ?? 'linear') as Mapper['scale'],
    } as Mapper,
    { kind: 'color', prop: 'chart-scale' },
  );

  if (
    mapper.program.kind === 'continuous' &&
    mapper.program.authoredDomain == null
  ) {
    throw new Error("'chart-scale' requires an explicit domain array");
  }

  return { mapper, source };
}

/** Apply the chart definition's shared value extent to its colour scale. @internal */
export const chartScaleExtent = (
  mapper: CompiledMapper | null,
  extent: [number, number] | null,
): boolean => {
  if (mapper == null) return false;
  const program = mapper.program;

  if (
    (program.kind === 'continuous' || program.kind === 'discrete') &&
    program.autoDomain
  ) {
    return applyAutoExtent(program, extent);
  }

  return false;
};

/** Resolve one chart value to its configured scale colour. @internal */
export const chartScaleColor = (
  program: Program | null,
  value: number,
): [number, number, number, number] | null => {
  if (program == null || !Number.isFinite(value)) return null;
  const result = evaluateNumericProgram(program, value);

  return Array.isArray(result)
    ? (result as [number, number, number, number])
    : null;
};
