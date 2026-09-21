// Round 34.5: the normalization cache.  Every style read normalizes its
// property name first, and the regex replace plus lowercase allocation
// was **36% of `readProp`** in the built bundle — more than the
// 145-case switch it precedes.  The key space is the prop vocabulary (a
// few hundred names across both spellings), so the cache is bounded by
// the API rather than by anything a caller controls; the size guard
// keeps a caller that passes junk from growing it without bound, since
// an unknown name is normalized *before* it is rejected.
const NORMALIZED = new Map<string, string>();
const NORMALIZE_CACHE_MAX = 512;

/**
 * camelCase → kebab-case ('backgroundColor' → 'background-color'),
 * memoized (34.5).
 *
 * @param prop — a property name in either spelling; not validated here,
 *   which is why the memo is bounded (an unknown name is normalized
 *   before it is rejected, so a caller passing junk must not be able to
 *   grow the cache without limit)
 * @returns the kebab-case spelling — the key every prop table is keyed
 *   by.  An already-kebab name is returned unchanged, and an *unknown*
 *   name is normalized rather than rejected, since the rejection happens
 *   downstream against the normalized form
 */
export const normalizeProp = (prop: string): string => {
  const hit = NORMALIZED.get(prop);

  if (hit !== undefined) {
    return hit;
  }

  const normalized = prop.replace(/([A-Z])/g, '-$1').toLowerCase();

  if (NORMALIZED.size < NORMALIZE_CACHE_MAX) {
    NORMALIZED.set(prop, normalized);
  }

  return normalized;
};
