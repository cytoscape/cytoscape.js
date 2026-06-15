import type { EdgeSingular, NodeSingular } from '../collection/eles-types.mjs';
// aliased so the namespace-local `Css.Core` property block (below) does not
// shadow the cytoscape instance type used by core-property mapper functions
import type { Core as CoreInstance } from '../core/core-types.mjs';

/**
 * Public style ("CSS") typing surface.
 *
 * GENERATED FILE — do not hand-edit the property blocks. It mirrors the runtime
 * style inventory in `src/style/properties.mts` (the source of truth for
 * property names and value families). Regenerate with `npm run gen:css-types`
 * after changing the style properties; `npm run test:types:css` audits that
 * this declaration set stays in sync with that inventory.
 */
export declare namespace Css {
  type Colour = string;

  type MapperFunction<Element, Type> = ( ele: Element ) => Type;

  type PropertyValue<SingularType extends NodeSingular | EdgeSingular | CoreInstance, Type> =
    | Type
    | MapperFunction<SingularType, Type>;

  type PropertyValueNode<Type> = PropertyValue<NodeSingular, Type>;
  type PropertyValueEdge<Type> = PropertyValue<EdgeSingular, Type>;
  type PropertyValueCore<Type> = PropertyValue<CoreInstance, Type>;

  type ArrowFill =
    | 'filled'
    | 'hollow';

  type ArrowShape =
    | 'tee'
    | 'triangle'
    | 'triangle-tee'
    | 'circle-triangle'
    | 'triangle-cross'
    | 'triangle-backcurve'
    | 'vee'
    | 'square'
    | 'circle'
    | 'diamond'
    | 'chevron'
    | 'none';

  type AxisDirection =
    | 'horizontal'
    | 'leftward'
    | 'rightward'
    | 'vertical'
    | 'upward'
    | 'downward'
    | 'auto';

  type AxisDirectionPrimary =
    | 'horizontal'
    | 'vertical';

  type BackgroundClip =
    | 'none'
    | 'node';

  type BackgroundContainment =
    | 'inside'
    | 'over';

  type BackgroundCrossOrigin =
    | 'anonymous'
    | 'use-credentials'
    | 'null';

  type BackgroundFit =
    | 'none'
    | 'contain'
    | 'cover';

  type BackgroundRelativeTo =
    | 'inner'
    | 'include-padding';

  type BackgroundRepeat =
    | 'repeat'
    | 'repeat-x'
    | 'repeat-y'
    | 'no-repeat';

  type BorderStyle =
    | 'solid'
    | 'dotted'
    | 'dashed'
    | 'double';

  type BoxSelection =
    | 'contain'
    | 'overlap'
    | 'none';

  type CompoundPosition =
    | 'parent'
    | 'origin';

  type CompoundSizingWrtLabels =
    | 'include'
    | 'exclude';

  type CurveStyle =
    | 'bezier'
    | 'unbundled-bezier'
    | 'haystack'
    | 'segments'
    | 'straight'
    | 'straight-triangle'
    | 'taxi'
    | 'round-segments'
    | 'round-taxi';

  type Display =
    | 'element'
    | 'none';

  type EdgeDistances =
    | 'intersection'
    | 'node-position'
    | 'endpoints';

  type Fill =
    | 'solid'
    | 'linear-gradient'
    | 'radial-gradient';

  type FontStyle =
    | 'italic'
    | 'normal'
    | 'oblique';

  type FontWeight =
    | 'normal'
    | 'bold'
    | 'bolder'
    | 'lighter'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '800'
    | '900'
    | 100
    | 200
    | 300
    | 400
    | 500
    | 600
    | 700
    | 800
    | 900;

  type GradientDirection =
    | 'to-bottom'
    | 'to-top'
    | 'to-left'
    | 'to-right'
    | 'to-bottom-right'
    | 'to-bottom-left'
    | 'to-top-right'
    | 'to-top-left'
    | 'to-right-bottom'
    | 'to-left-bottom'
    | 'to-right-top'
    | 'to-left-top';

  type HorizontalAlign =
    | 'left'
    | 'left-inside'
    | 'center'
    | 'right'
    | 'right-inside';

  type Justification =
    | 'left'
    | 'center'
    | 'right'
    | 'auto';

  type LineCap =
    | 'butt'
    | 'round'
    | 'square';

