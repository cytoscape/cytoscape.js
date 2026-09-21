// StyleEngine's per-element bypasses (round 130 split): validation,
// installation, the slot patches and the set/remove entry points.

import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';
import type { GroupName, Ref } from '../contract.mjs';
import type { Stylesheet } from '../public-types.mjs';
import type { Computed } from './defaults.mjs';
import { normalizeProp } from './normalize.mjs';
import { captureBypassPatch } from './apply-prop.mjs';
import type { BypassPatch } from './apply-prop.mjs';
import type { StyleEngine } from '../style.mjs';
import { applyBulk } from './engine-apply.mjs';

/** Validate a sheet's `bypasses` section into installable entries —
 * called before any engine state mutates, so a bad section throws
 * from `setSheet` with nothing half-applied. */
export function validateBypasses(
  engine: StyleEngine,
  section: Stylesheet['bypasses'],
): Map<
  string,
  {
    raw: Record<string, unknown>;
    parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
  }
> {
  const out = new Map<
    string,
    {
      raw: Record<string, unknown>;
      parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
    }
  >();

  if (section == null) {
    return out;
  }

  if (typeof section !== 'object' || Array.isArray(section)) {
    throw new Error(
      `The 'bypasses' section is an object of { id: { prop: constant } } entries`,
    );
  }

  for (const id of Object.keys(section)) {
    const entry = (section as Record<string, unknown>)[id];

    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(
        `Invalid bypass for '${id}': an entry is a { prop: constant } object`,
      );
    }

    const raw: Record<string, unknown> = {};

    for (const key of Object.keys(entry)) {
      raw[normalizeProp(key)] = (entry as Record<string, unknown>)[key];
    }

    out.set(id, { raw, parsed: parseBypassGroups(engine, id, raw) });
  }

  return out;
}

/** Parse one entry's props for both groups; a group whose guards
 * reject them parses null, and both rejecting is the caller's error. */
export function parseBypassGroups(
  engine: StyleEngine,
  id: string,
  raw: Record<string, unknown>,
): { nodes: BypassPatch | null; edges: BypassPatch | null } {
  let nodes: BypassPatch | null = null;
  let edges: BypassPatch | null = null;
  let nodesErr: unknown = null;

  try {
    nodes = captureBypassPatch(GROUP_NODES, raw);
  } catch (e) {
    nodesErr = e;
  }

  try {
    edges = captureBypassPatch(GROUP_EDGES, raw);
  } catch {
    // the nodes error carries the message when both reject
  }

  if (nodes == null && edges == null) {
    throw new Error(
      `Invalid bypass for '${id}': ${(nodesErr as Error).message}`,
    );
  }

  return { nodes, edges };
}

/** Install validated bypass entries (whole-replace — `setSheet`'s
 * swap semantics: the section is replaced like any other). */
export function installBypasses(
  engine: StyleEngine,
  entries: Map<
    string,
    {
      raw: Record<string, unknown>;
      parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
    }
  >,
): void {
  engine.bypassRaw.clear();
  engine.bypassParsed.clear();
  engine.bypassPropCounts.clear();
  engine.bypassEpoch = -1;

  for (const [id, { raw, parsed }] of entries) {
    engine.bypassRaw.set(id, raw);
    engine.bypassParsed.set(id, parsed);

    for (const norm of Object.keys(raw)) {
      engine.bypassPropCounts.set(
        norm,
        (engine.bypassPropCounts.get(norm) ?? 0) + 1,
      );
    }
  }
}

/** Re-resolve declared ids to live slots when the structure epoch
 * moved — O(declared ids) per structural change, amortized over the
 * writes between changes, and nothing at all when no bypass exists. */
export function rebuildBypassSlots(engine: StyleEngine): void {
  const epoch = engine.store.structureEpoch;

  if (epoch === engine.bypassEpoch) {
    return;
  }

  engine.bypassEpoch = epoch;
  engine.bypassSlots.nodes.clear();
  engine.bypassSlots.edges.clear();

  for (const [id, parsed] of engine.bypassParsed) {
    const ref = engine.store.lookup(id);

    if (ref == null) {
      continue; // declared for an id not present — inert until it is
    }

    const patch = parsed[ref.group];

    if (patch != null && patch.length > 0) {
      engine.bypassSlots[ref.group].set(ref.slot, patch);
    }
  }
}

/** The bypass patch for a slot, or null.  O(1) after the lazy
 * epoch-checked re-resolution. */
export function bypassPatchAt(
  engine: StyleEngine,
  group: GroupName,
  slot: number,
): BypassPatch | null {
  rebuildBypassSlots(engine);

  return engine.bypassSlots[group].get(slot) ?? null;
}

/**
 * Clone-and-patch: the write funnel's bypass merge (round 63.3).  A
 * method rather than an inline spread so specs can count invocations
 * — a bypass-free instance must never reach it, which is the
 * performance contract's zero-cost gate made testable.
 *
 * @param computed — the slot's sheet-resolved record (never mutated)
 * @param patch — the captured field pairs for the slot's bypass
 * @returns a fresh record with the bypassed fields replaced
 * @internal
 */
