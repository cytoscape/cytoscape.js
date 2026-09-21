// An animation's capture (round 130 split): on first tick the from-values
// and the channel writes are built from the current columns.  See
// `Animation` in ./animation.mts.

import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  columnSpec,
  FLAG_LOCKED,
  FLAG_PARENT,
} from '../contract.mjs';
import type { ColumnId, GroupName, Ref } from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import {
  TWEEN_COL,
  GROUPS,
  blankWrite,
  readScalar,
  readColor,
  packOklab,
} from './channels.mjs';
import type {
  RGBA,
  StyleChannel,
  TweenColumn,
  ChannelWrite,
} from './channels.mjs';
import type { Animation } from './animation.mjs';

/**
 * Resolve the animation into `ChannelWrite`s against the live elements.
 * Idempotent — the first capture wins, so a queued animation still picks
 * up the state its predecessor left, and a GPU-driven animation settles
 * against the values it registered with.
 */
export function capture(anim: Animation): void {
  if (anim.captured) {
    return;
  }

  anim.captured = true;

  for (const s of anim.style) {
    for (const group of GROUPS) {
      const column = s.channel.columns[group];

      if (column == null) {
        continue;
      }

      let refs = anim.refs.filter(
        (r) => r.group === group && anim.store.isCurrent(r),
      );

      // round 25.1: a compound parent's size is auto-bounds-derived —
      // width/height tweens skip parent slots (padding is the parent
      // knob; recorded); 25.4: padding conversely is parents-only
      const lane = s.channel.lanes?.[group];

      if (column === COL.NODE_SIZE) {
        refs = refs.filter(
          (r) => (anim.store.flags(GROUP_NODES, r.slot) & FLAG_PARENT) === 0,
        );
      } else if (column === TWEEN_COL.NODE_PADDING) {
        refs = refs.filter(
          (r) => (anim.store.flags(GROUP_NODES, r.slot) & FLAG_PARENT) !== 0,
        );
      } else if (
        column === TWEEN_COL.NODE_FONT_SIZE ||
        column === TWEEN_COL.EDGE_FONT_SIZE
      ) {
        // 25.5: only labelled elements have a fontSize to tween
        refs = refs.filter(
          (r) =>
            anim.store.labelAt(
              r.slot,
              r.group === GROUP_NODES ? GROUP_NODES : GROUP_EDGES,
            ) != null,
        );
      }

      if (refs.length === 0) {
        continue;
      }

      const paint = s.channel.tier === 'paint';

      anim.writes.push(
        s.channel.kind === 'color'
          ? colorWrite(
              anim,
              column as ColumnId,
              refs,
              paint,
              () => s.toColor as RGBA,
            )
          : column === TWEEN_COL.NODE_PADDING
            ? paddingWrite(anim, refs, s.toScalar as number, s.channel)
            : column === TWEEN_COL.NODE_FONT_SIZE ||
                column === TWEEN_COL.EDGE_FONT_SIZE
              ? fontSizeWrite(
                  anim,
                  column,
                  group,
                  refs,
                  s.toScalar as number,
                  s.channel,
                )
              : lane != null
                ? laneWrite(
                    anim,
                    column as ColumnId,
                    refs,
                    lane,
                    s.toScalar as number,
                    s.channel,
                  )
                : scalarWrite(
                    anim,
                    column as ColumnId,
                    refs,
                    paint,
                    s.toScalar as number,
                    s.channel,
                  ),
      );

      // edge opacity is pre-folded into the stored arrow alpha (the arrow
      // vertex stage has no spare storage binding for the opacity column),
      // so tweening it has to carry the arrows along.  The fold is linear
      // in opacity, so each arrow rides as a plain colour tween from its
      // stored bytes to base × the target opacity.
      if (column === COL.EDGE_OPACITY) {
        captureArrowFold(anim, refs, s.toScalar as number);
      }

      // 25.2: three derived channels bake the edge width at style-write
      // (all linear in width), so a width tween carries them along
      if (column === COL.EDGE_WIDTH) {
        captureEdgeWidthRides(anim, refs, s.toScalar as number);
      }
    }
  }

  if (anim.position != null && !anim.lockAll) {
    // locked nodes hold their place (114.3): the filter covers the
    // CPU write and the GPU tween batches built from it alike
    const refs = anim.refs.filter(
      (r) =>
        r.group === GROUP_NODES &&
        anim.store.isCurrent(r) &&
        !anim.store.hasFlag(GROUP_NODES, r.slot, FLAG_LOCKED),
    );

    if (refs.length > 0) {
      anim.writes.push(positionWrite(anim, refs));
    }
  }

  if (anim.viewport != null) {
    if (anim.pan != null) {
      anim.fromPan = { ...anim.viewport.pan() };
    }
    if (anim.zoom != null) {
      anim.fromZoom = anim.viewport.zoom();
    }
  }
}