  type LineJoin =
    | 'round'
    | 'bevel'
    | 'miter';

  type LinePosition =
    | 'center'
    | 'inside'
    | 'outside';

  type LineStyle =
    | 'solid'
    | 'dotted'
    | 'dashed';

  type NodeShape =
    | 'rectangle'
    | 'roundrectangle'
    | 'round-rectangle'
    | 'cutrectangle'
    | 'cut-rectangle'
    | 'bottomroundrectangle'
    | 'bottom-round-rectangle'
    | 'barrel'
    | 'ellipse'
    | 'triangle'
    | 'round-triangle'
    | 'square'
    | 'pentagon'
    | 'round-pentagon'
    | 'hexagon'
    | 'round-hexagon'
    | 'concavehexagon'
    | 'concave-hexagon'
    | 'heptagon'
    | 'round-heptagon'
    | 'octagon'
    | 'round-octagon'
    | 'tag'
    | 'round-tag'
    | 'star'
    | 'diamond'
    | 'round-diamond'
    | 'vee'
    | 'rhomboid'
    | 'right-rhomboid'
    | 'polygon';

  type OverlayShape =
    | 'roundrectangle'
    | 'round-rectangle'
    | 'ellipse';

  type PaddingRelativeTo =
    | 'width'
    | 'height'
    | 'average'
    | 'min'
    | 'max';

  type RadiusType =
    | 'arc-radius'
    | 'influence-radius';

  type TextBackgroundShape =
    | 'rectangle'
    | 'roundrectangle'
    | 'round-rectangle'
    | 'circle';

  type TextMetrics =
    | 'font'
    | 'glyph';

  type TextOverflowWrap =
    | 'whitespace'
    | 'anywhere';

  type TextTransform =
    | 'none'
    | 'uppercase'
    | 'lowercase';

  type TextWrap =
    | 'none'
    | 'wrap'
    | 'ellipsis';

  type TransitionTimingFunction =
    | 'linear'
    | 'ease'
    | 'ease-in'
    | 'ease-out'
    | 'ease-in-out'
    | 'ease-in-sine'
    | 'ease-out-sine'
    | 'ease-in-out-sine'
    | 'ease-in-quad'
    | 'ease-out-quad'
    | 'ease-in-out-quad'
    | 'ease-in-cubic'
    | 'ease-out-cubic'
    | 'ease-in-out-cubic'
    | 'ease-in-quart'
    | 'ease-out-quart'
    | 'ease-in-out-quart'
    | 'ease-in-quint'
    | 'ease-out-quint'
    | 'ease-in-out-quint'
    | 'ease-in-expo'
    | 'ease-out-expo'
    | 'ease-in-out-expo'
    | 'ease-in-circ'
    | 'ease-out-circ'
    | 'ease-in-out-circ';

  type VerticalAlign =
    | 'top'
    | 'top-inside'
    | 'center'
    | 'bottom'
    | 'bottom-inside';

  type Visibility =
    | 'hidden'
    | 'visible';

  type ZCompoundDepth =
    | 'bottom'
    | 'orphan'
    | 'auto'
    | 'top';

  type ZIndexCompare =
    | 'auto'
    | 'manual';

