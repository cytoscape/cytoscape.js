import { GROUP_NODES } from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import { formatRgba } from './tables.mjs';
import {
  TEXT_WRAP_NAMES,
  OFLOW_WRAP_NAMES,
  JUSTIFICATION_NAMES,
  TEXT_TRANSFORM_NAMES,
  TEXT_BG_SHAPE_NAMES,
  HALIGN_NAMES,
  VALIGN_NAMES,
} from './parse.mjs';
import { textRotationName } from './parse-edge.mjs';
import {
  packedColor,
  unfoldLabelAlpha,
  labelAlphaOf,
  defineReader,
} from './readers.mjs';

// label visual props (constants; sidecar when labelled, else the sheet
// constants — opacities read back folded into the stored alpha, like
// arrow colors)
defineReader(
  [PROP.TEXT_OUTLINE_WIDTH],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.outlineWidth ??
    engine.defFor(ref).computed.textOutlineWidth,
);

defineReader([PROP.TEXT_OUTLINE_COLOR], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? packedColor(unfoldLabelAlpha(store, slot, ref, entry.outlineColor))
    : formatRgba(...engine.defFor(ref).computed.textOutlineColor);
});

defineReader(
  [PROP.TEXT_TRANSFORM],
  (store, slot, ref, engine) =>
    TEXT_TRANSFORM_NAMES[engine.defFor(ref).computed.textTransform] ?? 'none',
);

defineReader([PROP.TEXT_WRAP], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return (
    TEXT_WRAP_NAMES[
      entry != null ? entry.wrap : engine.defFor(ref).computed.textWrap
    ] ?? 'none'
  );
});

defineReader([PROP.TEXT_MAX_WIDTH], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.maxWidth
    : engine.defFor(ref).computed.textMaxWidth;
});

defineReader([PROP.LINE_HEIGHT], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.lineHeight
    : engine.defFor(ref).computed.lineHeight;
});

defineReader([PROP.TEXT_OVERFLOW_WRAP], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return (
    OFLOW_WRAP_NAMES[
      entry != null
        ? entry.overflowWrap
        : engine.defFor(ref).computed.textOverflowWrap
    ] ?? 'whitespace'
  );
});

defineReader([PROP.TEXT_JUSTIFICATION], (store, slot, ref, engine) => {
  // the sidecar stores the *resolved* justification; the sheet's
  // declared value (incl. 'auto') is what reads back, as v3
  return (
    JUSTIFICATION_NAMES[engine.defFor(ref).computed.textJustification] ?? 'auto'
  );
});

defineReader([PROP.TEXT_BACKGROUND_SHAPE], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return (
    TEXT_BG_SHAPE_NAMES[
      entry != null ? entry.bgShape : engine.defFor(ref).computed.textBgShape
    ] ?? 'rectangle'
  );
});

defineReader([PROP.TEXT_BORDER_WIDTH], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.bgBorderWidth
    : engine.defFor(ref).computed.textBorderWidth;
});

defineReader([PROP.MIN_ZOOMED_FONT_SIZE], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.minZoomedFontSize
    : engine.defFor(ref).computed.minZoomedFontSize;
});

defineReader([PROP.TEXT_HALIGN], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, GROUP_NODES);

  return HALIGN_NAMES[
    entry != null
      ? entry.halignShift * 2 + 1
      : engine.defs.nodes.computed.textHalign
  ];
});

defineReader([PROP.TEXT_VALIGN], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, GROUP_NODES);

  return VALIGN_NAMES[
    entry != null
      ? entry.valignShift * 2 + 2
      : engine.defs.nodes.computed.textValign
  ];
});

defineReader([PROP.TEXT_BORDER_COLOR], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? packedColor(unfoldLabelAlpha(store, slot, ref, entry.bgBorderColor))
    : formatRgba(...engine.defFor(ref).computed.textBorderColor);
});

defineReader([PROP.TEXT_BORDER_OPACITY], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? labelAlphaOf(unfoldLabelAlpha(store, slot, ref, entry.bgBorderColor))
    : engine.defFor(ref).computed.textBorderOpacity;
});

defineReader([PROP.TEXT_OPACITY], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  if (entry == null) {
    return engine.defFor(ref).computed.textOpacity;
  }

  return labelAlphaOf(unfoldLabelAlpha(store, slot, ref, entry.color));
});

defineReader([PROP.TEXT_OUTLINE_OPACITY], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? labelAlphaOf(unfoldLabelAlpha(store, slot, ref, entry.outlineColor))
    : engine.defFor(ref).computed.textOutlineOpacity;
});

defineReader([PROP.TEXT_BACKGROUND_COLOR], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? packedColor(unfoldLabelAlpha(store, slot, ref, entry.bgColor))
    : formatRgba(...engine.defFor(ref).computed.textBgColor);
});

defineReader([PROP.TEXT_BACKGROUND_OPACITY], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? labelAlphaOf(unfoldLabelAlpha(store, slot, ref, entry.bgColor))
    : engine.defFor(ref).computed.textBgOpacity;
});

defineReader(
  [PROP.TEXT_BACKGROUND_PADDING],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.bgPadding ??
    engine.defFor(ref).computed.textBgPadding,
);

defineReader(
  [PROP.TEXT_MARGIN_X],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.marginX ??
    engine.defFor(ref).computed.textMarginX,
);

defineReader(
  [PROP.TEXT_MARGIN_Y],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.marginY ??
    engine.defFor(ref).computed.textMarginY,
);

defineReader([PROP.TEXT_ROTATION], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  // stored truth: the sidecar keeps the flag and the angle apart
  return entry != null
    ? entry.rotate
      ? 'autorotate'
      : textRotationName(entry.rotation)
    : textRotationName(engine.defFor(ref).computed.textRotation);
});

defineReader(
  [
    PROP.SOURCE_LABEL,
    PROP.SOURCE_TEXT_OFFSET,
    PROP.SOURCE_TEXT_MARGIN_X,
    PROP.SOURCE_TEXT_MARGIN_Y,
    PROP.SOURCE_TEXT_ROTATION,
    PROP.TARGET_LABEL,
    PROP.TARGET_TEXT_OFFSET,
    PROP.TARGET_TEXT_MARGIN_X,
    PROP.TARGET_TEXT_MARGIN_Y,
    PROP.TARGET_TEXT_ROTATION,
  ],
  (store, slot, ref, engine, prop) => {
    // end labels (D4): the stored stream entry, else the sheet value
    const src = prop.startsWith('source');
    const entry = store.labelAt(slot, src ? 'edgeSource' : 'edgeTarget');
    const d = engine.defs.edges.computed;

    if (prop.endsWith('-label')) {
      return entry?.text ?? '';
    }

    if (prop.endsWith('-offset')) {
      return entry != null
        ? entry.endOffset
        : src
          ? d.sourceTextOffset
          : d.targetTextOffset;
    }

    if (prop.endsWith('-margin-x')) {
      return entry != null
        ? entry.marginX
        : src
          ? d.sourceTextMarginX
          : d.targetTextMarginX;
    }

    if (prop.endsWith('-margin-y')) {
      return entry != null
        ? entry.marginY
        : src
          ? d.sourceTextMarginY
          : d.targetTextMarginY;
    }

    return entry != null
      ? entry.rotate
        ? 'autorotate'
        : textRotationName(entry.rotation)
      : textRotationName(src ? d.sourceTextRotation : d.targetTextRotation);
  },
);