/** The position channel write: the from-positions of the refs and the target position. */
export function positionWrite(anim: Animation, refs: Ref[]): ChannelWrite {
  const pos = anim.store.column(COL.NODE_POSITION) as Float32Array;
  const write = blankWrite(COL.NODE_POSITION, 'position', true, refs);

  for (let i = 0; i < refs.length; i++) {
    const x = pos[refs[i].slot * 2];
    const y = pos[refs[i].slot * 2 + 1];

    write.data[i * 4] = x;
    write.data[i * 4 + 1] = y;
    write.data[i * 4 + 2] = anim.position?.x ?? x;
    write.data[i * 4 + 3] = anim.position?.y ?? y;
  }

  return write;
}

/** A scalar channel write: the from-values read from the column and the constant target. */
export function scalarWrite(
  anim: Animation,
  column: ColumnId,
  refs: Ref[],
  paint: boolean,
  to: number,
  channel: StyleChannel,
): ChannelWrite {
  const write = blankWrite(
    column,
    'scalar',
    paint,
    refs,
    channel.min,
    channel.max,
  );

  for (let i = 0; i < refs.length; i++) {
    write.data[i * 2] = readScalar(anim.store, column, refs[i].slot);
    write.data[i * 2 + 1] = to;
  }

  return write;
}

/** Round 25.4: tween a parent's declared compound padding — from is
 * the stored declaration in its declared unit; the auto-bounds flush
 * resolves it per tick. */
export function paddingWrite(
  anim: Animation,
  refs: Ref[],
  to: number,
  channel: StyleChannel,
): ChannelWrite {
  const write = blankWrite(
    TWEEN_COL.NODE_PADDING,
    'padding',
    false,
    refs,
    channel.min,
    channel.max,
  );

  for (let i = 0; i < refs.length; i++) {
    write.data[i * 2] = anim.store.compoundStyleOf(refs[i].slot).padding;
    write.data[i * 2 + 1] = to;
  }

  return write;
}

/** Round 25.5: tween a label's font-size — from is the sidecar
 * entry's current value (refs are pre-filtered to labelled slots). */
export function fontSizeWrite(
  anim: Animation,
  column: TweenColumn,
  group: GroupName,
  refs: Ref[],
  to: number,
  channel: StyleChannel,
): ChannelWrite {
  const write = blankWrite(
    column,
    'fontSize',
    false,
    refs,
    channel.min,
    channel.max,
  );
  const stream = group === GROUP_NODES ? GROUP_NODES : GROUP_EDGES;

  for (let i = 0; i < refs.length; i++) {
    write.data[i * 2] =
      anim.store.labelAt(refs[i].slot, stream)?.fontSize ?? to;
    write.data[i * 2 + 1] = to;
  }

  return write;
}

/** Round 25: tween one component of a multi-lane column (node size).
 * Geometry-tier by construction — lane writes never offload. */
export function laneWrite(
  anim: Animation,
  column: ColumnId,
  refs: Ref[],
  lane: number,
  to: number,
  channel: StyleChannel,
): ChannelWrite {
  const write = blankWrite(
    column,
    'lane',
    false,
    refs,
    channel.min,
    channel.max,
  );
  const arr = anim.store.column(column) as Float32Array;
  const comps = columnSpec(column).components;

  write.lane = lane;

  for (let i = 0; i < refs.length; i++) {
    write.data[i * 2] = arr[refs[i].slot * comps + lane];
    write.data[i * 2 + 1] = to;
  }

  return write;
}

