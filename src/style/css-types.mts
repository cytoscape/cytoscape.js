import type { EdgeSingular, NodeSingular } from '../collection/eles-types.mjs';
import type { Core } from '../core/core-types.mjs';

export declare namespace Css {
  type Colour = string;

  type MapperFunction<Element, Type> = ( ele: Element ) => Type;

  type PropertyValue<SingularType extends NodeSingular | EdgeSingular | Core, Type> =
    | Type
    | MapperFunction<SingularType, Type>;

  type PropertyValueNode<Type> = PropertyValue<NodeSingular, Type>;
  type PropertyValueEdge<Type> = PropertyValue<EdgeSingular, Type>;
  type PropertyValueCore<Type> = PropertyValue<Core, Type>;

  type NodeShape =
    | 'rectangle'
    | 'roundrectangle'
    | 'ellipse'
    | 'triangle'
    | 'pentagon'
    | 'hexagon'
    | 'heptagon'
    | 'octagon'
    | 'star'
    | 'barrel'
    | 'diamond'
    | 'vee'
    | 'rhomboid'
    | 'polygon'
    | 'tag'
    | 'round-rectangle'
    | 'round-triangle'
    | 'round-diamond'
    | 'round-pentagon'
    | 'round-hexagon'
    | 'round-heptagon'
    | 'round-octagon'
    | 'round-tag'
    | 'cut-rectangle'
    | 'bottom-round-rectangle'
    | 'concave-hexagon';

  type LineStyle = 'solid' | 'dotted' | 'dashed' | 'double';

  type ArrowShape =
    | 'tee'
    | 'vee'
    | 'triangle'
    | 'triangle-tee'
    | 'circle-triangle'
    | 'triangle-cross'
    | 'triangle-backcurve'
    | 'square'
    | 'circle'
    | 'diamond'
    | 'chevron'
    | 'none';

  type ArrowFill = 'filled' | 'hollow';

  type TransitionTimingFunction =
    | 'linear'
    | 'spring'
    | 'cubic-bezier'
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

  interface CommonElement {
    [name: string]: PropertyValueNode<unknown> | PropertyValueEdge<unknown> | undefined;
    display?: PropertyValueNode<'none' | 'element'> | PropertyValueEdge<'none' | 'element'>;
    visibility?: PropertyValueNode<'hidden' | 'visible'> | PropertyValueEdge<'hidden' | 'visible'>;
    opacity?: PropertyValueNode<number> | PropertyValueEdge<number>;
    events?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'text-events'?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'transition-property'?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'transition-duration'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'transition-delay'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'transition-timing-function'?: PropertyValueNode<TransitionTimingFunction> | PropertyValueEdge<TransitionTimingFunction>;
  }

  interface Node extends CommonElement {
    content?: PropertyValueNode<string>;
    width?: PropertyValueNode<number | string>;
    height?: PropertyValueNode<number | string>;
    shape?: PropertyValueNode<NodeShape>;
    'background-color'?: PropertyValueNode<Colour>;
    'background-blacken'?: PropertyValueNode<number>;
    'background-opacity'?: PropertyValueNode<number>;
    'background-fill'?: PropertyValueNode<'solid' | 'linear-gradient' | 'radial-gradient'>;
    'background-gradient-direction'?: PropertyValueNode<string>;
    'background-gradient-stop-colors'?: PropertyValueNode<string | string[]>;
    'background-gradient-stop-positions'?: PropertyValueNode<string | number[] | string[]>;
    'background-image'?: PropertyValueNode<string | string[]>;
    'background-fit'?: PropertyValueNode<'none' | 'contain' | 'cover' | Array<'none' | 'contain' | 'cover'>>;
    'background-repeat'?: PropertyValueNode<'no-repeat' | 'repeat-x' | 'repeat-y' | 'repeat' | Array<'no-repeat' | 'repeat-x' | 'repeat-y' | 'repeat'>>;
    'border-width'?: PropertyValueNode<number | string>;
    'border-style'?: PropertyValueNode<LineStyle>;
    'border-color'?: PropertyValueNode<Colour>;
    'border-opacity'?: PropertyValueNode<number>;
    'border-position'?: PropertyValueNode<'center' | 'inside' | 'outside'>;
    'border-cap'?: PropertyValueNode<'butt' | 'round' | 'square'>;
    'border-join'?: PropertyValueNode<'miter' | 'bevel' | 'round'>;
    'shape-polygon-points'?: PropertyValueNode<string | number[]>;
    'corner-radius'?: PropertyValueNode<string>;
    padding?: PropertyValueNode<string>;
    'padding-relative-to'?: PropertyValueNode<'width' | 'height' | 'average' | 'min' | 'max'>;
    ghost?: PropertyValueNode<'yes' | 'no'>;
    'pie-size'?: PropertyValueNode<number | string>;
    'stripe-size'?: PropertyValueNode<number | string>;
  }

  interface Edge extends CommonElement {
    width?: PropertyValueEdge<number | string>;
    'curve-style'?: PropertyValueEdge<'haystack' | 'straight' | 'straight-triangle' | 'bezier' | 'unbundled-bezier' | 'segments' | 'taxi' | 'round-taxi' | 'round-segments'>;
    'line-color'?: PropertyValueEdge<Colour>;
    'line-style'?: PropertyValueEdge<LineStyle>;
    'line-cap'?: PropertyValueEdge<'butt' | 'round' | 'square'>;
    'line-fill'?: PropertyValueEdge<'solid' | 'linear-gradient' | 'radial-gradient'>;
    'line-opacity'?: PropertyValueEdge<number>;
    'line-gradient-stop-colors'?: PropertyValueEdge<Colour[] | string>;
    'line-gradient-stop-positions'?: PropertyValueEdge<number[] | string>;
    'line-outline-width'?: PropertyValueEdge<number | string>;
    'line-outline-color'?: PropertyValueEdge<Colour>;
    'source-arrow-color'?: PropertyValueEdge<Colour>;
    'mid-source-arrow-color'?: PropertyValueEdge<Colour>;
    'target-arrow-color'?: PropertyValueEdge<Colour>;
    'mid-target-arrow-color'?: PropertyValueEdge<Colour>;
    'source-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'mid-source-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'target-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'mid-target-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'source-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'mid-source-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'target-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'mid-target-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'source-endpoint'?: PropertyValueEdge<string>;
    'target-endpoint'?: PropertyValueEdge<string>;
    'taxi-direction'?: PropertyValueEdge<'auto' | 'vertical' | 'downward' | 'upward' | 'horizontal' | 'rightward' | 'leftward'>;
  }

  interface Core {
    [name: string]: PropertyValueCore<unknown> | undefined;
    'active-bg-color'?: PropertyValueCore<Colour>;
    'active-bg-opacity'?: PropertyValueCore<number>;
    'active-bg-size'?: PropertyValueCore<number>;
    'selection-box-color'?: PropertyValueCore<Colour>;
    'selection-box-border-color'?: PropertyValueCore<Colour>;
    'selection-box-border-width'?: PropertyValueCore<number>;
    'selection-box-opacity'?: PropertyValueCore<number>;
    'outside-texture-bg-color'?: PropertyValueCore<Colour>;
    'outside-texture-bg-opacity'?: PropertyValueCore<number>;
  }
}