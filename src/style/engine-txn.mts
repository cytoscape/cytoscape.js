// StyleEngine's transition capture (round 130 split): a txn opens
// around an apply, diffs the transitioned channels and hands the tweens
// to the sink.

import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  columnSpec,
  FLAG_PARENT,
} from '../contract.mjs';
import { TWEEN_COL } from '../animation.mjs';
import { buildChannelWrite } from '../animation/channels.mjs';
import type { ChannelWrite } from '../animation.mjs';
import type { ColumnId, GroupName, Ref } from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import type { RGBA } from './defaults.mjs';
import { TRANSITION_CHANNELS, rgbaEq } from './compile.mjs';
import type { TxnChannelDesc, TxnCapture } from './compile.mjs';
import type { GroupDef } from './sheet.mjs';
import type { StyleEngine } from '../style.mjs';

/**
 * Open a transition capture for one group-def apply pass: every
 * already-styled slot the pass writes gets its tweenable channels
 * diffed on stored truth.  Null (capture off) when nothing can
 * transition — unconfigured specs cost nothing.
 */
export function openTxn(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
): TxnCapture | null {
  const spec = def.transition;

  if (engine.transitionSink == null || engine.txn != null) {
    return null;
  }
  if (spec.duration <= 0 || spec.props.length === 0) {
    return null;
  }

  const table = TRANSITION_CHANNELS[group];
  const channels: TxnCapture['channels'] = [];

  for (const prop of spec.props) {
    const ch = table[prop];

    // props with no tweenable channel (discrete) snap — the apply
    // pass already wrote them, so snapping is doing nothing here
    if (ch != null) {
      channels.push({ main: ch, rides: ch.rides ?? [] });
    }
  }

  // compound padding (25.4) diffs in the parents' compound-style
  // write, not the channel funnel — flag it as listed
  const padding = group === GROUP_NODES && spec.props.includes(PROP.PADDING);

  if (channels.length === 0 && !padding) {
    return null;
  }

  engine.txn = { group, spec, channels, entries: new Map(), padding };

  return engine.txn;
}

/** Close a capture: pack the accumulated diffs into bulk ChannelWrites
 * (one per column — never per-element animations) and hand them to the
 * sink as one transition animation. */
export function closeTxn(engine: StyleEngine, txn: TxnCapture | null): void {
  if (txn == null) {
    return;
  }

  engine.txn = null;

  if (txn.entries.size === 0) {
    return;
  }

  const writes: ChannelWrite[] = [];
  const refs: Ref[] = [];
  const seen = new Set<number>();

  for (const e of txn.entries.values()) {
    writes.push(
      buildChannelWrite(
        e.column,
        e.kind,
        e.paint,
        e.refs,
        e.from,
        e.to,
        e.min,
        e.max,
        e.lane,
      ),
    );

    for (const ref of e.refs) {
      if (!seen.has(ref.slot)) {
        seen.add(ref.slot);
        refs.push(ref);
      }
    }
  }

  engine.transitionSink!(refs, writes, {
    duration: txn.spec.duration,
    delay: txn.spec.delay,
    easing: txn.spec.easing,
  });
}

/** Read a transitioned channel's current value for the capture diff: the folded colour or scalar the writer would compare against. */
export function readTxnValue(
  engine: StyleEngine,
  ch: TxnChannelDesc,
  slot: number,
): number | RGBA {
  if (ch.kind === 'scalar') {
    return (engine.store.column(ch.column as ColumnId) as Float32Array)[slot];
  }

  if (ch.kind === 'fontSize') {
    // -1 = no sidecar entry (unlabelled); a diff with a sentinel on
    // either side snaps rather than tweening from/to nothing
    const stream =
      ch.column === TWEEN_COL.NODE_FONT_SIZE ? GROUP_NODES : GROUP_EDGES;

    return engine.store.labelAt(slot, stream)?.fontSize ?? -1;
  }

  if (ch.kind === 'lane') {
    // the edge layer records hold their stroke in lane 1, ×256
    // fixed-point (matching setLane's encode)
    if (
      ch.column === COL.EDGE_CASING ||
      ch.column === COL.EDGE_OVERLAY ||
      ch.column === COL.EDGE_UNDERLAY
    ) {
      return (
        (engine.store.column(ch.column) as Uint32Array)[slot * 2 + 1] / 256
      );
    }

    const arr = engine.store.column(ch.column as ColumnId) as Float32Array;

    return arr[
      slot * columnSpec(ch.column as ColumnId).components + (ch.lane as number)
    ];
  }

  const bytes = engine.store.column(ch.column as ColumnId) as Uint8Array;
  const i = slot * 4;

  return [bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]];
}