/** A colour channel write: the from-colours read from the column and the target, mixed in Oklab. */
export function colorWrite(
  anim: Animation,
  column: ColumnId,
  refs: Ref[],
  paint: boolean,
  to: (ref: Ref) => RGBA,
): ChannelWrite {
  const write = blankWrite(column, 'color', paint, refs);

  for (let i = 0; i < refs.length; i++) {
    packOklab(write.data, i * 8, readColor(anim.store, column, refs[i].slot));
    packOklab(write.data, i * 8 + 4, to(refs[i]));
  }

  return write;
}

/**
 * Ride-along writes for an edge-width tween (25.2): the derived
 * channels that resolve against the width at style-write, all linear
 * in it.  Strokes ride additively from stored truth
 * (to = stored + Δwidth — mapper-resolved paddings/outline widths
 * need no engine round trip), gated per slot on the layer being
 * enabled; hollow-arrow strokes ride by mode ('match-line' → the
 * target width, percent → pct × target; plain numbers never baked
 * the width, so they stay).  Arrow-width modes are constants-only
 * sheet props, answered by the engine.
 */
export function captureEdgeWidthRides(
  anim: Animation,
  refs: Ref[],
  toWidth: number,
): void {
  const store = anim.store;
  const width = store.column(COL.EDGE_WIDTH) as Float32Array;

  for (const column of [
    COL.EDGE_CASING,
    COL.EDGE_OVERLAY,
    COL.EDGE_UNDERLAY,
  ] as const) {
    const rec = store.column(column) as Uint32Array;
    const enabled = refs.filter((r) => rec[r.slot * 2] !== 0);

    if (enabled.length === 0) {
      continue;
    }

    const write = blankWrite(column, 'lane', false, enabled, 0, Infinity);

    write.lane = 1;

    for (let i = 0; i < enabled.length; i++) {
      const slot = enabled[i].slot;
      const stroke = rec[slot * 2 + 1] / 256;

      write.data[i * 2] = stroke;
      write.data[i * 2 + 1] = stroke + (toWidth - width[slot * 2]);
    }

    anim.writes.push(write);
  }

  const modes = anim.styleEngine?.arrowWidthModes();

  if (modes == null) {
    return;
  }

  const aw = store.column(COL.EDGE_ARROW_WIDTHS) as Float32Array;

  for (const [mode, lane] of [
    [modes.source, 0],
    [modes.target, 1],
  ] as const) {
    if (typeof mode === 'number') {
      continue;
    }

    const to = mode === 'match-line' ? toWidth : mode.percent * toWidth;
    const write = blankWrite(
      COL.EDGE_ARROW_WIDTHS,
      'lane',
      false,
      refs,
      0,
      Infinity,
    );

    write.lane = lane;

    for (let i = 0; i < refs.length; i++) {
      write.data[i * 2] = aw[refs[i].slot * 2 + lane];
      write.data[i * 2 + 1] = to;
    }

    anim.writes.push(write);
  }
}

/** Arrow colour writes that keep the pre-folded alpha in step with an edge-opacity tween. */
export function captureArrowFold(
  anim: Animation,
  refs: Ref[],
  toOpacity: number,
): void {
  const engine = anim.styleEngine;
  const ends = engine?.arrowEnds;

  if (engine == null || ends == null) {
    return;
  }

  for (const [enabled, column, colorProp] of [
    [ends.source, COL.EDGE_SOURCE_ARROW, PROP.SOURCE_ARROW_COLOR],
    [ends.target, COL.EDGE_TARGET_ARROW, PROP.TARGET_ARROW_COLOR],
  ] as const) {
    if (!enabled) {
      continue;
    }

    anim.writes.push(
      colorWrite(anim, column, refs, true, (ref) => {
        const [r, g, b, baseAlpha] = engine.arrowBase(ref, colorProp);
        // B1: the stored fold is base.a × opacity × line-opacity
        const lineOp = engine.lineOpacityConst();

        return [r, g, b, Math.round(baseAlpha * toOpacity * lineOp)];
      }),
    );
  }
}
