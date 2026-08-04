// Shared structural types. Type-only (no runtime exports).
//
// Round 42 copied this from v3's `src/types.mts` when v4 became the package
// and v3 moved to `v3/`. Only the geometry types travelled: v3's `CoreShim`,
// `CollectionShim` and `ElementShim` were migration scaffolding for its own
// conversion order and mean nothing here.

export interface Position {
  x: number;
  y: number;
}

export interface BoundingBox12 {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BoundingBoxWH {
  w: number;
  h: number;
}

export type BoundingBox = BoundingBox12 & BoundingBoxWH;