  interface CommonElement {
    [name: string]: PropertyValueNode<unknown> | PropertyValueEdge<unknown> | undefined;
    events?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'text-events'?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'box-selection'?: PropertyValueNode<BoxSelection> | PropertyValueEdge<BoxSelection>;
    'transition-property'?: PropertyValueNode<string | string[]> | PropertyValueEdge<string | string[]>;
    'transition-duration'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'transition-delay'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'transition-timing-function'?: PropertyValueNode<TransitionTimingFunction> | PropertyValueEdge<TransitionTimingFunction>;
    display?: PropertyValueNode<Display> | PropertyValueEdge<Display>;
    visibility?: PropertyValueNode<Visibility> | PropertyValueEdge<Visibility>;
    opacity?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'min-zoomed-font-size'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'z-compound-depth'?: PropertyValueNode<ZCompoundDepth> | PropertyValueEdge<ZCompoundDepth>;
    'z-index-compare'?: PropertyValueNode<ZIndexCompare> | PropertyValueEdge<ZIndexCompare>;
    'z-index'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'overlay-padding'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'overlay-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'overlay-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'overlay-shape'?: PropertyValueNode<OverlayShape> | PropertyValueEdge<OverlayShape>;
    'overlay-corner-radius'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'underlay-padding'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'underlay-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'underlay-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'underlay-shape'?: PropertyValueNode<OverlayShape> | PropertyValueEdge<OverlayShape>;
    'underlay-corner-radius'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    ghost?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'ghost-offset-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'ghost-offset-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'ghost-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-valign'?: PropertyValueNode<VerticalAlign> | PropertyValueEdge<VerticalAlign>;
    'text-halign'?: PropertyValueNode<HorizontalAlign> | PropertyValueEdge<HorizontalAlign>;
    color?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-outline-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-outline-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-background-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-background-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-background-padding'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-border-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-border-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-border-width'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-border-style'?: PropertyValueNode<BorderStyle> | PropertyValueEdge<BorderStyle>;
    'text-background-shape'?: PropertyValueNode<TextBackgroundShape> | PropertyValueEdge<TextBackgroundShape>;
    'text-justification'?: PropertyValueNode<Justification> | PropertyValueEdge<Justification>;
    'text-metrics'?: PropertyValueNode<TextMetrics> | PropertyValueEdge<TextMetrics>;
    'box-select-labels'?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'font-family'?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'font-style'?: PropertyValueNode<FontStyle> | PropertyValueEdge<FontStyle>;
    'font-weight'?: PropertyValueNode<FontWeight> | PropertyValueEdge<FontWeight>;
    'font-size'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-transform'?: PropertyValueNode<TextTransform> | PropertyValueEdge<TextTransform>;
    'text-wrap'?: PropertyValueNode<TextWrap> | PropertyValueEdge<TextWrap>;
    'text-overflow-wrap'?: PropertyValueNode<TextOverflowWrap> | PropertyValueEdge<TextOverflowWrap>;
    'text-max-width'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-outline-width'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'line-height'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    label?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-margin-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-margin-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-label'?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'source-text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-text-margin-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-text-margin-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-text-offset'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-label'?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'target-text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-text-margin-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-text-margin-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-text-offset'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    content?: PropertyValueNode<string> | PropertyValueEdge<string>; // alias of 'label'
    'edge-text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>; // alias of 'text-rotation'
  }