/** Pre-write snapshot of one slot's capture channels (mains + rides). */
export function txnPre(
  engine: StyleEngine,
  txn: TxnCapture,
  slot: number,
): (number | RGBA)[] {
  const out: (number | RGBA)[] = [];

  for (const { main, rides } of txn.channels) {
    out.push(readTxnValue(engine, main, slot));

    for (const r of rides) {
      out.push(readTxnValue(engine, r, slot));
    }
  }

  return out;
}

/**
 * Post-write diff of one slot: record each moved channel (from = the
 * snapshot, to = the newly stored value) and *restore* the old value —
 * the store holds the pre-restyle state until the tween's first
 * post-delay tick, so sync reads during a transition-delay report the
 * old value (CSS's rule) and no frame can flash the target.
 */
export function txnPost(
  engine: StyleEngine,
  txn: TxnCapture,
  group: GroupName,
  slot: number,
  pre: (number | RGBA)[],
): void {
  let i = 0;
  let ref: Ref | null = null;

  const record = (
    ch: TxnChannelDesc,
    from: number | RGBA,
    to: number | RGBA,
  ): void => {
    ref ??= engine.store.ref(group, slot);

    const key = ch.lane == null ? ch.column : `${ch.column}:${ch.lane}`;
    let entry = txn.entries.get(key);

    if (entry == null) {
      entry = {
        column: ch.column,
        kind: ch.kind,
        lane: ch.lane,
        paint: ch.paint,
        min: ch.min,
        max: ch.max,
        refs: [],
        from: [],
        to: [],
      };
      txn.entries.set(key, entry);
    }

    entry.refs.push(ref);
    entry.from.push(from);
    entry.to.push(to);

    if (ch.kind === 'scalar') {
      engine.store.setScalar(ch.column as ColumnId, slot, from as number);
    } else if (ch.kind === 'lane') {
      // the lane restore runs the full cascade (a node.size restore
      // re-anchors the label the apply pass just baked at the target)
      engine.store.setLane(
        ch.column as ColumnId,
        slot,
        ch.lane as number,
        from as number,
      );
    } else if (ch.kind === 'fontSize') {
      engine.store.setLabelFontSize(
        slot,
        ch.column === TWEEN_COL.NODE_FONT_SIZE ? GROUP_NODES : GROUP_EDGES,
        from as number,
      );
    } else {
      const [r, g, b, a] = from as RGBA;

      engine.store.setColor(ch.column as ColumnId, slot, r, g, b, a);
    }
  };

  const eq = (
    ch: TxnChannelDesc,
    a: number | RGBA,
    b: number | RGBA,
  ): boolean =>
    ch.kind === 'color'
      ? rgbaEq(a as RGBA, b as RGBA)
      : (a as number) === (b as number);

  // a compound parent's size is auto-bounds-derived: its lanes never
  // record (the tween would fight the derivation — round 25.3)
  const isParentSlot =
    group === GROUP_NODES &&
    engine.store.hasCompounds() &&
    engine.store.hasFlag(GROUP_NODES, slot, FLAG_PARENT);

  for (const { main, rides } of txn.channels) {
    const from = pre[i++];
    const to = readTxnValue(engine, main, slot);
    const skip =
      (isParentSlot && main.column === COL.NODE_SIZE) ||
      // a fontSize sentinel on either side means no sidecar entry to
      // tween from/to — the label change snaps (25.5)
      (main.kind === 'fontSize' &&
        ((from as number) < 0 || (to as number) < 0));
    const changed = !skip && !eq(main, from, to);

    if (changed) {
      record(main, from, to);
    }

    for (const r of rides) {
      const rideFrom = pre[i++];

      if (!changed) {
        continue;
      } // rides move only with their main channel

      const rideTo = readTxnValue(engine, r, slot);

      if (!eq(r, rideFrom, rideTo)) {
        record(r, rideFrom, rideTo);
      }
    }
  }
}
