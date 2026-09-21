// Core's graph-level `data()` and `scratch()` objects (round 130 split).

import type { Core } from '../core.mjs';

/** The shared getter/setter body of `data()` and `scratch()` over a plain object: whole-object read, keyed read, keyed write or object merge. */
export function _objectAccess(
  core: Core,
  target: Record<string, unknown>,
  args: [] | [string] | [string, unknown] | [Record<string, unknown>],
  event: string | null,
): unknown {
  const [key, value] = args;

  if (args.length === 0) {
    return target;
  }
  if (typeof key === 'string' && args.length === 1) {
    return target[key];
  }

  const patch: Record<string, unknown> =
    typeof key === 'string'
      ? { [key]: value }
      : (key as Record<string, unknown>);

  Object.assign(target, patch);

  if (event != null) {
    core.emit(event);
  }

  return core;
}

/** The shared body of `removeData()` and `removeScratch()`: delete the named keys, or every key when none are given. */
export function _objectRemove(
  core: Core,
  target: Record<string, unknown>,
  names: string | undefined,
  event: string | null,
): Core {
  const keys =
    names == null
      ? Object.keys(target)
      : names.split(/\s+/).filter((n) => n !== '');

  for (const k of keys) {
    delete target[k];
  }

  if (event != null && keys.length > 0) {
    core.emit(event);
  }

  return core;
}