export function mergeBypass(
  engine: StyleEngine,
  computed: Computed,
  patch: BypassPatch,
): Computed {
  const merged = { ...computed } as unknown as Record<string, unknown>;

  for (let i = 0; i < patch.length; i++) {
    merged[patch[i][0] as string] = patch[i][1];
  }

  return merged as unknown as Computed;
}

/** Patch one slot's entry in the resolved maps after a sugar write —
 * only when the maps are current (stale maps re-resolve wholesale at
 * the next write anyway). */
export function refreshBypassSlot(
  engine: StyleEngine,
  ref: Ref,
  id: string,
): void {
  if (engine.bypassEpoch !== engine.store.structureEpoch) {
    return;
  }

  const parsed = engine.bypassParsed.get(id);
  const patch = parsed == null ? null : parsed[ref.group];

  if (patch != null && patch.length > 0) {
    engine.bypassSlots[ref.group].set(ref.slot, patch);
  } else {
    engine.bypassSlots[ref.group].delete(ref.slot);
  }
}

/**
 * Set bypass props for one live element — the sugar path behind
 * `ele.style( name, value )` (round 63.4).  Unlike the sheet
 * section, whose entries parse against both groups because their ids
 * may not have resolved yet, this validates against the element's
 * own group, so a wrong-group prop throws with the group's own
 * message.  The slot re-applies through the normal single-slot apply
 * afterwards, which is what makes transitions and the write-funnel
 * merge ride the same path every restyle does.
 *
 * @param ref — the live element's ref (the caller validates liveness)
 * @param id — its id, the declaration key
 * @param props — prop → constant, dash-case or camelCase
 * @throws on a mapper value, a global font prop, a transition config
 *   prop, a wrong-group prop, or an invalid value
 */
export function setBypass(
  engine: StyleEngine,
  ref: Ref,
  id: string,
  props: Record<string, unknown>,
): void {
  const raw: Record<string, unknown> = {};

  for (const key of Object.keys(props)) {
    raw[normalizeProp(key)] = props[key];
  }

  // validate against the element's own group before any state mutates
  captureBypassPatch(ref.group, raw);

  const prev = engine.bypassRaw.get(id);
  const merged = { ...(prev ?? {}), ...raw };

  engine.bypassRaw.set(id, merged);
  engine.bypassParsed.set(id, parseBypassGroups(engine, id, merged));

  let countsMoved = false;

  for (const norm of Object.keys(raw)) {
    if (prev == null || !(norm in prev)) {
      const n = engine.bypassPropCounts.get(norm) ?? 0;

      engine.bypassPropCounts.set(norm, n + 1);

      if (n === 0) {
        countsMoved = true;
      }
    }
  }

  refreshBypassSlot(engine, ref, id);

  if (countsMoved) {
    engine.paintVersion++;
  }

  // a first bypass on a kernel-owned channel demotes it, and the
  // kernel stops writing — every slot's stored bytes for that channel
  // must become CPU-derived, which one whole-group apply does (paid
  // once per 0→1 transition of a kernel-owned prop; never headless,
  // where nothing is kernel-owned)
  if (
    countsMoved &&
    Object.keys(raw).some((p) => engine.gpuOwnedProps[ref.group].has(p))
  ) {
    applyBulk(engine, ref.group, engine.store.slotsOrdered(ref.group));
  } else {
    applyBulk(engine, ref.group, [ref.slot]);
  }
}

/**
 * Remove bypass props for one live element — the path behind
 * `ele.removeStyle( name? )` (round 63.4).  Removing re-applies the
 * slot, so the sheet-resolved values return through the normal
 * funnel (transitions included).
 *
 * @param ref — the live element's ref
 * @param id — its id, the declaration key
 * @param name — the prop to remove, either spelling; omit to clear
 *   the element's whole declaration
 */
export function removeBypass(
  engine: StyleEngine,
  ref: Ref,
  id: string,
  name?: string,
): void {
  const prev = engine.bypassRaw.get(id);

  if (prev == null) {
    return;
  }

  let removed: string[];

  if (name == null) {
    removed = Object.keys(prev);
    engine.bypassRaw.delete(id);
    engine.bypassParsed.delete(id);
  } else {
    const norm = normalizeProp(name);

    if (!(norm in prev)) {
      return;
    }

    delete prev[norm];
    removed = [norm];

    if (Object.keys(prev).length === 0) {
      engine.bypassRaw.delete(id);
      engine.bypassParsed.delete(id);
    } else {
      engine.bypassParsed.set(id, parseBypassGroups(engine, id, prev));
    }
  }

  let countsMoved = false;

  for (const norm of removed) {
    const n = engine.bypassPropCounts.get(norm) ?? 0;

    if (n <= 1) {
      engine.bypassPropCounts.delete(norm);
      countsMoved = true;
    } else {
      engine.bypassPropCounts.set(norm, n - 1);
    }
  }

  refreshBypassSlot(engine, ref, id);

  if (countsMoved) {
    // a 1→0 transition hands the channel back to the kernel (it
    // re-evaluates every slot on its next dispatch, so no CPU
    // re-derive is owed here)
    engine.paintVersion++;
  }

  applyBulk(engine, ref.group, [ref.slot]);
}
