import { GROUP_EDGES, COL, columnSpec } from '../contract.mjs';
import type { ColumnId, Ref } from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import { formatRgba } from './tables.mjs';
import type { GroupDef } from './sheet.mjs';

// Round 34.5: the column readers `readProp` dispatches through.  These
// were five closures built *inside* `readProp`, so every style getter
// allocated them before running one case of a 145-case switch — and
// under tsx each allocation also paid esbuild's `__name` wrapper, an
// Object.defineProperty per closure, which is what made the getter look
// 13–21× v3 in round 33's suite instead of the 5.8× the bundle shows.
// Module scope: allocated once, and the switch reads the same columns.
type ColumnIdArg = Parameters<GraphStore['column']>[0];

/**
 * One scalar column value at `slot`, lane 0 (mirroring
 * `GraphStore.setScalar`): a multi-component column reads its first lane —
 * `edge.width` carries the arrow bits in lane 1 since round 56.
 */
export const readScalar = (
  store: GraphStore,
  slot: number,
  id: ColumnIdArg,
): number =>
  (store.column(id) as Float32Array | Uint32Array)[
    slot * columnSpec(id as ColumnId).components
  ];

/** Component `i` of a two-lane float column at `slot`. */
export const readPair = (
  store: GraphStore,
  slot: number,
  id: ColumnIdArg,
  i: 0 | 1,
): number => (store.column(id) as Float32Array)[slot * 2 + i];

/** An RGBA byte column at `slot` as its `rgb()`/`rgba()` string. */
export const readColor = (
  store: GraphStore,
  slot: number,
  id: ColumnIdArg,
): string => {
  const bytes = store.column(id) as Uint8Array;

  return formatRgba(
    bytes[slot * 4],
    bytes[slot * 4 + 1],
    bytes[slot * 4 + 2],
    bytes[slot * 4 + 3],
  );
};

/** The alpha byte of an RGBA column at `slot`. */
export const readAlpha = (
  store: GraphStore,
  slot: number,
  id: ColumnIdArg,
): number => (store.column(id) as Uint8Array)[slot * 4 + 3];

/** A packed RGBA word as its `rgb()`/`rgba()` string. */
export const packedColor = (packed: number): string =>
  formatRgba(
    packed & 0xff,
    (packed >>> 8) & 0xff,
    (packed >>> 16) & 0xff,
    (packed >>> 24) & 0xff,
  );

/**
 * An edge label's stored alphas carry the edge's element opacity
 * (115.6: the fold at style-write, since the edge label pipeline has no
 * buffer slot for the column).  The readers divide it back out so the
 * declared channel reads back; a fully transparent edge (nothing to
 * divide by) reads the packed value as stored.  Node labels store the
 * declared alpha — their column multiplies on the GPU.
 */
export const unfoldLabelAlpha = (
  store: GraphStore,
  slot: number,
  ref: Ref,
  packed: number,
): number => {
  if (ref.group !== GROUP_EDGES) {
    return packed;
  }

  const elementOp = readScalar(store, slot, COL.EDGE_OPACITY);

  if (elementOp <= 0 || elementOp >= 1) {
    return packed;
  }

  const a = Math.min(255, Math.round(((packed >>> 24) & 0xff) / elementOp));

  return ((packed & 0xffffff) | (a << 24)) >>> 0;
};

/** The alpha of a packed label colour word, to three decimals. */
export const labelAlphaOf = (packed: number): number =>
  Math.round((((packed >>> 24) & 0xff) / 255) * 1000) / 1000;

/*
Round 35.2: the stored-truth readback, as a dispatch table.

`readProp` used to answer all 150 readable property labels from a single
switch of the same size — a dispatch table written as control flow.  V8
does not hash a string switch that large: moving `border-width`'s case,
body untouched, from the sixth position to the tail cost it 56 → 90 ns
through the built bundle, so a property's read cost depended on where it
happened to sit in the file.

Here it is data.  One `Map.get` answers any property in the same time,
each reader is a small function that can be read on its own, and adding
a property is an entry rather than a position in a 524-line switch.  A
reader takes only the arguments it uses, in the order
`( store, slot, ref, engine, prop )` — `prop` is passed because nine
readers deliberately answer several labels and need to know which.
*/
/**
 * The slice of the engine a property reader may use.  A narrow context
 * rather than the engine itself, so the table can live at module scope
 * without any of `StyleEngine`'s privates becoming public: it is built
 * once per engine, and its getters keep it live across a sheet swap.
 */
export interface ReadContext {
  readonly store: GraphStore;
  readonly defs: { nodes: GroupDef; edges: GroupDef; parents: GroupDef };
  defFor(ref: Ref): GroupDef;
  labelChannels(ref: Ref): { fontSize: number; color: string };
  readImageProp(slot: number, prop: string): string | number;
}

export type PropReader = (
  store: GraphStore,
  slot: number,
  ref: Ref,
  engine: ReadContext,
  prop: string,
) => string | number | undefined;

export const PROP_READERS = new Map<string, PropReader>();

/** Register one reader under every property name it answers. */
export const defineReader = (names: string[], read: PropReader): void => {
  for (const name of names) {
    PROP_READERS.set(name, read);
  }
};
