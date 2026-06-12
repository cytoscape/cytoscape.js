// Shared public types. This module grows as the TypeScript migration
// progresses; it must remain type-only (no runtime exports).

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

/**
 * Minimal structural view of the Core instance, used by low-level modules
 * that are converted before src/core. Replaced by `import type Core` from
 * the real core module once it is converted.
 */
export interface CoreShim {
  zoom(): number;
  pan(): Position;
}

/**
 * Minimal structural view of a Collection, used by low-level modules that
 * are converted before src/collection. Replaced by the real Collection
 * type once it is converted.
 */
export interface CollectionShim {
  instanceString(): string;
  _private: { single: boolean };
}

/** A Collection holding exactly one element. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- distinct name documents intent; gains members as the migration progresses
export interface ElementShim extends CollectionShim {}