  interface Node extends CommonElement {
    height?: PropertyValueNode<number | string>;
    width?: PropertyValueNode<number | string>;
    shape?: PropertyValueNode<NodeShape>;
    'shape-polygon-points'?: PropertyValueNode<string | number[]>;
    'corner-radius'?: PropertyValueNode<number | string>;
    'background-color'?: PropertyValueNode<Colour>;
    'background-fill'?: PropertyValueNode<Fill>;
    'background-opacity'?: PropertyValueNode<number>;
    'background-blacken'?: PropertyValueNode<number>;
    'background-gradient-stop-colors'?: PropertyValueNode<Colour | Colour[]>;
    'background-gradient-stop-positions'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-gradient-direction'?: PropertyValueNode<GradientDirection>;
    padding?: PropertyValueNode<number | string>;
    'padding-relative-to'?: PropertyValueNode<PaddingRelativeTo>;
    'bounds-expansion'?: PropertyValueNode<number | number[]>;
    'border-color'?: PropertyValueNode<Colour>;
    'border-opacity'?: PropertyValueNode<number>;
    'border-width'?: PropertyValueNode<number | string>;
    'border-style'?: PropertyValueNode<BorderStyle>;
    'border-cap'?: PropertyValueNode<LineCap>;
    'border-join'?: PropertyValueNode<LineJoin>;
    'border-dash-pattern'?: PropertyValueNode<number | number[]>;
    'border-dash-offset'?: PropertyValueNode<number>;
    'border-position'?: PropertyValueNode<LinePosition>;
    'outline-color'?: PropertyValueNode<Colour>;
    'outline-opacity'?: PropertyValueNode<number>;
    'outline-width'?: PropertyValueNode<number | string>;
    'outline-style'?: PropertyValueNode<BorderStyle>;
    'outline-offset'?: PropertyValueNode<number | string>;
    'background-image'?: PropertyValueNode<string | string[]>;
    'background-image-crossorigin'?: PropertyValueNode<BackgroundCrossOrigin>;
    'background-image-opacity'?: PropertyValueNode<number | number[]>;
    'background-image-containment'?: PropertyValueNode<BackgroundContainment>;
    'background-image-smoothing'?: PropertyValueNode<'yes' | 'no' | Array<'yes' | 'no'>>;
    'background-position-x'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-position-y'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-width-relative-to'?: PropertyValueNode<BackgroundRelativeTo>;
    'background-height-relative-to'?: PropertyValueNode<BackgroundRelativeTo>;
    'background-repeat'?: PropertyValueNode<BackgroundRepeat>;
    'background-fit'?: PropertyValueNode<BackgroundFit>;
    'background-clip'?: PropertyValueNode<BackgroundClip>;
    'background-width'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-height'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-offset-x'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-offset-y'?: PropertyValueNode<number | string | Array<number | string>>;
    'pie-size'?: PropertyValueNode<number | string>;
    'pie-hole'?: PropertyValueNode<number | string>;
    'pie-start-angle'?: PropertyValueNode<number | string>;
    'pie-1-background-color'?: PropertyValueNode<Colour>;
    'pie-1-background-size'?: PropertyValueNode<number | string>;
    'pie-1-background-opacity'?: PropertyValueNode<number>;
    'pie-2-background-color'?: PropertyValueNode<Colour>;
    'pie-2-background-size'?: PropertyValueNode<number | string>;
    'pie-2-background-opacity'?: PropertyValueNode<number>;
    'pie-3-background-color'?: PropertyValueNode<Colour>;
    'pie-3-background-size'?: PropertyValueNode<number | string>;
    'pie-3-background-opacity'?: PropertyValueNode<number>;
    'pie-4-background-color'?: PropertyValueNode<Colour>;
    'pie-4-background-size'?: PropertyValueNode<number | string>;
    'pie-4-background-opacity'?: PropertyValueNode<number>;
    'pie-5-background-color'?: PropertyValueNode<Colour>;
    'pie-5-background-size'?: PropertyValueNode<number | string>;
    'pie-5-background-opacity'?: PropertyValueNode<number>;
    'pie-6-background-color'?: PropertyValueNode<Colour>;
    'pie-6-background-size'?: PropertyValueNode<number | string>;
    'pie-6-background-opacity'?: PropertyValueNode<number>;
    'pie-7-background-color'?: PropertyValueNode<Colour>;
    'pie-7-background-size'?: PropertyValueNode<number | string>;
    'pie-7-background-opacity'?: PropertyValueNode<number>;
    'pie-8-background-color'?: PropertyValueNode<Colour>;
    'pie-8-background-size'?: PropertyValueNode<number | string>;
    'pie-8-background-opacity'?: PropertyValueNode<number>;
    'pie-9-background-color'?: PropertyValueNode<Colour>;
    'pie-9-background-size'?: PropertyValueNode<number | string>;
    'pie-9-background-opacity'?: PropertyValueNode<number>;
    'pie-10-background-color'?: PropertyValueNode<Colour>;
    'pie-10-background-size'?: PropertyValueNode<number | string>;
    'pie-10-background-opacity'?: PropertyValueNode<number>;
    'pie-11-background-color'?: PropertyValueNode<Colour>;
    'pie-11-background-size'?: PropertyValueNode<number | string>;
    'pie-11-background-opacity'?: PropertyValueNode<number>;
    'pie-12-background-color'?: PropertyValueNode<Colour>;
    'pie-12-background-size'?: PropertyValueNode<number | string>;
    'pie-12-background-opacity'?: PropertyValueNode<number>;
    'pie-13-background-color'?: PropertyValueNode<Colour>;
    'pie-13-background-size'?: PropertyValueNode<number | string>;
    'pie-13-background-opacity'?: PropertyValueNode<number>;
    'pie-14-background-color'?: PropertyValueNode<Colour>;
    'pie-14-background-size'?: PropertyValueNode<number | string>;
    'pie-14-background-opacity'?: PropertyValueNode<number>;
    'pie-15-background-color'?: PropertyValueNode<Colour>;
    'pie-15-background-size'?: PropertyValueNode<number | string>;
    'pie-15-background-opacity'?: PropertyValueNode<number>;
    'pie-16-background-color'?: PropertyValueNode<Colour>;
    'pie-16-background-size'?: PropertyValueNode<number | string>;
    'pie-16-background-opacity'?: PropertyValueNode<number>;
    'stripe-size'?: PropertyValueNode<number | string>;
    'stripe-direction'?: PropertyValueNode<AxisDirectionPrimary>;
    'stripe-1-background-color'?: PropertyValueNode<Colour>;
    'stripe-1-background-size'?: PropertyValueNode<number | string>;
    'stripe-1-background-opacity'?: PropertyValueNode<number>;
    'stripe-2-background-color'?: PropertyValueNode<Colour>;
    'stripe-2-background-size'?: PropertyValueNode<number | string>;
    'stripe-2-background-opacity'?: PropertyValueNode<number>;
    'stripe-3-background-color'?: PropertyValueNode<Colour>;
    'stripe-3-background-size'?: PropertyValueNode<number | string>;
    'stripe-3-background-opacity'?: PropertyValueNode<number>;
    'stripe-4-background-color'?: PropertyValueNode<Colour>;
    'stripe-4-background-size'?: PropertyValueNode<number | string>;
    'stripe-4-background-opacity'?: PropertyValueNode<number>;
    'stripe-5-background-color'?: PropertyValueNode<Colour>;
    'stripe-5-background-size'?: PropertyValueNode<number | string>;
    'stripe-5-background-opacity'?: PropertyValueNode<number>;
    'stripe-6-background-color'?: PropertyValueNode<Colour>;
    'stripe-6-background-size'?: PropertyValueNode<number | string>;
    'stripe-6-background-opacity'?: PropertyValueNode<number>;
    'stripe-7-background-color'?: PropertyValueNode<Colour>;
    'stripe-7-background-size'?: PropertyValueNode<number | string>;
    'stripe-7-background-opacity'?: PropertyValueNode<number>;
    'stripe-8-background-color'?: PropertyValueNode<Colour>;
    'stripe-8-background-size'?: PropertyValueNode<number | string>;
    'stripe-8-background-opacity'?: PropertyValueNode<number>;
    'stripe-9-background-color'?: PropertyValueNode<Colour>;
    'stripe-9-background-size'?: PropertyValueNode<number | string>;
    'stripe-9-background-opacity'?: PropertyValueNode<number>;
    'stripe-10-background-color'?: PropertyValueNode<Colour>;
    'stripe-10-background-size'?: PropertyValueNode<number | string>;
    'stripe-10-background-opacity'?: PropertyValueNode<number>;
    'stripe-11-background-color'?: PropertyValueNode<Colour>;
    'stripe-11-background-size'?: PropertyValueNode<number | string>;
    'stripe-11-background-opacity'?: PropertyValueNode<number>;
    'stripe-12-background-color'?: PropertyValueNode<Colour>;
    'stripe-12-background-size'?: PropertyValueNode<number | string>;
    'stripe-12-background-opacity'?: PropertyValueNode<number>;
    'stripe-13-background-color'?: PropertyValueNode<Colour>;
    'stripe-13-background-size'?: PropertyValueNode<number | string>;
    'stripe-13-background-opacity'?: PropertyValueNode<number>;
    'stripe-14-background-color'?: PropertyValueNode<Colour>;
    'stripe-14-background-size'?: PropertyValueNode<number | string>;
    'stripe-14-background-opacity'?: PropertyValueNode<number>;
    'stripe-15-background-color'?: PropertyValueNode<Colour>;
    'stripe-15-background-size'?: PropertyValueNode<number | string>;
    'stripe-15-background-opacity'?: PropertyValueNode<number>;
    'stripe-16-background-color'?: PropertyValueNode<Colour>;
    'stripe-16-background-size'?: PropertyValueNode<number | string>;
    'stripe-16-background-opacity'?: PropertyValueNode<number>;
    position?: PropertyValueNode<CompoundPosition>;
    'compound-sizing-wrt-labels'?: PropertyValueNode<CompoundSizingWrtLabels>;
    'min-width'?: PropertyValueNode<number | string>;
    'min-width-bias-left'?: PropertyValueNode<number | string>;
    'min-width-bias-right'?: PropertyValueNode<number | string>;
    'min-height'?: PropertyValueNode<number | string>;
    'min-height-bias-top'?: PropertyValueNode<number | string>;
    'min-height-bias-bottom'?: PropertyValueNode<number | string>;
    'padding-left'?: PropertyValueNode<number | string>; // alias of 'padding'
    'padding-right'?: PropertyValueNode<number | string>; // alias of 'padding'
    'padding-top'?: PropertyValueNode<number | string>; // alias of 'padding'
    'padding-bottom'?: PropertyValueNode<number | string>; // alias of 'padding'
  }

