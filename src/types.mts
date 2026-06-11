// Shared public types. This module grows as the TypeScript migration
// progresses; it must remain type-only (no runtime exports).

export interface Position {
  x: number;
  y: number;
}

/**
 * Minimal structural view of the Core instance, used by low-level modules
 * that are converted before src/core. Replaced by `import type Core` from
 * the real core module once it is converted.
 */
export interface CoreShim {
  zoom(): number;
  pan(): Position;
}