  interface Edge extends CommonElement {
    'line-style'?: PropertyValueEdge<LineStyle>;
    'line-color'?: PropertyValueEdge<Colour>;
    'line-fill'?: PropertyValueEdge<Fill>;
    'line-cap'?: PropertyValueEdge<LineCap>;
    'line-opacity'?: PropertyValueEdge<number>;
    'line-dash-pattern'?: PropertyValueEdge<number | number[]>;
    'line-dash-offset'?: PropertyValueEdge<number>;
    'line-outline-width'?: PropertyValueEdge<number | string>;
    'line-outline-color'?: PropertyValueEdge<Colour>;
    'line-gradient-stop-colors'?: PropertyValueEdge<Colour | Colour[]>;
    'line-gradient-stop-positions'?: PropertyValueEdge<number | string | Array<number | string>>;
    'curve-style'?: PropertyValueEdge<CurveStyle>;
    'haystack-radius'?: PropertyValueEdge<number>;
    'source-endpoint'?: PropertyValueEdge<string | number | Array<number | string>>;
    'target-endpoint'?: PropertyValueEdge<string | number | Array<number | string>>;
    'control-point-step-size'?: PropertyValueEdge<number | string>;
    'control-point-distances'?: PropertyValueEdge<number | string | Array<number | string>>;
    'control-point-weights'?: PropertyValueEdge<number | number[]>;
    'segment-distances'?: PropertyValueEdge<number | string | Array<number | string>>;
    'segment-weights'?: PropertyValueEdge<number | number[]>;
    'segment-radii'?: PropertyValueEdge<number | number[]>;
    'radius-type'?: PropertyValueEdge<RadiusType>;
    'taxi-turn'?: PropertyValueEdge<number | string>;
    'taxi-turn-min-distance'?: PropertyValueEdge<number | string>;
    'taxi-direction'?: PropertyValueEdge<AxisDirection>;
    'taxi-radius'?: PropertyValueEdge<number>;
    'edge-distances'?: PropertyValueEdge<EdgeDistances>;
    'arrow-scale'?: PropertyValueEdge<number>;
    'loop-direction'?: PropertyValueEdge<number | string>;
    'loop-sweep'?: PropertyValueEdge<number | string>;
    'source-distance-from-node'?: PropertyValueEdge<number | string>;
    'target-distance-from-node'?: PropertyValueEdge<number | string>;
    'source-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'mid-source-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'target-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'mid-target-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'source-arrow-color'?: PropertyValueEdge<Colour>;
    'mid-source-arrow-color'?: PropertyValueEdge<Colour>;
    'target-arrow-color'?: PropertyValueEdge<Colour>;
    'mid-target-arrow-color'?: PropertyValueEdge<Colour>;
    'source-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'mid-source-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'target-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'mid-target-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'source-arrow-width'?: PropertyValueEdge<number | string>;
    'mid-source-arrow-width'?: PropertyValueEdge<number | string>;
    'target-arrow-width'?: PropertyValueEdge<number | string>;
    'mid-target-arrow-width'?: PropertyValueEdge<number | string>;
    'control-point-distance'?: PropertyValueEdge<number | string | Array<number | string>>; // alias of 'control-point-distances'
    'control-point-weight'?: PropertyValueEdge<number | number[]>; // alias of 'control-point-weights'
    'segment-distance'?: PropertyValueEdge<number | string | Array<number | string>>; // alias of 'segment-distances'
    'segment-weight'?: PropertyValueEdge<number | number[]>; // alias of 'segment-weights'
    'segment-radius'?: PropertyValueEdge<number | number[]>; // alias of 'segment-radii'
  }

  interface Core {
    [name: string]: PropertyValueCore<unknown> | undefined;
    'selection-box-color'?: PropertyValueCore<Colour>;
    'selection-box-opacity'?: PropertyValueCore<number>;
    'selection-box-border-color'?: PropertyValueCore<Colour>;
    'selection-box-border-width'?: PropertyValueCore<number | string>;
    'active-bg-color'?: PropertyValueCore<Colour>;
    'active-bg-opacity'?: PropertyValueCore<number>;
    'active-bg-size'?: PropertyValueCore<number | string>;
    'outside-texture-bg-color'?: PropertyValueCore<Colour>;
    'outside-texture-bg-opacity'?: PropertyValueCore<number>;
  }
}
