//#region src/types.d.mts
interface Position$1 {
  x: number;
  y: number;
}
interface BoundingBox12$1 {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface BoundingBoxWH$1 {
  w: number;
  h: number;
}
type BoundingBox$1 = BoundingBox12$1 & BoundingBoxWH$1;
/**
 * Minimal structural view of the Core instance, used by low-level modules
 * that are converted before src/core. Replaced by `import type Core` from
 * the real core module once it is converted.
 */
interface CoreShim {
  zoom(): number;
  pan(): Position$1;
}
/**
 * Minimal structural view of a Collection, used by low-level modules that
 * are converted before src/collection. Replaced by the real Collection
 * type once it is converted.
 */
interface CollectionShim {
  instanceString(): string;
  _private: {
    single: boolean;
  };
}
//#endregion
//#region src/promise.d.mts
/*!
Embeddable Minimum Strictly-Compliant Promises/A+ 1.1.1 Thenable
Copyright (c) 2013-2014 Ralf S. Engelschall (http://engelschall.com)
Licensed under The MIT License (http://opensource.org/licenses/MIT)
*/
/**
 * The structural subset of the Promise API provided by both the native
 * `Promise` and the Thenable polyfill (construct with executor, `then`,
 * `resolve`, `reject`, `all`).
 */
interface PromiseLikeObject<T> {
  then<TResult1 = T, TResult2 = never>(onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLikeObject<TResult1 | TResult2>;
}
//#endregion
//#region src/animation.d.mts
interface AnimationStyleProp {
  name: string;
}
/**
 * Animation options as accepted by `.animate()` / `.animation()`. The
 * same bag, plus bookkeeping fields, becomes the animation's `_private`
 * state.
 */
interface AnimationOptions$1 {
  duration?: number | 'slow' | 'fast';
  style?: AnimationStyleProp[] | Record<string, unknown>;
  css?: AnimationStyleProp[] | Record<string, unknown>;
  queue?: boolean;
  complete?: () => void;
  step?: () => void;
  delay?: number;
  easing?: string;
  position?: Position$1;
  renderedPosition?: Position$1;
  startPosition?: Position$1;
  startStyle?: Record<string, AnimationStyleProp>;
  pan?: Position$1;
  panBy?: Position$1;
  startPan?: Position$1;
  zoom?: number | Record<string, unknown> | null;
  startZoom?: number;
  center?: {
    eles: unknown;
  };
  centre?: {
    eles: unknown;
  };
  fit?: {
    eles?: unknown;
    boundingBox?: unknown;
    padding?: number;
  };
}
/**
 * Structural view of what an Animation animates: a Core or a single
 * element. Refined to the real types when src/core and src/collection
 * are converted.
 */
interface AnimationTarget {
  _private: {
    animation: {
      current: Animation$1[];
      queue: Animation$1[];
    };
  };
}
declare class Animation$1 {
  length: number;
  [index: number]: Animation$1;
  constructor(target: AnimationTarget, opts?: AnimationOptions$1, opts2?: AnimationOptions$1);
  instanceString(): string;
  play(): this;
  playing(): boolean;
  apply(): this;
  applying(): boolean;
  pause(): this;
  stop(): this;
  rewind(): this;
  fastforward(): this;
  time(): number;
  time(t: number): this;
  progress(): number;
  progress(p: number): this;
  completed(): boolean;
  reverse(): this;
  promise(type?: string): PromiseLikeObject<void>;
  complete: this['completed'];
  run: this['play'];
  running: this['playing'];
}
//#endregion
//#region src/selector/type.d.mts
/**
 * A check type enum-like object.  Uses integer values for fast match() lookup.
 * The ordering does not matter as long as the ints are unique.
 */
declare const Type: {
  /** E.g. node */
  readonly GROUP: 0;
  /** A collection of elements */
  readonly COLLECTION: 1;
  /** A filter(ele) function */
  readonly FILTER: 2;
  /** E.g. [foo > 1] */
  readonly DATA_COMPARE: 3;
  /** E.g. [foo] */
  readonly DATA_EXIST: 4;
  /** E.g. [?foo] */
  readonly DATA_BOOL: 5;
  /** E.g. [[degree > 2]] */
  readonly META_COMPARE: 6;
  /** E.g. :selected */
  readonly STATE: 7;
  /** E.g. #foo */
  readonly ID: 8;
  /** E.g. .foo */
  readonly CLASS: 9;
  /** E.g. #foo <-> #bar */
  readonly UNDIRECTED_EDGE: 10;
  /** E.g. #foo -> #bar */
  readonly DIRECTED_EDGE: 11;
  /** E.g. $#foo -> #bar */
  readonly NODE_SOURCE: 12;
  /** E.g. #foo -> $#bar */
  readonly NODE_TARGET: 13;
  /** E.g. $#foo <-> #bar */
  readonly NODE_NEIGHBOR: 14;
  /** E.g. #foo > #bar */
  readonly CHILD: 15;
  /** E.g. #foo #bar */
  readonly DESCENDANT: 16;
  /** E.g. $#foo > #bar */
  readonly PARENT: 17;
  /** E.g. $#foo #bar */
  readonly ANCESTOR: 18;
  /** E.g. #foo > $bar > #baz */
  readonly COMPOUND_SPLIT: 19;
  /** Always matches, useful placeholder for subject in `COMPOUND_SPLIT` */
  readonly TRUE: 20;
};
/** The integer value of one of the `Type` check types */
type QueryType = typeof Type[keyof typeof Type];
/** A filter(ele) function, as used by `Type.FILTER` checks */
type FilterFn = (ele: SelectorEle) => boolean;
/**
 * Structural view of an element as used by selector matching.  N.b. selector
 * code relies on first-element semantics of collections (e.g. `ele.parent()`
 * is matched like an element), so this shape covers both.
 */
interface SelectorEle {
  group(): string;
  id(): string;
  hasClass(className: string): boolean;
  data(field: string): unknown;
  collection(): SelectorCollection;
  isNode(): boolean;
  source(): SelectorEle;
  target(): SelectorEle;
  parent(): SelectorEle;
  children(): SelectorCollection;
  ancestors(): SelectorCollection;
  descendants(): SelectorCollection;
  neighborhood(): SelectorCollection;
  outgoers(): SelectorCollection;
  incomers(): SelectorCollection;
  selected(): boolean;
  selectable(): boolean;
  locked(): boolean;
  visible(): boolean;
  transparent(): boolean;
  grabbed(): boolean;
  removed(): boolean;
  grabbable(): boolean;
  animated(): boolean;
  active(): boolean;
  backgrounding(): boolean;
  isParent(): boolean;
  isChildless(): boolean;
  isChild(): boolean;
  isOrphan(): boolean;
  isLoop(): boolean;
  isSimple(): boolean;
}
/** Structural view of a collection of elements as used by the selector module */
interface SelectorCollection {
  some(fn: (ele: SelectorEle) => boolean): boolean;
  has(ele: SelectorEle): boolean;
  getElementById(id: string): SelectorEle;
  filter(fn: (ele: SelectorEle) => boolean): SelectorCollection;
  collection(): SelectorCollection;
}
/**
 * A single check made against an ele to test for a match.  Only `type` is
 * always present; which other fields are set depends on the value of `type`
 * (see the `populate()` functions in ./expressions.mts and the `match[]`
 * functions in ./query-type-match.mts).
 */
interface Check {
  /** The type enum (int) of the check */
  type: QueryType;
  /** Group, state, id, class, or data value -- or the collection/filter fn for `COLLECTION`/`FILTER` checks */
  value?: string | number | SelectorCollection | FilterFn;
  /** Data or metadata field name (`DATA_*`, `META_COMPARE`) */
  field?: string;
  /** Comparator or boolean operator (`DATA_COMPARE`, `DATA_BOOL`, `META_COMPARE`) */
  operator?: string;
  /** Edge source query (`DIRECTED_EDGE`, `NODE_SOURCE`, `NODE_TARGET`) */
  source?: Query;
  /** Edge target query (`DIRECTED_EDGE`, `NODE_SOURCE`, `NODE_TARGET`) */
  target?: Query;
  /** Endpoint queries (`UNDIRECTED_EDGE`); nulled when rewritten to `NODE_NEIGHBOR` */
  nodes?: Query[] | null;
  /** Subject node query (`NODE_NEIGHBOR`) */
  node?: Query;
  /** Neighbour query (`NODE_NEIGHBOR`) */
  neighbor?: Query;
  /** Compound queries (`CHILD`, `PARENT`) */
  parent?: Query;
  child?: Query;
  /** Compound queries (`DESCENDANT`, `ANCESTOR`) */
  ancestor?: Query;
  descendant?: Query;
  /** Compound split queries (`COMPOUND_SPLIT`) */
  left?: Query;
  right?: Query;
  subject?: Query;
}
/**
 * A query against which an ele may be matched; all `checks` must pass for the
 * query to match
 */
interface Query {
  /** List of checks to make against an ele to test for a match */
  checks: Check[];
  /** The subject query, when a `$` subject selector applies */
  subject?: Query | null;
  /** Number of edge selectors in the query (set on top-level queries by the parser) */
  edgeCount?: number;
  /** Number of compound selectors in the query (set on top-level queries by the parser) */
  compoundCount?: number;
}
//#endregion
//#region src/selector/index.d.mts
/** What a Selector may be constructed from */
type SelectorInput = string | CollectionShim | FilterFn | null | undefined;
declare class Selector$1 {
  [index: number]: Query;
  inputText: SelectorInput;
  currentSubject: Query | null;
  compoundCount: number;
  edgeCount: number;
  length: number;
  invalid?: boolean;
  toStringCache?: string | null;
  constructor(selector?: SelectorInput);
  parse: (selector: string) => boolean;
  toString: () => string;
  matches: (ele: SelectorEle) => boolean;
  filter: (collection: SelectorCollection) => SelectorCollection;
  text: () => SelectorInput;
  size: () => number;
  eq: (i: number) => Query;
  sameText: (otherSel: Selector$1) => boolean;
  addQuery: (q: Query) => void;
  selector: () => string;
}
//#endregion
//#region src/style/properties.d.mts
/** Validation/parsing descriptor for a style property value type (an entry in `Style.types`). */
interface StylePropertyType {
  number?: boolean;
  min?: number;
  max?: number;
  strictMin?: boolean;
  strictMax?: boolean;
  integer?: boolean;
  unitless?: boolean;
  units?: string;
  implicitUnits?: string;
  allowPercent?: boolean;
  multiple?: boolean;
  evenMultiple?: boolean;
  enums?: (string | number)[];
  singleEnum?: boolean;
  color?: boolean;
  string?: boolean;
  mapping?: boolean;
  regex?: string;
  regexes?: string[];
  singleRegexMatchValue?: boolean;
  fn?: boolean;
  propList?: boolean;
  validate?: (valArr: unknown[], unitsArr: unknown[]) => boolean;
}
/** Diff function: whether a change from one value to another triggers an update. */
type StylePropertyTriggerFn = (fromValue: unknown, toValue: unknown, ele: StyleElement) => boolean;
/** Overrides the value hashed into the style key for a property. */
type StylePropertyHashOverrideFn = (ele: StyleElement, parsedProp: ParsedStyleProperty) => number | (number | undefined)[] | undefined;
/** Descriptor for a single visual style property (an entry in `Style.properties`). */
interface StyleProperty {
  name: string;
  /** the value type of the property (absent on alias entries) */
  type?: StylePropertyType;
  /** the property group the property belongs to (assigned after the group tables are built) */
  groupKey?: string;
  triggersBounds?: StylePropertyTriggerFn;
  triggersZOrder?: StylePropertyTriggerFn;
  triggersBoundsOfConnectedEdges?: StylePropertyTriggerFn;
  triggersBoundsOfParallelEdges?: StylePropertyTriggerFn;
  hashOverride?: StylePropertyHashOverrideFn;
  /** true for alias entries (e.g. `content` -> `label`) */
  alias?: boolean;
  /** the aliased property for alias entries */
  pointsTo?: StyleProperty;
}
/** The property table: an array of descriptors that doubles as a name -> descriptor map. */
type StylePropertiesTable = StyleProperty[] & {
  [name: string]: StyleProperty | undefined;
};
interface PropertiesStyfn {
  /** the value types that properties can have (statically available as `Style.types`) */
  types: Record<string, StylePropertyType>;
  /** the property table (statically available as `Style.properties`) */
  properties: StylePropertiesTable;
  propertyGroups: Record<string, StyleProperty[]>;
  propertyGroupNames: Record<string, string[]>;
  propertyGroupKeys: string[];
  propertyNames: string[];
  aliases: {
    name: string;
    pointsTo: string;
  }[];
  /** the pie properties are numbered, so give access to a constant N (for renderer use) */
  pieBackgroundN: number;
  /** the stripe properties are numbered, so give access to a constant N (for renderer use) */
  stripeBackgroundN: number;
  arrowPrefixes: string[];
  getDefaultProperty(this: Style$1, name: string): ParseResult;
  getDefaultProperties(this: Style$1): Record<string, ParseResult>;
  addDefaultStylesheet(this: Style$1): void;
}
//#endregion
//#region src/style/apply.d.mts
/** Metadata about the contexts that match an element. */
interface ContextMeta {
  /** which contexts match the element, e.g. 'ttfftt' */
  key: string;
  diffPropNames: string[];
  empty: boolean;
}
/** A computed ele style object based on matched contexts: name -> property. */
type ContextStyleMap = {
  _private: {
    key: string;
  };
} & {
  [name: string]: ParsedStyleProperty | undefined;
};
/** The previous and next values of a property that diffed during application. */
interface DiffProp {
  prev?: ParsedStyleProperty | null;
  next?: ParsedStyleProperty | null;
}
interface ApplyStyfn {
  apply(this: Style$1, eles: ArrayLike<StyleElement>): StyleEles;
  getPropertiesDiff(this: Style$1, oldCxtKey: string, newCxtKey: string): string[];
  getContextMeta(this: Style$1, ele: StyleElement): ContextMeta;
  getContextStyle(this: Style$1, cxtMeta: ContextMeta): ContextStyleMap;
  applyContextStyle(this: Style$1, cxtMeta: ContextMeta, cxtStyle: ContextStyleMap, ele: StyleElement): {
    diffProps: Record<string, DiffProp>;
  };
  updateStyleHints(this: Style$1, ele: StyleElement): boolean;
  clearStyleHints(this: Style$1, ele: StyleElement): void;
  applyParsedProperty(this: Style$1, ele: StyleElement, parsedProp: ParsedStyleProperty): boolean;
  cleanElements(this: Style$1, eles: ArrayLike<StyleElement>, keepBypasses?: boolean): void;
  update(this: Style$1): void;
  updateTransitions(this: Style$1, ele: StyleElement, diffProps: Record<string, DiffProp | undefined>, isBypass?: boolean): void;
  checkTrigger(this: Style$1, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown, getTrigger: (prop: StyleProperty) => StylePropertyTriggerFn | undefined, onTrigger: (prop: StyleProperty) => void): void;
  checkZOrderTrigger(this: Style$1, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkBoundsTrigger(this: Style$1, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkConnectedEdgesBoundsTrigger(this: Style$1, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkParallelEdgesBoundsTrigger(this: Style$1, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkTriggers(this: Style$1, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
}
//#endregion
//#region src/style/bypass.d.mts
interface BypassStyfn {
  applyBypass(this: Style$1, eles: ArrayLike<StyleElement>, name: string | Record<string, unknown>, value?: unknown, updateTransitions?: unknown): boolean;
  overrideBypass(this: Style$1, eles: ArrayLike<StyleElement>, name: string, value: unknown): void;
  removeAllBypasses(this: Style$1, eles: ArrayLike<StyleElement>, updateTransitions?: boolean): void;
  removeBypasses(this: Style$1, eles: ArrayLike<StyleElement>, props: string[], updateTransitions?: boolean): void;
}
//#endregion
//#region src/style/container.d.mts
interface ContainerStyfn {
  getEmSizeInPixels(this: Style$1): number;
  containerCss(this: Style$1, propName: string): string | undefined;
}
//#endregion
//#region src/style/get-for-ele.d.mts
interface GetForEleStyfn {
  getRenderedStyle(this: Style$1, ele: StyleElement, prop?: string): string | Record<string, string> | null | undefined;
  getRawStyle(this: Style$1, ele: StyleElement, isRenderedVal?: boolean): Record<string, string> | undefined;
  getIndexedStyle(this: Style$1, ele: StyleElement, property: string, subproperty: string, index: number): unknown;
  getStylePropertyValue(this: Style$1, ele: StyleElement, propName: string, isRenderedVal?: boolean): string | null | undefined;
  getAnimationStartStyle(this: Style$1, ele: StyleElement, aniProps: {
    name: string;
  }[]): Record<string, ParsedStyleProperty>;
  getPropsList(this: Style$1, propsObj: Record<string, unknown> | null | undefined): ParsedStyleProperty[];
  getNonDefaultPropertiesHash(this: Style$1, ele: StyleElement, propNames: string[], seed: number[]): number[];
  getPropertiesHash(this: Style$1, ele: StyleElement, propNames: string[], seed: number[]): number[];
}
//#endregion
//#region src/style/json.d.mts
type StyleJsonProperties = Css.Node | Css.Edge | Css.Core;
/** A JSON stylesheet block: a selector and at least one style-property map. */
type StyleJsonBlock = {
  selector: string;
} & ({
  style: StyleJsonProperties;
  css?: StyleJsonProperties;
} | {
  style?: StyleJsonProperties;
  css: StyleJsonProperties;
});
type StyleJson = StyleJsonBlock[];
interface JsonStyfn {
  appendFromJson(this: Style$1, json: StyleJsonBlock[]): Style$1;
  fromJson(this: Style$1, json: StyleJsonBlock[]): Style$1;
  json(this: Style$1): StyleJsonBlock[];
}
//#endregion
//#region src/style/string-sheet.d.mts
interface StringSheetStyfn {
  appendFromString(this: Style$1, string: string): Style$1;
  fromString(this: Style$1, string: string): Style$1;
}
//#endregion
//#region src/style/index.d.mts
/** The element `_private` fields read/written by style code. */
interface StyleElementPrivate {
  /** name -> applied parsed property */
  style: Record<string, ParsedStyleProperty | null | undefined>;
  styleCxtKey?: string;
  /** style hint hashes per property group */
  styleKeys: Record<string, [number, number]>;
  styleKey: number | null;
  labelDimsKey?: number | null;
  labelKey: number | null;
  labelStyleKey: number | null;
  sourceLabelKey: number | null;
  sourceLabelStyleKey: number | null;
  targetLabelKey: number | null;
  targetLabelStyleKey: number | null;
  nodeKey: number | null;
  hasPie: boolean | null;
  hasStripe: boolean | null;
  appliedInitStyle: boolean;
  styleDirty: boolean;
  transitioning: boolean;
  group: string;
  data: Record<string, unknown>;
}
/** Minimal structural view of a playable animation, as used by style transitions. */
interface StyleAnimation {
  play(): StyleAnimation;
  promise(): PromiseLikeObject<unknown>;
}
/**
 * Minimal structural view of a single element, as used by style code.
 * Replaced by the real Element type once src/collection is converted.
 */
interface StyleElement {
  length: number;
  [index: number]: StyleElement;
  _private: StyleElementPrivate;
  pstyle(name: string, includeNonDefault?: boolean): ParsedStyleProperty;
  id(): string;
  cy(): StyleCore;
  isEdge(): boolean;
  isLoop(): boolean;
  isParent(): boolean;
  source(): StyleElement;
  target(): StyleElement;
  removed(): boolean;
  poolIndex(): number;
  dirtyCompoundBoundsCache(): void;
  dirtyBoundingBoxCache(): void;
  dirtyStyleCache(): void;
  connectedEdges(): StyleEles;
  parallelEdges(): StyleEles;
  emitAndNotify(events: string): void;
  delayAnimation(duration: number): StyleAnimation;
  animation(options: Record<string, unknown>): StyleAnimation;
}
/**
 * Minimal structural view of a collection, as used by style code.
 * Replaced by the real Collection type once src/collection is converted.
 */
interface StyleEles {
  length: number;
  [index: number]: StyleElement;
  forEach(fn: (ele: StyleElement) => void): void;
  updateStyle(): void;
  push(ele: StyleElement): unknown;
}
/**
 * Minimal structural view of the Core, as used by style code. Replaced by
 * the real Core type once src/core is converted.
 */
interface StyleCore extends CoreShim {
  collection(): StyleEles;
  elements(): StyleEles;
  mutableElements(): StyleEles;
  notify(event: string, eles?: StyleElement): void;
  container(): HTMLElement | null | undefined;
  window(): {
    getComputedStyle?: (elt: Element) => CSSStyleDeclaration;
  } | null | undefined;
  style(): Style$1;
}
/** The per-context parsed property list, which doubles as a name -> property map. */
type StyleContextProperties = ParsedStyleProperty[] & {
  [name: string]: ParsedStyleProperty | undefined;
};
/** A style context: a selector and the properties applied where it matches. */
interface StyleContext {
  selector: Selector$1 | null;
  properties: StyleContextProperties;
  mappedProperties: ParsedStyleProperty[];
  index: number;
}
interface StylePrivate {
  cy: StyleCore;
  coreStyle: Record<string, ParsedStyleProperty>;
  contextStyles?: Record<string, ContextStyleMap>;
  propDiffs?: Record<string, string[]>;
  hasPie?: boolean;
  hasStripe?: boolean;
  defaultProperties?: Record<string, ParseResult>;
}
interface Style$1 extends ApplyStyfn, BypassStyfn, ContainerStyfn, GetForEleStyfn, JsonStyfn, StringSheetStyfn, PropertiesStyfn, ParseStyfn {
  length: number;
  /** the number of contexts in the default stylesheet (set by addDefaultStylesheet) */
  defaultLength: number;
  [index: number]: StyleContext;
  _private: StylePrivate;
  /** cache of parsed properties, keyed by argument hash (set lazily by parse) */
  propCache?: ParseResult[];
  instanceString(): string;
  clear(): Style$1;
  resetToDefault(): Style$1;
  core(propName: string): ParseResult;
  selector(selectorStr: string): Style$1;
  css(): Style$1;
  css(map: Css.Node | Css.Edge | Css.Core): Style$1;
  css(name: string, value: unknown): Style$1;
  style: Style$1['css'];
  cssRule(name: string, value: unknown): Style$1;
  append(style: unknown): Style$1;
}
interface StyleStatic {
  (this: Style$1 | void, cy: StyleCore): Style$1;
  new (cy: StyleCore): Style$1;
  prototype: Style$1;
  fromJson(cy: StyleCore, json: StyleJsonBlock[]): Style$1;
  fromString(cy: StyleCore, string: string): Style$1;
  types: Record<string, StylePropertyType>;
  properties: StylePropertiesTable;
  propertyGroups: Record<string, StyleProperty[]>;
  propertyGroupNames: Record<string, string[]>;
  propertyGroupKeys: string[];
}
declare let Style$1: StyleStatic;
//#endregion
//#region src/style/parse.d.mts
/**
 * A parsed style property value, as produced by `Style.prototype.parse()`.
 * The fields beyond `name`/`value`/`strValue`/`bypass` are written at
 * various points in a property's lifecycle (parsing, mapping, flattening,
 * bypassing), so most of them are optional.
 */
interface ParsedStyleProperty {
  /** the name of the property */
  name: string;
  /** the parsed, native-typed value of the property (number, string, value array, colour tuple, regex match array, or mapper function) */
  value?: unknown;
  /** a string value that represents the property value in valid css */
  strValue?: string;
  /** the units of the value (or per-value units for multiple-valued properties) */
  units?: string | (string | undefined)[];
  /** true iff the property is a bypass property */
  bypass?: boolean;
  /** for a bypass property: the overridden non-bypass property */
  bypassed?: ParsedStyleProperty | null;
  /** indication to delete the bypass property */
  deleteBypass?: boolean;
  /** indication to delete the bypassed property */
  deleteBypassed?: boolean;
  /** indication to delete the property (use the default value) */
  delete?: boolean;
  /** the value normalised to canonical units (px, ms, rad, [0, 1] fractions, ...) */
  pfValue?: number | (number | undefined)[];
  /** the mapping type descriptor when the value is a mapper (e.g. `types.data`) */
  mapped?: StylePropertyType;
  /** for a flattened property: a reference back to the mapping that produced it */
  mapping?: ParsedStyleProperty;
  /** the data field used by data()/mapData() mappers */
  field?: string;
  /** mapData() input range minimum */
  fieldMin?: number;
  /** mapData() input range maximum */
  fieldMax?: number;
  /** mapData() output range minimum (parsed value) */
  valueMin?: unknown;
  /** mapData() output range maximum (parsed value) */
  valueMax?: unknown;
  /** cached fn-mapper return value */
  fnValue?: unknown;
  /** previously applied fn-mapper return value */
  prevFnValue?: unknown;
}
/** `parseImpl()` returns `null` on an invalid property and `false` on a disallowed mapping. */
type ParseResult = ParsedStyleProperty | null | false;
/** Flattening flag passed through the parse functions. */
type StylePropIsFlat = boolean | 'mapping' | 'multiple' | null;
interface ParseStyfn {
  parse(this: Style$1, name: string, value: unknown, propIsBypass?: boolean, propIsFlat?: StylePropIsFlat): ParseResult;
  parseImplWarn(this: Style$1, name: string, value: unknown, propIsBypass?: boolean, propIsFlat?: StylePropIsFlat): ParseResult;
  parseImpl(this: Style$1, name: string, value: unknown, propIsBypass?: boolean, propIsFlat?: StylePropIsFlat): ParseResult;
}
//#endregion
//#region src/event-types.d.mts
type NativeEvent$1 = globalThis.Event;
/** Fields and methods common to every event object (jQuery-like). */
interface AbstractEventObject$1 {
  /** the corresponding core instance */
  cy: Core$1;
  /**
   * the element or core that first caused the event.
   *
   * Typed `any` so the narrowed `EventObjectNode`/`EventObjectEdge`/
   * `EventObjectCore` variants (which fix `target` to a specific kind) remain
   * usable as handler parameters despite function-parameter contravariance —
   * matching the original hand-written declarations. Prefer the narrowed
   * variants when the target kind is known.
   */
  target: any;
  /** the event type string (e.g. `'tap'`) */
  type: string;
  /** the event namespace string (e.g. `'foo'` for `'tap.foo'`) */
  namespace: string;
  /** Unix epoch time of the event, in milliseconds */
  timeStamp: number;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
  isDefaultPrevented(): boolean;
  isPropagationStopped(): boolean;
  isImmediatePropagationStopped(): boolean;
}
/** Event object for user-input device events (taps, drags, …). */
interface InputEventObject$1 extends AbstractEventObject$1 {
  /** the model position of the event */
  position: Position$1;
  /** the rendered position of the event */
  renderedPosition: Position$1;
  /** the original user input device event */
  originalEvent: NativeEvent$1;
}
/** Event object for layout events. */
interface LayoutEventObject$1 extends AbstractEventObject$1 {
  /** the layout that triggered the event */
  layout: unknown;
}
/** The event object passed to handlers; carries both input and layout fields. */
interface EventObject$1 extends InputEventObject$1, LayoutEventObject$1 {}
/** An event whose target is a node. */
interface EventObjectNode$1 extends EventObject$1 {
  target: NodeSingular$1;
}
/** An event whose target is an edge. */
interface EventObjectEdge$1 extends EventObject$1 {
  target: EdgeSingular$1;
}
/** An event whose target is the core. */
interface EventObjectCore$1 extends EventObject$1 {
  target: Core$1;
}
/** A user-supplied event-binding callback. */
type EventHandler$1 = (event: EventObject$1, ...extraParams: any[]) => void;
//#endregion
//#region src/core/add-remove.d.mts
/** The shapes accepted by `add()`. */
type AddOpts = SharedCollection | ElementDefinition$1 | ElementDefinition$1[] | {
  nodes?: ElementDefinition$1[];
  edges?: ElementDefinition$1[];
};
/** Add/remove element methods contributed to the core prototype. */
interface CoreAddRemove {
  add(this: Core$1, opts: AddOpts): Collection$1;
  remove(this: Core$1, collection: SharedCollection | string): Collection$1;
}
//#endregion
//#region src/core/animation/index.d.mts
/**
 * Animation methods contributed to `Core.prototype` by this mixin. The
 * `.animate()`/`.animation()`/etc. methods are generated by `define`; the
 * loop-management methods are defined here.
 */
interface CoreAnimation$1 {
  animate(properties: AnimationOptions$1, params?: AnimationOptions$1): Core$1;
  animation(properties?: AnimationOptions$1, params?: AnimationOptions$1): Animation$1;
  animated(): boolean | undefined;
  clearQueue(): Core$1;
  delay(time: number, complete?: () => void): Core$1;
  delayAnimation(time: number, complete?: () => void): Animation$1;
  stop(clearQueue?: boolean, jumpToEnd?: boolean): Core$1;
}
//#endregion
//#region src/event.d.mts
type NativeEvent = globalThis.Event;
interface EventProps {
  originalEvent?: NativeEvent;
  type?: string;
  cy?: CoreShim;
  target?: unknown;
  position?: Position$1;
  renderedPosition?: Position$1;
  namespace?: string | null;
  layout?: unknown;
  timeStamp?: number;
}
type EventSrc = string | NativeEvent | EventProps | null | undefined;
declare class Event {
  type: string;
  originalEvent?: NativeEvent;
  cy?: CoreShim;
  target?: unknown;
  position?: Position$1;
  renderedPosition?: Position$1;
  namespace?: string | null;
  layout?: unknown;
  timeStamp: number;
  isDefaultPrevented: () => boolean;
  isPropagationStopped: () => boolean;
  isImmediatePropagationStopped: () => boolean;
  constructor(src: EventSrc, props?: EventProps);
  instanceString(): string;
  recycle(src: EventSrc, props?: EventProps): void;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}
//#endregion
//#region src/emitter.d.mts
type EmitInput = string | string[] | Event | EventProps;
//#endregion
//#region src/core/events.d.mts
/** Public selector/handler arg of `.on()` and friends (2- or 3-arg form). */
type EventSelectorArg$1 = string | Selector$1 | EventHandler$1 | null | undefined;
interface CoreEvents$1 {
  on(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  removeListener(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  removeAllListeners(): Core$1;
  one(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  emit(events: EmitInput, extraParams?: unknown[]): Core$1;
  addListener(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  listen(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  bind(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  unlisten(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  unbind(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  off(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler$1): Core$1;
  trigger(events: EmitInput, extraParams?: unknown[]): Core$1;
  pon(events: string, selector?: EventSelectorArg$1): Promise<EventObject$1>;
  promiseOn(events: string, selector?: EventSelectorArg$1): Promise<EventObject$1>;
}
//#endregion
//#region src/core/export.d.mts
/** Options accepted by the image export methods (`png`/`jpg`/`jpeg`). */
interface ExportOptions$1 {
  bg?: string;
  full?: boolean;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  [key: string]: unknown;
}
interface ExportStringOptions$1 extends ExportOptions$1 {
  output?: 'base64uri' | 'base64';
}
interface ExportBlobOptions$1 extends ExportOptions$1 {
  output: 'blob';
}
interface ExportBlobPromiseOptions$1 extends ExportOptions$1 {
  output: 'blob-promise';
}
interface ExportJpgOptions$1 extends ExportOptions$1 {
  quality?: number;
}
interface ExportJpgStringOptions$1 extends ExportJpgOptions$1, ExportStringOptions$1 {}
interface ExportJpgBlobOptions$1 extends ExportJpgOptions$1, ExportBlobOptions$1 {}
interface ExportJpgBlobPromiseOptions$1 extends ExportJpgOptions$1, ExportBlobPromiseOptions$1 {}
/** Image export methods contributed to the core prototype. */
interface CoreExport$1 {
  png(this: Core$1, options?: ExportStringOptions$1): string;
  png(this: Core$1, options?: ExportBlobOptions$1): Blob;
  png(this: Core$1, options?: ExportBlobPromiseOptions$1): Promise<Blob>;
  jpg(this: Core$1, options?: ExportJpgStringOptions$1): string;
  jpg(this: Core$1, options?: ExportJpgBlobOptions$1): Blob;
  jpg(this: Core$1, options?: ExportJpgBlobPromiseOptions$1): Promise<Blob>;
  jpeg(this: Core$1, options?: ExportJpgStringOptions$1): string;
  jpeg(this: Core$1, options?: ExportJpgBlobOptions$1): Blob;
  jpeg(this: Core$1, options?: ExportJpgBlobPromiseOptions$1): Promise<Blob>;
}
//#endregion
//#region src/core/layout.d.mts
/** Options accepted by `layout()`/`makeLayout()`/`createLayout()`. */
interface LayoutOptions$2 {
  name: string;
  eles?: Collection$1 | string;
  position?: (node: NodeSingular$1) => {
    row?: number;
    col?: number;
  } | undefined;
  sort?: (a: NodeSingular$1, b: NodeSingular$1) => number;
  nodeRepulsion?: number | ((node: NodeSingular$1) => number);
  idealEdgeLength?: number | ((edge: EdgeSingular$1) => number);
  edgeElasticity?: number | ((edge: EdgeSingular$1) => number);
  [key: string]: unknown;
}
/** Layout construction methods contributed to the core prototype. */
interface CoreLayout$1 {
  layout(this: Core$1, options: LayoutOptions$2): LayoutInstance;
  makeLayout(this: Core$1, options: LayoutOptions$2): LayoutInstance;
  createLayout(this: Core$1, options: LayoutOptions$2): LayoutInstance;
}
//#endregion
//#region src/core/notification.d.mts
interface CoreNotification {
  startBatch(): Core$1;
  endBatch(): Core$1;
  batch(callback: () => void): Core$1;
}
//#endregion
//#region src/core/renderer.d.mts
interface CoreRenderer {
  resize(): Core$1;
  invalidateDimensions(): Core$1;
}
//#endregion
//#region src/collection/filter.d.mts
/** A predicate run against each element of a collection. */
type FilterEleFn = (ele: Element$2, i: number, eles: Collection$1) => boolean | unknown;
/** Inputs accepted by `.filter()` and friends: selector string, predicate, or collection. */
type FilterArg = string | FilterEleFn | SharedCollection | undefined | null;
/** Inputs accepted by set operations: selector string or collection. */
type SetArg = string | SharedCollection | undefined | null;
/** Result of `.diff()`/`.difference()`. */
interface DiffResult {
  left: Collection$1;
  right: Collection$1;
  both: Collection$1;
}
interface CollectionFilter {
  nodes(selector?: FilterArg): NodeCollection$1;
  edges(selector?: FilterArg): EdgeCollection$1;
  filter(filter?: FilterArg, thisArg?: unknown): Collection$1;
  not(toRemove?: SetArg): Collection$1;
  difference(toRemove?: SetArg): Collection$1;
  relativeComplement(toRemove?: SetArg): Collection$1;
  subtract(toRemove?: SetArg): Collection$1;
  diff(other: SetArg): DiffResult;
  absoluteComplement(): Collection$1;
  complement(): Collection$1;
  abscomp(): Collection$1;
  intersect(other: SetArg): Collection$1;
  intersection(other: SetArg): Collection$1;
  and(other: SetArg): Collection$1;
  xor(other: SetArg): Collection$1;
  symmetricDifference(other: SetArg): Collection$1;
  symdiff(other: SetArg): Collection$1;
  add(toAdd?: SetArg): Collection$1;
  union(toAdd?: SetArg): Collection$1;
  or(toAdd?: SetArg): Collection$1;
  u: CollectionFilter['union'];
  '+': CollectionFilter['union'];
  '|': CollectionFilter['union'];
  merge(toAdd?: SetArg): Collection$1;
  '\\': CollectionFilter['difference'];
  '!': CollectionFilter['difference'];
  '-': CollectionFilter['difference'];
  n: CollectionFilter['intersection'];
  '&': CollectionFilter['intersection'];
  '.': CollectionFilter['intersection'];
  '^': CollectionFilter['symmetricDifference'];
  '(+)': CollectionFilter['symmetricDifference'];
  '(-)': CollectionFilter['symmetricDifference'];
  unmerge(toRemove?: SetArg): Collection$1;
}
//#endregion
//#region src/core/search.d.mts
/** Options accepted by `collection()` when building from an array. */
interface CollectionOpts {
  unique?: boolean;
  removed?: boolean;
}
/** Graph search/collection helpers contributed to the core prototype. */
interface CoreSearch {
  collection(this: Core$1, eles?: string | SharedCollection | SharedCollection[] | ElementDefinition$1[], opts?: CollectionOpts): Collection$1;
  nodes(this: Core$1, selector?: FilterArg): NodeCollection$1;
  edges(this: Core$1, selector?: FilterArg): EdgeCollection$1;
  $(this: Core$1, selector?: FilterArg): Collection$1;
  elements(this: Core$1, selector?: FilterArg): Collection$1;
  filter(this: Core$1, selector?: FilterArg): Collection$1;
}
//#endregion
//#region src/core/style.d.mts
/** Style engine accessor methods contributed to the core prototype. */
interface CoreStyle$1 {
  style(this: Core$1, newStyle?: unknown): Style$1;
}
//#endregion
//#region src/core/viewport.d.mts
/** Params accepted by `zoom()` / `getZoomedViewport()` when zooming about a point. */
interface ZoomOptions$1 {
  level?: number;
  position?: Position$1;
  renderedPosition?: Position$1;
}
/** Options accepted by `viewport()`. */
interface ViewportOptions {
  zoom?: number;
  pan?: Position$1;
  cancelOnFailedZoom?: boolean;
}
/** The contribution interface this mixin adds to `Core`. */
interface CoreViewport {
  autolock(): boolean;
  autolock(bool: boolean): Core$1;
  autoungrabify(): boolean;
  autoungrabify(bool: boolean): Core$1;
  autounselectify(): boolean;
  autounselectify(bool: boolean): Core$1;
  selectionType(): 'single' | 'additive';
  selectionType(selType: 'single' | 'additive'): Core$1;
  panningEnabled(): boolean;
  panningEnabled(bool: boolean): Core$1;
  userPanningEnabled(): boolean;
  userPanningEnabled(bool: boolean): Core$1;
  zoomingEnabled(): boolean;
  zoomingEnabled(bool: boolean): Core$1;
  userZoomingEnabled(): boolean;
  userZoomingEnabled(bool: boolean): Core$1;
  boxSelectionEnabled(): boolean;
  boxSelectionEnabled(bool: boolean): Core$1;
  pan(): Position$1;
  pan(dim: string): number;
  pan(dims: Position$1): Core$1;
  pan(dim: string, val: number): Core$1;
  panBy(dims: Position$1): Core$1;
  panBy(dim: string, val: number): Core$1;
  fit(elements?: SharedCollection | string | BoundingBox$1 | number, padding?: number): Core$1;
  minZoom(): number;
  minZoom(zoom: number): Core$1;
  maxZoom(): number;
  maxZoom(zoom: number): Core$1;
  zoom(): number;
  zoom(params: number | ZoomOptions$1): Core$1;
  viewport(opts: ViewportOptions): Core$1;
  center(elements?: SharedCollection | string): Core$1;
  /** Alias of {@link center}. */
  centre(elements?: SharedCollection | string): Core$1;
  reset(): Core$1;
  width(): number;
  height(): number;
  extent(): BoundingBox$1;
  renderedExtent(): BoundingBox$1;
}
//#endregion
//#region src/define/data.d.mts
/** The generated data accessor (e.g. `.data()`, `.scratch()`). */
interface DataFunc<Self> {
  (this: Self): Record<string, unknown> | undefined;
  (this: Self, name: string): unknown;
  <Host extends Self>(this: Host, name: string, value: unknown): Host;
  <Host extends Self>(this: Host, obj: Record<string, unknown>): Host;
  <Host extends Self>(this: Host, handler: EventHandler$1): Host;
}
/** The generated data remover (e.g. `.removeData()`, `.removeScratch()`). */
interface RemoveDataFunc<Self> {
  <Host extends Self>(this: Host, names?: string): Host;
  (this: Self, names?: string): Self;
}
//#endregion
//#region src/core/data.d.mts
/** Data/scratch accessor methods contributed to the core prototype. */
interface CoreData$1 {
  data: DataFunc<Core$1>;
  removeData: RemoveDataFunc<Core$1>;
  scratch: DataFunc<Core$1>;
  removeScratch: RemoveDataFunc<Core$1>;
  attr: DataFunc<Core$1>;
  removeAttr: RemoveDataFunc<Core$1>;
}
//#endregion
//#region src/core/core-types.d.mts
/** A layout instance produced by `cy.layout()` / `cy.makeLayout()`. */
interface LayoutInstance {
  run(): this;
  start(): this;
  stop(): this;
  on(events: string, handler: (...args: any[]) => void): this;
  one(events: string, handler?: (...args: unknown[]) => void): this;
  off(events: string, handler?: (...args: unknown[]) => void): this;
  emit(events: string | {
    type: string;
    [key: string]: unknown;
  }, extraParams?: unknown[]): this;
  promiseOn(events: string, selector?: string): Promise<unknown>;
  removeListener(events: string, handler?: (...args: unknown[]) => void): this;
  removeAllListeners(): this;
  trigger(events: unknown): this;
  addListener: this['on'];
  bind: this['on'];
  listen: this['on'];
  unbind: this['off'];
  unlisten: this['off'];
  pon: this['promiseOn'];
  [key: string]: unknown;
}
/** A registered renderer instance. */
interface RendererInstance {
  isHeadless(): boolean;
  notify(eles?: Collection$1, evts?: unknown): void;
  [key: string]: unknown;
}
interface StylesheetLike {
  generateStyle(cy: unknown): unknown;
}
/** Options accepted by the `cytoscape(...)` factory. */
interface CytoscapeOptions$1 {
  container?: HTMLElement | null;
  elements?: any;
  style?: string | StyleJson | Promise<StyleJson> | StylesheetLike;
  layout?: Partial<LayoutOptions$2>;
  data?: Record<string, unknown>;
  zoom?: number;
  pan?: Position$1;
  minZoom?: number;
  maxZoom?: number;
  zoomingEnabled?: boolean;
  userZoomingEnabled?: boolean;
  panningEnabled?: boolean;
  userPanningEnabled?: boolean;
  boxSelectionEnabled?: boolean;
  selectionType?: 'single' | 'additive';
  autolock?: boolean;
  autolockNodes?: boolean;
  autoungrabify?: boolean;
  autoungrabifyNodes?: boolean;
  autounselectify?: boolean;
  styleEnabled?: boolean;
  headless?: boolean;
  multiClickDebounceTime?: number;
  renderer?: {
    name?: string;
    [key: string]: unknown;
  };
  hideEdgesOnViewport?: boolean;
  textureOnViewport?: boolean;
  wheelSensitivity?: number;
  motionBlur?: boolean;
  ready?: (evt: EventObject$1) => void;
  done?: () => void;
  [key: string]: unknown;
}
/** Methods defined directly in core/index.mts (not via mixins). */
interface CoreBaseFns {
  instanceString(): string;
  destroyed(): boolean;
  ready(fn: (evt: EventObject$1) => void): this;
  destroy(): this | undefined;
  getElementById(id: string | number): Collection$1;
  $id(id: string | number): Collection$1;
  container(): HTMLElement | null;
  mount(container: HTMLElement): this | undefined;
  unmount(): this;
  json(obj?: any): any;
}
/**
 * The full Core instance type: the union of all mixin contributions plus
 * the base methods. Structurally a superset of the collection module's
 * `CoreAccess`, so a Core is accepted wherever CoreAccess is required.
 */
interface Core$1 extends CoreBaseFns, CoreAddRemove, CoreAnimation$1, CoreEvents$1, CoreExport$1, CoreLayout$1, CoreNotification, CoreRenderer, CoreSearch, CoreStyle$1, CoreViewport, CoreData$1 {}
//#endregion
//#region src/collection/algorithms/bfs-dfs.d.mts
/** Callback invoked for each visited node during a search. Return `true` to
 * stop and record the node as `found`; return `false` to stop without. */
type SearchVisitFn = (v: NodeSingular$1, e: EdgeSingular$1 | undefined, u: NodeSingular$1 | undefined, i: number, depth: number) => boolean | void;
/** Options object accepted by breadthFirstSearch / depthFirstSearch. */
interface SearchOptions {
  roots?: SharedCollection | string;
  root?: SharedCollection | string;
  visit?: SearchVisitFn;
  directed?: boolean;
}
/** Result of a breadth/depth-first search. */
interface SearchResult {
  path: Collection$1;
  found: Collection$1;
}
/** A configured search method (bfs or dfs). */
type SearchFn = (this: SharedCollection, roots?: SearchOptions | SharedCollection | string, fn?: SearchVisitFn | boolean, directed?: boolean) => SearchResult;
interface AlgorithmsBfsDfs {
  breadthFirstSearch: SearchFn;
  depthFirstSearch: SearchFn;
  bfs: SearchFn;
  dfs: SearchFn;
}
//#endregion
//#region src/collection/algorithms/dijkstra.d.mts
/** Edge weighting function. */
type DijkstraWeightFn = (edge: EdgeSingular$1) => number;
/** Options accepted by `dijkstra`. */
interface DijkstraOptions {
  root?: SharedCollection | string | null;
  weight?: DijkstraWeightFn;
  directed?: boolean;
}
/** Result of `dijkstra`: distance/path lookups from the root node. */
interface DijkstraResult {
  distanceTo(node: SharedCollection | string): number;
  pathTo(node: SharedCollection | string): Collection$1;
}
interface AlgorithmsDijkstra {
  dijkstra(this: SharedCollection, options?: DijkstraOptions | SharedCollection | string, weight?: DijkstraWeightFn, directed?: boolean): DijkstraResult;
}
//#endregion
//#region src/collection/algorithms/kruskal.d.mts
/** Edge weighting function. */
type KruskalWeightFn = (edge: EdgeSingular$1) => number;
interface AlgorithmsKruskal {
  kruskal(this: SharedCollection, weightFn?: KruskalWeightFn): Collection$1;
}
//#endregion
//#region src/collection/algorithms/a-star.d.mts
/** Edge weighting function. */
type AStarWeightFn = (edge: EdgeSingular$1) => number;
/** Node heuristic function. */
type AStarHeuristicFn = (node: NodeSingular$1) => number;
/** Options accepted by `aStar`. */
interface AStarOptions {
  root?: SharedCollection | string | null;
  goal?: SharedCollection | string | null;
  weight?: AStarWeightFn;
  heuristic?: AStarHeuristicFn;
  directed?: boolean;
}
/** Result of an A* search. */
interface AStarResult {
  found: boolean;
  distance: number | undefined;
  path: Collection$1 | undefined;
  steps: number;
}
interface AlgorithmsAStar {
  aStar(this: SharedCollection, options?: AStarOptions): AStarResult;
}
//#endregion
//#region src/collection/algorithms/floyd-warshall.d.mts
/** Edge weighting function. */
type FloydWarshallWeightFn = (edge: EdgeSingular$1) => number;
/** Options accepted by `floydWarshall`. */
interface FloydWarshallOptions {
  weight?: FloydWarshallWeightFn;
  directed?: boolean;
}
/** Result of `floydWarshall`: all-pairs distance/path lookups. */
interface FloydWarshallResult {
  distance(from: SharedCollection | string, to: SharedCollection | string): number;
  path(from: SharedCollection | string, to: SharedCollection | string): Collection$1;
}
interface AlgorithmsFloydWarshall {
  floydWarshall(this: SharedCollection, options?: FloydWarshallOptions): FloydWarshallResult;
}
//#endregion
//#region src/collection/algorithms/bellman-ford.d.mts
/** Edge weighting function. */
type BellmanFordWeightFn = (edge: EdgeSingular$1) => number;
/** Options accepted by `bellmanFord`. */
interface BellmanFordOptions {
  weight?: BellmanFordWeightFn;
  directed?: boolean;
  root?: SharedCollection | string | null;
  findNegativeWeightCycles?: boolean;
}
/** Result of `bellmanFord`. */
interface BellmanFordResult {
  distanceTo(to: SharedCollection | string): number | undefined;
  pathTo(to: SharedCollection | string, thisStart?: SharedCollection): Collection$1;
  hasNegativeWeightCycle: boolean;
  negativeWeightCycles: Collection$1[];
}
interface AlgorithmsBellmanFord {
  bellmanFord(this: SharedCollection, options?: BellmanFordOptions): BellmanFordResult;
}
//#endregion
//#region src/collection/algorithms/karger-stein.d.mts
/** Result of `kargerStein`. */
interface KargerSteinResult {
  cut: Collection$1;
  components: Collection$1[];
  partition1: Collection$1;
  partition2: Collection$1;
}
interface AlgorithmsKargerStein {
  kargerStein(this: SharedCollection): KargerSteinResult | undefined;
}
//#endregion
//#region src/collection/algorithms/page-rank.d.mts
/** Edge weighting function. */
type PageRankWeightFn = (edge: EdgeSingular$1) => number;
/** Options accepted by `pageRank`. */
interface PageRankOptions {
  dampingFactor?: number;
  precision?: number;
  iterations?: number;
  weight?: PageRankWeightFn;
}
/** Result of `pageRank`: the rank of a given node. */
interface PageRankResult {
  rank(node: SharedCollection | string): number;
}
interface AlgorithmsPageRank {
  pageRank(this: SharedCollection, options?: PageRankOptions): PageRankResult;
}
//#endregion
//#region src/collection/algorithms/degree-centrality.d.mts
/** Edge weighting function. */
type DegreeCentralityWeightFn = (edge: EdgeSingular$1) => number;
/** Options accepted by the degree-centrality methods. */
interface DegreeCentralityOptions {
  root?: SharedCollection | string | null;
  weight?: DegreeCentralityWeightFn;
  directed?: boolean;
  alpha?: number;
}
/** Result of `degreeCentrality` for an undirected graph. */
interface UndirectedDegreeCentrality {
  degree: number;
}
/** Result of `degreeCentrality` for a directed graph. */
interface DirectedDegreeCentrality {
  indegree: number;
  outdegree: number;
}
type DegreeCentralityResult = UndirectedDegreeCentrality | DirectedDegreeCentrality;
/** Result of `degreeCentralityNormalized` for an undirected graph. */
interface UndirectedDegreeCentralityNormalized {
  degree(node: SharedCollection | string): number;
}
/** Result of `degreeCentralityNormalized` for a directed graph. */
interface DirectedDegreeCentralityNormalized {
  indegree(node: SharedCollection | string): number;
  outdegree(node: SharedCollection | string): number;
}
type DegreeCentralityNormalizedResult = UndirectedDegreeCentralityNormalized | DirectedDegreeCentralityNormalized;
interface AlgorithmsDegreeCentrality {
  degreeCentralityNormalized(this: SharedCollection, options?: DegreeCentralityOptions): DegreeCentralityNormalizedResult;
  degreeCentrality(this: SharedCollection, options?: DegreeCentralityOptions): DegreeCentralityResult;
  dc(this: SharedCollection, options?: DegreeCentralityOptions): DegreeCentralityResult;
  dcn(this: SharedCollection, options?: DegreeCentralityOptions): DegreeCentralityNormalizedResult;
  degreeCentralityNormalised(this: SharedCollection, options?: DegreeCentralityOptions): DegreeCentralityNormalizedResult;
}
//#endregion
//#region src/collection/algorithms/closeness-centrality.d.mts
/** Edge weighting function. */
type ClosenessCentralityWeightFn = (edge: EdgeSingular$1) => number;
/** Options accepted by the closeness-centrality methods. */
interface ClosenessCentralityOptions {
  harmonic?: boolean;
  weight?: ClosenessCentralityWeightFn;
  directed?: boolean;
  root?: SharedCollection | string | null;
}
/** Result of `closenessCentralityNormalized`. */
interface ClosenessCentralityNormalizedResult {
  closeness(node: SharedCollection | string): number;
}
interface AlgorithmsClosenessCentrality {
  closenessCentralityNormalized(this: SharedCollection, options?: ClosenessCentralityOptions): ClosenessCentralityNormalizedResult;
  closenessCentrality(this: SharedCollection, options?: ClosenessCentralityOptions): number;
  cc(this: SharedCollection, options?: ClosenessCentralityOptions): number;
  ccn(this: SharedCollection, options?: ClosenessCentralityOptions): ClosenessCentralityNormalizedResult;
  closenessCentralityNormalised(this: SharedCollection, options?: ClosenessCentralityOptions): ClosenessCentralityNormalizedResult;
}
//#endregion
//#region src/collection/algorithms/betweenness-centrality.d.mts
/** Edge weighting function. */
type BetweennessWeightFn = (edge: EdgeSingular$1) => number;
/** Options accepted by `betweennessCentrality`. */
interface BetweennessCentralityOptions {
  weight?: BetweennessWeightFn | null;
  directed?: boolean;
}
/** Result of `betweennessCentrality`. */
interface BetweennessCentralityResult {
  betweenness(node: SharedCollection | string): number | undefined;
  betweennessNormalized(node: SharedCollection | string): number;
  betweennessNormalised(node: SharedCollection | string): number;
}
interface AlgorithmsBetweennessCentrality {
  betweennessCentrality(this: SharedCollection, options?: BetweennessCentralityOptions): BetweennessCentralityResult;
  bc(this: SharedCollection, options?: BetweennessCentralityOptions): BetweennessCentralityResult;
}
//#endregion
//#region src/collection/algorithms/markov-clustering.d.mts
/** A similarity/attribute function: maps an edge to a numeric contribution. */
type MarkovAttributeFn = (edge: EdgeSingular$1) => number;
/** Options accepted by `markovClustering`. */
interface MarkovClusteringOptions$1 {
  expandFactor?: number;
  inflateFactor?: number;
  multFactor?: number;
  maxIterations?: number;
  attributes?: MarkovAttributeFn[];
}
interface AlgorithmsMarkovClustering {
  markovClustering(this: SharedCollection, options?: MarkovClusteringOptions$1): Collection$1[];
  mcl(this: SharedCollection, options?: MarkovClusteringOptions$1): Collection$1[];
}
//#endregion
//#region src/collection/algorithms/clustering-distances.d.mts
/** A built-in metric name (or a convenience alias for one). */
type DistanceMetricName = 'euclidean' | 'squaredEuclidean' | 'squared-euclidean' | 'squaredeuclidean' | 'manhattan' | 'max';
/**
 * A user-supplied distance function. When called via the function-method
 * branch (length === 0), it receives the two operands directly; otherwise it
 * is treated like a built-in and called with the per-dimension accessors.
 */
type CustomDistanceFn = (...args: any[]) => number;
type DistanceMetric = DistanceMetricName | CustomDistanceFn;
//#endregion
//#region src/collection/algorithms/k-clustering.d.mts
/** A node attribute accessor used as a clustering feature. */
type KAttributeFn = (node: NodeSingular$1) => number;
/** A feature-vector centroid (k-means / fuzzy c-means). */
type FeatureCentroid = number[];
/** Options accepted by the k-clustering methods. */
interface KClusteringOptions {
  k?: number;
  m?: number;
  sensitivityThreshold?: number;
  distance?: DistanceMetric;
  maxIterations?: number;
  attributes?: KAttributeFn[];
  testMode?: boolean;
  testCentroids?: number | FeatureCentroid[] | Element$2[] | null;
}
/** Result of `fuzzyCMeans`. */
interface FuzzyCMeansResult$1 {
  clusters: Collection$1[];
  degreeOfMembership: number[][];
}
interface AlgorithmsKClustering {
  kMeans(this: SharedCollection, options?: KClusteringOptions): Collection$1[];
  kMedoids(this: SharedCollection, options?: KClusteringOptions): Collection$1[];
  fuzzyCMeans(this: SharedCollection, options?: KClusteringOptions): FuzzyCMeansResult$1;
  fcm(this: SharedCollection, options?: KClusteringOptions): FuzzyCMeansResult$1;
}
//#endregion
//#region src/collection/algorithms/hierarchical-clustering.d.mts
interface HierarchicalClusteringOptions$1 {
  distance?: DistanceMetric;
  linkage?: string;
  mode?: 'threshold' | 'dendrogram';
  threshold?: number;
  addDendrogram?: boolean;
  dendrogramDepth?: number;
  attributes?: Array<(node: NodeSingular$1) => number>;
}
interface AlgorithmsHierarchicalClustering {
  hierarchicalClustering(options?: HierarchicalClusteringOptions$1): Collection$1[];
  hca(options?: HierarchicalClusteringOptions$1): Collection$1[];
}
//#endregion
//#region src/collection/algorithms/affinity-propagation.d.mts
/** A node attribute accessor used to quantify similarity. */
type AffinityAttributeFn = (node: NodeSingular$1) => number;
/** How to derive the on-diagonal preference value. */
type AffinityPreference = 'median' | 'mean' | 'min' | 'max' | number;
/** Options accepted by `affinityPropagation`. */
interface AffinityPropagationOptions$1 {
  distance?: DistanceMetric;
  preference?: AffinityPreference;
  damping?: number;
  maxIterations?: number;
  minIterations?: number;
  attributes?: AffinityAttributeFn[];
}
interface AlgorithmsAffinityPropagation {
  affinityPropagation(this: SharedCollection, options?: AffinityPropagationOptions$1): Collection$1[];
  ap(this: SharedCollection, options?: AffinityPropagationOptions$1): Collection$1[];
}
//#endregion
//#region src/collection/algorithms/hierholzer.d.mts
/** Options accepted by `hierholzer`. */
interface HierholzerOptions$1 {
  root?: SharedCollection | string;
  directed?: boolean;
}
/** Result of `hierholzer`: an Eulerian trail, if one exists. */
interface HierholzerResult$1 {
  found: boolean;
  trail: Collection$1 | undefined;
}
interface AlgorithmsHierholzer {
  hierholzer(this: SharedCollection, options?: HierholzerOptions$1 | SharedCollection | string, directed?: boolean): HierholzerResult$1;
}
//#endregion
//#region src/collection/algorithms/hopcroft-tarjan-biconnected.d.mts
/** Result of the Hopcroft-Tarjan biconnected-components algorithm. */
interface HopcroftTarjanBiconnectedResult {
  cut: Collection$1;
  components: Collection$1[];
}
interface AlgorithmsHopcroftTarjanBiconnected {
  hopcroftTarjanBiconnected(this: SharedCollection): HopcroftTarjanBiconnectedResult;
  htbc(this: SharedCollection): HopcroftTarjanBiconnectedResult;
  htb(this: SharedCollection): HopcroftTarjanBiconnectedResult;
  hopcroftTarjanBiconnectedComponents(this: SharedCollection): HopcroftTarjanBiconnectedResult;
}
//#endregion
//#region src/collection/algorithms/tarjan-strongly-connected.d.mts
/** Result of Tarjan's strongly-connected-components algorithm. */
interface TarjanStronglyConnectedResult {
  cut: Collection$1;
  components: Collection$1[];
}
interface AlgorithmsTarjanStronglyConnected {
  tarjanStronglyConnected(this: SharedCollection): TarjanStronglyConnectedResult;
  tsc(this: SharedCollection): TarjanStronglyConnectedResult;
  tscc(this: SharedCollection): TarjanStronglyConnectedResult;
  tarjanStronglyConnectedComponents(this: SharedCollection): TarjanStronglyConnectedResult;
}
//#endregion
//#region src/collection/algorithms/index.d.mts
/** All graph-algorithm methods contributed to the collection prototype. */
interface CollectionAlgorithms$1 extends AlgorithmsBfsDfs, AlgorithmsDijkstra, AlgorithmsKruskal, AlgorithmsAStar, AlgorithmsFloydWarshall, AlgorithmsBellmanFord, AlgorithmsKargerStein, AlgorithmsPageRank, AlgorithmsDegreeCentrality, AlgorithmsClosenessCentrality, AlgorithmsBetweennessCentrality, AlgorithmsMarkovClustering, AlgorithmsKClustering, AlgorithmsHierarchicalClustering, AlgorithmsAffinityPropagation, AlgorithmsHierholzer, AlgorithmsHopcroftTarjanBiconnected, AlgorithmsTarjanStronglyConnected {}
//#endregion
//#region src/collection/animation.d.mts
/** Animation methods contributed to the collection prototype. */
interface CollectionAnimation$1 {
  animate(this: SharedCollection, properties: AnimationOptions$1, params?: AnimationOptions$1): Collection$1;
  animation(this: SharedCollection, properties?: AnimationOptions$1, params?: AnimationOptions$1): Animation$1;
  animated(this: SharedCollection): boolean | undefined;
  clearQueue(this: SharedCollection): Collection$1;
  delay(this: SharedCollection, time: number, complete?: () => void): Collection$1;
  delayAnimation(this: SharedCollection, time: number, complete?: () => void): Animation$1;
  stop(this: SharedCollection, clearQueue?: boolean, jumpToEnd?: boolean): Collection$1;
}
//#endregion
//#region src/collection/class.d.mts
/** Class manipulation methods contributed to the collection prototype. */
interface CollectionClass {
  classes(): string[];
  classes(classes: string | string[]): Collection$1;
  className(): string[];
  className(classes: string | string[]): Collection$1;
  classNames(): string[];
  classNames(classes: string | string[]): Collection$1;
  addClass(classes: string | string[]): Collection$1;
  hasClass(className: string): boolean;
  toggleClass(classes: string | string[], toggle?: boolean): Collection$1;
  removeClass(classes: string | string[]): Collection$1;
  flashClass(classes: string | string[], duration?: number): Collection$1;
}
//#endregion
//#region src/collection/comparators.d.mts
/** Test callback for some()/every(). */
type CollectionTestFn = (ele: Element$2, i: number, eles: Collection$1) => boolean | void;
/** Collection comparison/predicate methods contributed to the prototype. */
interface CollectionComparators {
  allAre(selector: string): boolean;
  is(selector: string): boolean;
  some(fn: CollectionTestFn, thisArg?: unknown): boolean;
  every(fn: CollectionTestFn, thisArg?: unknown): boolean;
  same(collection: SharedCollection | string): boolean;
  anySame(collection: SharedCollection | string): boolean;
  allAreNeighbors(collection: SharedCollection | string): boolean;
  allAreNeighbours(collection: SharedCollection | string): boolean;
  contains(collection: SharedCollection | string): boolean;
  has(collection: SharedCollection | string): boolean;
}
//#endregion
//#region src/collection/compounds.d.mts
/** Compound-graph navigation methods contributed to the prototype. */
interface CollectionCompounds {
  parent(selector?: FilterArg): NodeCollection$1;
  parents(selector?: FilterArg): NodeCollection$1;
  ancestors(selector?: FilterArg): NodeCollection$1;
  commonAncestors(selector?: FilterArg): NodeCollection$1;
  orphans(selector?: FilterArg): NodeCollection$1;
  nonorphans(selector?: FilterArg): NodeCollection$1;
  children(selector?: FilterArg): NodeCollection$1;
  siblings(selector?: FilterArg): NodeCollection$1;
  isParent(): boolean | undefined;
  isChildless(): boolean | undefined;
  isChild(): boolean | undefined;
  isOrphan(): boolean | undefined;
  descendants(selector?: FilterArg): NodeCollection$1;
}
//#endregion
//#region src/collection/data.d.mts
/** Data/scratch accessors contributed to the collection prototype. */
interface CollectionData$1 {
  data: DataFunc<SharedCollection>;
  removeData: RemoveDataFunc<SharedCollection>;
  scratch: DataFunc<SharedCollection>;
  removeScratch: RemoveDataFunc<SharedCollection>;
  attr: DataFunc<SharedCollection>;
  removeAttr: RemoveDataFunc<SharedCollection>;
  id(): string | undefined;
}
//#endregion
//#region src/collection/degree.d.mts
/** Degree calculation methods contributed to the collection prototype. */
interface CollectionDegree {
  degree(includeLoops?: boolean): number | undefined;
  indegree(includeLoops?: boolean): number | undefined;
  outdegree(includeLoops?: boolean): number | undefined;
  minDegree(includeLoops?: boolean): number | undefined;
  maxDegree(includeLoops?: boolean): number | undefined;
  minIndegree(includeLoops?: boolean): number | undefined;
  maxIndegree(includeLoops?: boolean): number | undefined;
  minOutdegree(includeLoops?: boolean): number | undefined;
  maxOutdegree(includeLoops?: boolean): number | undefined;
  totalDegree(includeLoops?: boolean): number;
}
//#endregion
//#region src/collection/dimensions/position.d.mts
/** A function that computes a position for an element during `.positions()`. */
type PositionFn = (ele: Element$2, i: number) => Position$1 | undefined | false;
/**
 * The `.position()`-family accessor. Generated by `define.data`, but typed
 * with position-specific overloads (get returns a Position, set accepts a
 * full/partial Position, a (name, value) pair, or an event handler).
 */
interface PositionAccessor {
  (this: SharedCollection): Position$1;
  <Host extends SharedCollection>(this: Host, pos: Partial<Position$1>): Host;
  (this: SharedCollection, name: string): number;
  <Host extends SharedCollection>(this: Host, name: string, value: number): Host;
  <Host extends SharedCollection>(this: Host, handler: (...args: any[]) => void): Host;
}
/** Position accessor methods contributed to the collection prototype. */
interface CollectionPosition$1 {
  position: PositionAccessor;
  modelPosition: PositionAccessor;
  point: PositionAccessor;
  positions(this: SharedCollection, pos: Partial<Position$1> | PositionFn, silent?: boolean): Collection$1;
  modelPositions(this: SharedCollection, pos: Partial<Position$1> | PositionFn, silent?: boolean): Collection$1;
  points(this: SharedCollection, pos: Partial<Position$1> | PositionFn, silent?: boolean): Collection$1;
  shift(this: SharedCollection, dim: Partial<Position$1> | string, val?: number | boolean, silent?: boolean): Collection$1;
  renderedPosition(this: SharedCollection, dim?: Partial<Position$1> | string, val?: number): Position$1 | number | Collection$1 | undefined;
  renderedPoint(this: SharedCollection, dim?: Partial<Position$1> | string, val?: number): Position$1 | number | Collection$1 | undefined;
  relativePosition(this: SharedCollection, dim?: Partial<Position$1> | string, val?: number): Position$1 | number | Collection$1 | undefined;
  relativePoint(this: SharedCollection, dim?: Partial<Position$1> | string, val?: number): Position$1 | number | Collection$1 | undefined;
}
//#endregion
//#region src/collection/dimensions/bounds.d.mts
/** Options controlling which sub-parts are included in a bounding box. */
interface BoundingBoxOptions$1 {
  includeNodes?: boolean;
  includeEdges?: boolean;
  includeLabels?: boolean;
  includeMainLabels?: boolean;
  includeSourceLabels?: boolean;
  includeTargetLabels?: boolean;
  includeOverlays?: boolean;
  includeUnderlays?: boolean;
  includeOutlines?: boolean;
  useCache?: boolean;
  incudeNodes?: boolean;
}
/** Bounding-box methods contributed to the collection prototype. */
interface CollectionBounds {
  renderedBoundingBox(this: SharedCollection, options?: BoundingBoxOptions$1): BoundingBox$1;
  renderedBoundingbox(this: SharedCollection, options?: BoundingBoxOptions$1): BoundingBox$1;
  boundingBox(this: SharedCollection, options?: BoundingBoxOptions$1): BoundingBox$1;
  boundingbox(this: SharedCollection, options?: BoundingBoxOptions$1): BoundingBox$1;
  bb(this: SharedCollection, options?: BoundingBoxOptions$1): BoundingBox$1;
}
//#endregion
//#region src/collection/dimensions/width-height.d.mts
/** Width/height/padding accessors contributed to the collection prototype. */
interface CollectionWidthHeight {
  width(this: SharedCollection): number | undefined;
  outerWidth(this: SharedCollection): number | undefined;
  renderedWidth(this: SharedCollection): number | undefined;
  renderedOuterWidth(this: SharedCollection): number | undefined;
  height(this: SharedCollection): number | undefined;
  outerHeight(this: SharedCollection): number | undefined;
  renderedHeight(this: SharedCollection): number | undefined;
  renderedOuterHeight(this: SharedCollection): number | undefined;
}
//#endregion
//#region src/collection/dimensions/edge-points.d.mts
/** Edge-point accessors contributed to the collection prototype. */
interface CollectionEdgePoints {
  controlPoints(this: SharedCollection): Position$1[] | undefined;
  renderedControlPoints(this: SharedCollection): Position$1[] | undefined;
  segmentPoints(this: SharedCollection): Position$1[] | undefined;
  renderedSegmentPoints(this: SharedCollection): Position$1[] | undefined;
  sourceEndpoint(this: SharedCollection): Position$1 | undefined;
  renderedSourceEndpoint(this: SharedCollection): Position$1 | undefined;
  targetEndpoint(this: SharedCollection): Position$1 | undefined;
  renderedTargetEndpoint(this: SharedCollection): Position$1 | undefined;
  midpoint(this: SharedCollection): Position$1 | undefined;
  renderedMidpoint(this: SharedCollection): Position$1 | undefined;
}
//#endregion
//#region src/collection/dimensions/index.d.mts
/**
 * All dimension/geometry methods contributed to the collection prototype,
 * assembled from the per-file mixins (mirrors the runtime assembly below).
 */
interface CollectionDimensions extends CollectionPosition$1, CollectionBounds, CollectionWidthHeight, CollectionEdgePoints {}
//#endregion
//#region src/collection/events.d.mts
/** Public selector/handler arg of `.on()` and friends (2- or 3-arg form). */
type EventSelectorArg = string | Selector$1 | EventHandler$1 | null | undefined;
interface CollectionEvents$1 {
  on(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  removeListener(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  removeAllListeners(): Collection$1;
  one(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  once(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): void;
  emit(events: EmitInput, extraParams?: unknown[]): Collection$1;
  addListener(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  listen(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  bind(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  unlisten(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  unbind(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  off(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler$1): Collection$1;
  trigger(events: EmitInput, extraParams?: unknown[]): Collection$1;
  pon(events: string, selector?: EventSelectorArg): Promise<EventObject$1>;
  promiseOn(events: string, selector?: EventSelectorArg): Promise<EventObject$1>;
}
//#endregion
//#region src/collection/group.d.mts
/** Group/type-test methods contributed to the collection prototype. */
interface CollectionGroup {
  isNode(): boolean;
  isEdge(): boolean;
  isLoop(): boolean;
  isSimple(): boolean;
  group(): 'nodes' | 'edges' | undefined;
}
//#endregion
//#region src/collection/iteration.d.mts
/** Callback invoked per element during iteration. */
type EachFn = (ele: Element$2, i: number, eles: Collection$1) => unknown;
/** Callback returning a value per element (map/min/max). */
type MapFn<T> = (ele: Element$2, i: number, eles: Collection$1) => T;
/** Reducer callback. */
type ReduceFn<T> = (acc: T, ele: Element$2, i: number, eles: Collection$1) => T;
/** Comparator used by sort(). */
type SortFn = (a: Element$2, b: Element$2) => number;
/** Result of min()/max(). */
interface MinMaxResult<T = number> {
  value: T;
  ele: Element$2 | undefined;
}
interface CollectionIteration$1 {
  forEach(fn: EachFn, thisArg?: any): Collection$1;
  each(fn: EachFn, thisArg?: any): Collection$1;
  toArray(): Element$2[];
  slice(start?: number, end?: number): Collection$1;
  size(): number;
  eq(i: number): Element$2;
  first(): Element$2;
  last(): Element$2;
  empty(): boolean;
  nonempty(): boolean;
  sort(sortFn: SortFn): Collection$1;
  map<T>(mapFn: MapFn<T>, thisArg?: unknown): T[];
  reduce<T>(fn: ReduceFn<T>, initialValue: T): T;
  max(valFn: MapFn<number>, thisArg?: unknown): MinMaxResult;
  min(valFn: MapFn<number>, thisArg?: unknown): MinMaxResult;
  [Symbol.iterator](): Iterator<Element$2>;
}
//#endregion
//#region src/collection/layout.d.mts
/**
 * A layout instance as driven by the collection layout code: the public
 * `LayoutInstance` (run/stop/emit/on/… — see core-types) plus the internal
 * `animations` array that `layoutPositions` populates. The built-in layout
 * extensions pass themselves here.
 */
interface LayoutLike extends LayoutInstance {}
/** A node-positioning function used by `layoutPositions`. */
type LayoutPositionFn = (node: Element$2, i: number) => Position$1;
/** Built-in callback options shared by core- and collection-created layouts. */
interface LayoutCallbackOptions {
  position?: (node: NodeSingular$1) => {
    row?: number;
    col?: number;
  } | undefined;
  sort?: (a: NodeSingular$1, b: NodeSingular$1) => number;
  nodeRepulsion?: number | ((node: NodeSingular$1) => number);
  idealEdgeLength?: number | ((edge: EdgeSingular$1) => number);
  edgeElasticity?: number | ((edge: EdgeSingular$1) => number);
}
/** Options read by `layoutPositions` / `layout` / `makeLayout`. */
interface LayoutOptions$1 extends LayoutCallbackOptions {
  name: string;
  eles: Collection$1;
  spacingFactor?: number;
  transform?: (node: Element$2, pos: Position$1) => Position$1;
  animate?: boolean;
  animateFilter?: (node: Element$2, i: number) => boolean;
  animationDuration?: number;
  animationEasing?: string;
  fit?: boolean;
  padding?: number;
  zoom?: number;
  pan?: Position$1;
  ready?: () => void;
  stop?: () => void;
  [key: string]: unknown;
}
/** Public collection-layout options; the collection itself supplies `eles`. */
interface CollectionLayoutOptions extends LayoutCallbackOptions {
  name: string;
  eles?: Collection$1;
  spacingFactor?: number;
  transform?: (node: Element$2, pos: Position$1) => Position$1;
  animate?: boolean;
  animateFilter?: (node: Element$2, i: number) => boolean;
  animationDuration?: number;
  animationEasing?: string;
  fit?: boolean;
  padding?: number;
  zoom?: number;
  pan?: Position$1;
  ready?: () => void;
  stop?: () => void;
  [key: string]: unknown;
}
/** Options read by `layoutDimensions`. */
interface LayoutDimensionsOptions {
  nodeDimensionsIncludeLabels?: boolean;
}
/** Node dimensions returned by `layoutDimensions`. */
interface LayoutDimensions {
  w: number;
  h: number;
}
/** Layout methods contributed to the collection prototype. */
interface CollectionLayout$1 {
  layoutDimensions(this: SharedCollection, options: LayoutDimensionsOptions): LayoutDimensions;
  layoutPositions(this: SharedCollection, layout: LayoutLike, options: LayoutOptions$1, fn: LayoutPositionFn): Collection$1;
  layout(this: SharedCollection, options: CollectionLayoutOptions): LayoutLike;
  createLayout(this: SharedCollection, options: CollectionLayoutOptions): LayoutLike;
  makeLayout(this: SharedCollection, options: CollectionLayoutOptions): LayoutLike;
}
//#endregion
//#region src/collection/style.d.mts
/** Style accessor methods contributed to the collection prototype. */
interface CollectionStyle$1 {
  numericStyle(this: SharedCollection, property: string): any;
  numericStyleUnits(this: SharedCollection, property: string): string | (string | undefined)[] | undefined;
  renderedStyle(this: SharedCollection): Record<string, any>;
  renderedStyle(this: SharedCollection, property: string): any;
  style<Self extends SharedCollection>(this: Self, name: string, value: unknown): Self;
  style<Self extends SharedCollection>(this: Self, obj: Record<string, unknown>): Self;
  style(this: SharedCollection, name: string): any;
  style(this: SharedCollection): Record<string, any>;
  css<Self extends SharedCollection>(this: Self, name: string, value: unknown): Self;
  css<Self extends SharedCollection>(this: Self, obj: Record<string, unknown>): Self;
  css(this: SharedCollection, name: string): any;
  css(this: SharedCollection): Record<string, any>;
  renderedCss(this: SharedCollection): Record<string, any>;
  renderedCss(this: SharedCollection, property: string): any;
  removeStyle(this: SharedCollection, names?: string): Collection$1;
  effectiveOpacity(this: SharedCollection): number | undefined;
  transparent(this: SharedCollection): boolean | undefined;
  visible(this: SharedCollection): boolean | undefined;
  hidden(this: SharedCollection): boolean | undefined;
}
//#endregion
//#region src/collection/switch-functions.d.mts
interface CollectionSwitchFunctions {
  lock(...args: unknown[]): Collection$1;
  unlock(...args: unknown[]): Collection$1;
  grabify(...args: unknown[]): Collection$1;
  ungrabify(...args: unknown[]): Collection$1;
  select(...args: unknown[]): Collection$1;
  unselect(...args: unknown[]): Collection$1;
  deselect(...args: unknown[]): Collection$1;
  selectify(...args: unknown[]): Collection$1;
  unselectify(...args: unknown[]): Collection$1;
  panify(...args: unknown[]): Collection$1;
  unpanify(...args: unknown[]): Collection$1;
  locked(): boolean | undefined;
  grabbable(): boolean | undefined;
  grabbed(): boolean | undefined;
  selected(): boolean | undefined;
  selectable(): boolean | undefined;
  active(): boolean | undefined;
  pannable(): boolean | undefined;
}
//#endregion
//#region src/collection/traversing.d.mts
/** Selector/filter argument accepted by traversal methods. */
type SelectorArg = string | ((ele: Element$2, i: number, eles: Collection$1) => boolean | unknown) | SharedCollection | undefined | null;
interface CollectionTraversing$1 {
  roots(selector?: SelectorArg): NodeCollection$1;
  leaves(selector?: SelectorArg): NodeCollection$1;
  outgoers(selector?: SelectorArg): Collection$1;
  successors(selector?: SelectorArg): Collection$1;
  incomers(selector?: SelectorArg): Collection$1;
  predecessors(selector?: SelectorArg): Collection$1;
  neighborhood(selector?: SelectorArg): Collection$1;
  neighbourhood(selector?: SelectorArg): Collection$1;
  closedNeighborhood(selector?: SelectorArg): Collection$1;
  closedNeighbourhood(selector?: SelectorArg): Collection$1;
  openNeighborhood(selector?: SelectorArg): Collection$1;
  openNeighbourhood(selector?: SelectorArg): Collection$1;
  source(selector?: SelectorArg): NodeSingular$1;
  target(selector?: SelectorArg): NodeSingular$1;
  sources(selector?: SelectorArg): NodeCollection$1;
  targets(selector?: SelectorArg): NodeCollection$1;
  edgesWith(otherNodes: string | SharedCollection): EdgeCollection$1;
  edgesTo(otherNodes: string | SharedCollection): EdgeCollection$1;
  connectedEdges(selector?: SelectorArg): EdgeCollection$1;
  connectedNodes(selector?: SelectorArg): NodeCollection$1;
  parallelEdges(selector?: SelectorArg): EdgeCollection$1;
  codirectedEdges(selector?: SelectorArg): EdgeCollection$1;
  components(root?: SharedCollection | null): Collection$1[];
  componentsOf(root?: SharedCollection | null): Collection$1[];
  component(): Collection$1;
}
//#endregion
//#region src/collection/eles-types.d.mts
interface ElementData {
  id?: string;
  source?: string;
  target?: string;
  parent?: string;
  [key: string]: unknown;
}
/** JSON definition used to create an element. */
interface ElementDefinition$1 {
  group?: 'nodes' | 'edges';
  data?: ElementData;
  position?: Position$1;
  renderedPosition?: Position$1;
  selected?: boolean;
  selectable?: boolean;
  locked?: boolean;
  grabbable?: boolean;
  pannable?: boolean;
  classes?: string | string[];
  style?: Css.Node | Css.Edge;
  css?: Css.Node | Css.Edge;
  scratch?: Record<string, unknown>;
  parent?: Element$2 | null;
}
/** The shape produced/consumed by `eles.json()`. */
interface ElementJson {
  data: ElementData;
  position: Position$1;
  group: 'nodes' | 'edges';
  removed: boolean;
  selected: boolean;
  selectable: boolean;
  locked: boolean;
  grabbable: boolean;
  pannable: boolean;
  classes: string | null;
}
/** Methods defined directly in collection/index.mts (not via mixins). */
interface CollectionBaseFns {
  instanceString(): string;
  cy(): Core$1;
  getElementById(id: string | number): Collection$1;
  $id(id: string | number): Collection$1;
  json(obj?: Partial<ElementJson>): ElementJson | this | undefined;
  jsons(): (ElementJson | undefined)[];
  clone(): Collection$1;
  copy(): Collection$1;
  restore(notifyRenderer?: boolean, addToPool?: boolean): this;
  removed(): boolean;
  inside(): boolean;
  remove(notifyRenderer?: boolean, removeFromPool?: boolean): Collection$1;
  move(struct: {
    source?: string | number;
    target?: string | number;
    parent?: string | number | null;
  }): this;
}
/**
 * The wide internal collection type: the union of node and edge
 * capabilities, matching how the shared prototype actually behaves at
 * runtime. Public node/edge-narrowed projections are layered on top in
 * the entry point's public API types.
 */
interface Collection$1 extends CollectionBaseFns, CollectionAlgorithms$1, CollectionAnimation$1, CollectionClass, CollectionComparators, CollectionCompounds, CollectionData$1, CollectionDegree, CollectionDimensions, CollectionEvents$1, CollectionFilter, CollectionGroup, CollectionIteration$1, CollectionLayout$1, CollectionStyle$1, CollectionSwitchFunctions, CollectionTraversing$1 {
  length: number;
  [index: number]: Element$2;
}
/** A single element (node or edge); array-like of itself, length 1. */
interface Element$2 extends Collection$1 {
  length: 1;
}
type PublicSelectorArg = string | SharedCollection | ((ele: Element$2, i: number, eles: Collection$1) => boolean | unknown) | undefined | null;
/** Edge-only members hidden from the public node types. */
type EdgeOnlyKeys = 'source' | 'target' | 'sources' | 'targets' | 'connectedNodes' | 'parallelEdges' | 'codirectedEdges' | 'isLoop' | 'isSimple' | 'midpoint' | 'controlPoints' | 'segmentPoints' | 'sourceEndpoint' | 'targetEndpoint' | 'renderedMidpoint' | 'renderedControlPoints' | 'renderedSegmentPoints' | 'renderedSourceEndpoint' | 'renderedTargetEndpoint';
/** Node-only members hidden from the public edge types. */
type NodeOnlyKeys = 'parent' | 'parents' | 'ancestors' | 'commonAncestors' | 'children' | 'siblings' | 'descendants' | 'roots' | 'leaves' | 'orphans' | 'nonorphans' | 'isParent' | 'isChild' | 'isChildless' | 'isOrphan' | 'connectedEdges' | 'edgesWith' | 'edgesTo' | 'degree' | 'indegree' | 'outdegree' | 'totalDegree' | 'minDegree' | 'maxDegree' | 'minIndegree' | 'maxIndegree' | 'minOutdegree' | 'maxOutdegree' | 'incomers' | 'outgoers' | 'successors' | 'predecessors' | 'position' | 'positions' | 'modelPosition' | 'modelPositions' | 'point' | 'points' | 'relativePosition' | 'relativePoint' | 'renderedPosition' | 'renderedPoint' | 'shift' | 'grabbable' | 'grabbed' | 'grabify' | 'ungrabify' | 'lock' | 'unlock' | 'locked' | 'layoutDimensions' | 'layoutPositions' | 'affinityPropagation' | 'ap' | 'fuzzyCMeans' | 'fcm' | 'hierarchicalClustering' | 'hca' | 'kMeans' | 'kMedoids';
type KindAwareIterationKeys = number | 'forEach' | 'each' | 'toArray' | 'slice' | 'eq' | 'first' | 'last' | 'sort' | 'map' | 'reduce' | 'max' | 'min' | typeof Symbol.iterator;
interface KindAwareIteration<Single, Chain, Subset> {
  [index: number]: Single;
  forEach(fn: (ele: Single, i: number, eles: Chain) => unknown, thisArg?: any): Chain;
  each(fn: (ele: Single, i: number, eles: Chain) => unknown, thisArg?: any): Chain;
  toArray(): Single[];
  slice(start?: number, end?: number): Subset;
  eq(i: number): Single;
  first(): Single;
  last(): Single;
  sort(sortFn: (a: Single, b: Single) => number): Subset;
  map<T>(mapFn: (ele: Single, i: number, eles: Chain) => T, thisArg?: unknown): T[];
  reduce<T>(fn: (acc: T, ele: Single, i: number, eles: Chain) => T, initialValue: T): T;
  max(valFn: (ele: Single, i: number, eles: Chain) => number, thisArg?: unknown): {
    value: number;
    ele: Single | undefined;
  };
  min(valFn: (ele: Single, i: number, eles: Chain) => number, thisArg?: unknown): {
    value: number;
    ele: Single | undefined;
  };
  [Symbol.iterator](): Iterator<Single>;
}
interface KindAwareIterationCompatibility {}
/** Node-kind return-type narrowings layered over the wide collection. */
interface NodeKindNarrowed {
  parent(selector?: PublicSelectorArg): NodeCollection$1;
  parents(selector?: PublicSelectorArg): NodeCollection$1;
  ancestors(selector?: PublicSelectorArg): NodeCollection$1;
  commonAncestors(selector?: PublicSelectorArg): NodeCollection$1;
  orphans(selector?: PublicSelectorArg): NodeCollection$1;
  nonorphans(selector?: PublicSelectorArg): NodeCollection$1;
  children(selector?: PublicSelectorArg): NodeCollection$1;
  siblings(selector?: PublicSelectorArg): NodeCollection$1;
  descendants(selector?: PublicSelectorArg): NodeCollection$1;
  roots(selector?: PublicSelectorArg): NodeCollection$1;
  leaves(selector?: PublicSelectorArg): NodeCollection$1;
  connectedEdges(selector?: PublicSelectorArg): EdgeCollection$1;
}
/** Edge-kind return-type narrowings layered over the wide collection. */
interface EdgeKindNarrowed {
  source(selector?: PublicSelectorArg): NodeSingular$1;
  target(selector?: PublicSelectorArg): NodeSingular$1;
  sources(selector?: PublicSelectorArg): NodeCollection$1;
  targets(selector?: PublicSelectorArg): NodeCollection$1;
  connectedNodes(selector?: PublicSelectorArg): NodeCollection$1;
  parallelEdges(selector?: PublicSelectorArg): EdgeCollection$1;
  codirectedEdges(selector?: PublicSelectorArg): EdgeCollection$1;
}
type NodeNarrowedKeys = keyof NodeKindNarrowed;
type EdgeNarrowedKeys = keyof EdgeKindNarrowed;
/** Kind-agnostic collection: members common to both nodes and edges. */
type SharedCollection = Omit<Collection$1, EdgeOnlyKeys | NodeOnlyKeys | KindAwareIterationKeys> & KindAwareIterationCompatibility;
type NodeCollection$1 = Omit<Collection$1, EdgeOnlyKeys | NodeNarrowedKeys | KindAwareIterationKeys> & NodeKindNarrowed & KindAwareIteration<NodeSingular$1, NodeCollection$1, NodeCollection$1> & KindAwareIterationCompatibility;
type EdgeCollection$1 = Omit<Collection$1, NodeOnlyKeys | EdgeNarrowedKeys | KindAwareIterationKeys> & EdgeKindNarrowed & KindAwareIteration<EdgeSingular$1, EdgeCollection$1, EdgeCollection$1> & KindAwareIterationCompatibility;
type NodeSingular$1 = Omit<Element$2, EdgeOnlyKeys | NodeNarrowedKeys | KindAwareIterationKeys> & NodeKindNarrowed & KindAwareIteration<NodeSingular$1, NodeSingular$1, NodeCollection$1> & KindAwareIterationCompatibility;
type EdgeSingular$1 = Omit<Element$2, NodeOnlyKeys | EdgeNarrowedKeys | KindAwareIterationKeys> & EdgeKindNarrowed & KindAwareIteration<EdgeSingular$1, EdgeSingular$1, EdgeCollection$1> & KindAwareIterationCompatibility;
//#endregion
//#region src/style/css-types.d.mts
/**
 * Public style ("CSS") typing surface.
 *
 * GENERATED FILE — do not hand-edit the property blocks. It mirrors the runtime
 * style inventory in `src/style/properties.mts` (the source of truth for
 * property names and value families). Regenerate with `npm run gen:css-types`
 * after changing the style properties; `npm run test:types:css` audits that
 * this declaration set stays in sync with that inventory.
 */
declare namespace Css {
  type Colour = string;
  type MapperFunction<Element, Type> = (ele: Element) => Type;
  type PropertyValue<SingularType extends NodeSingular$1 | EdgeSingular$1 | Core$1, Type> = Type | MapperFunction<SingularType, Type>;
  type PropertyValueNode<Type> = PropertyValue<NodeSingular$1, Type>;
  type PropertyValueEdge<Type> = PropertyValue<EdgeSingular$1, Type>;
  type PropertyValueCore<Type> = PropertyValue<Core$1, Type>;
  type ArrowFill = 'filled' | 'hollow';
  type ArrowShape = 'tee' | 'triangle' | 'triangle-tee' | 'circle-triangle' | 'triangle-cross' | 'triangle-backcurve' | 'vee' | 'square' | 'circle' | 'diamond' | 'chevron' | 'none';
  type AxisDirection = 'horizontal' | 'leftward' | 'rightward' | 'vertical' | 'upward' | 'downward' | 'auto';
  type AxisDirectionPrimary = 'horizontal' | 'vertical';
  type BackgroundClip = 'none' | 'node';
  type BackgroundContainment = 'inside' | 'over';
  type BackgroundCrossOrigin = 'anonymous' | 'use-credentials' | 'null';
  type BackgroundFit = 'none' | 'contain' | 'cover';
  type BackgroundRelativeTo = 'inner' | 'include-padding';
  type BackgroundRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
  type BorderStyle = 'solid' | 'dotted' | 'dashed' | 'double';
  type BoxSelection = 'contain' | 'overlap' | 'none';
  type CompoundPosition = 'parent' | 'origin';
  type CompoundSizingWrtLabels = 'include' | 'exclude';
  type CurveStyle = 'bezier' | 'unbundled-bezier' | 'haystack' | 'segments' | 'straight' | 'straight-triangle' | 'taxi' | 'round-segments' | 'round-taxi';
  type Display = 'element' | 'none';
  type EdgeDistances = 'intersection' | 'node-position' | 'endpoints';
  type Fill = 'solid' | 'linear-gradient' | 'radial-gradient';
  type FontStyle = 'italic' | 'normal' | 'oblique';
  type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter' | '100' | '200' | '300' | '400' | '500' | '600' | '800' | '900' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  type GradientDirection = 'to-bottom' | 'to-top' | 'to-left' | 'to-right' | 'to-bottom-right' | 'to-bottom-left' | 'to-top-right' | 'to-top-left' | 'to-right-bottom' | 'to-left-bottom' | 'to-right-top' | 'to-left-top';
  type HorizontalAlign = 'left' | 'left-inside' | 'center' | 'right' | 'right-inside';
  type Justification = 'left' | 'center' | 'right' | 'auto';
  type LineCap = 'butt' | 'round' | 'square';
  type LineJoin = 'round' | 'bevel' | 'miter';
  type LinePosition = 'center' | 'inside' | 'outside';
  type LineStyle = 'solid' | 'dotted' | 'dashed';
  type NodeShape = 'rectangle' | 'roundrectangle' | 'round-rectangle' | 'cutrectangle' | 'cut-rectangle' | 'bottomroundrectangle' | 'bottom-round-rectangle' | 'barrel' | 'ellipse' | 'triangle' | 'round-triangle' | 'square' | 'pentagon' | 'round-pentagon' | 'hexagon' | 'round-hexagon' | 'concavehexagon' | 'concave-hexagon' | 'heptagon' | 'round-heptagon' | 'octagon' | 'round-octagon' | 'tag' | 'round-tag' | 'star' | 'diamond' | 'round-diamond' | 'vee' | 'rhomboid' | 'right-rhomboid' | 'polygon';
  type OverlayShape = 'roundrectangle' | 'round-rectangle' | 'ellipse';
  type PaddingRelativeTo = 'width' | 'height' | 'average' | 'min' | 'max';
  type RadiusType = 'arc-radius' | 'influence-radius';
  type TextBackgroundShape = 'rectangle' | 'roundrectangle' | 'round-rectangle' | 'circle';
  type TextMetrics = 'font' | 'glyph';
  type TextOverflowWrap = 'whitespace' | 'anywhere';
  type TextTransform = 'none' | 'uppercase' | 'lowercase';
  type TextWrap = 'none' | 'wrap' | 'ellipsis';
  type TransitionTimingFunction = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-in-sine' | 'ease-out-sine' | 'ease-in-out-sine' | 'ease-in-quad' | 'ease-out-quad' | 'ease-in-out-quad' | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic' | 'ease-in-quart' | 'ease-out-quart' | 'ease-in-out-quart' | 'ease-in-quint' | 'ease-out-quint' | 'ease-in-out-quint' | 'ease-in-expo' | 'ease-out-expo' | 'ease-in-out-expo' | 'ease-in-circ' | 'ease-out-circ' | 'ease-in-out-circ';
  type VerticalAlign = 'top' | 'top-inside' | 'center' | 'bottom' | 'bottom-inside';
  type Visibility = 'hidden' | 'visible';
  type ZCompoundDepth = 'bottom' | 'orphan' | 'auto' | 'top';
  type ZIndexCompare = 'auto' | 'manual';
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
    content?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'edge-text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
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
    'padding-left'?: PropertyValueNode<number | string>;
    'padding-right'?: PropertyValueNode<number | string>;
    'padding-top'?: PropertyValueNode<number | string>;
    'padding-bottom'?: PropertyValueNode<number | string>;
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
    'control-point-distance'?: PropertyValueEdge<number | string | Array<number | string>>;
    'control-point-weight'?: PropertyValueEdge<number | number[]>;
    'segment-distance'?: PropertyValueEdge<number | string | Array<number | string>>;
    'segment-weight'?: PropertyValueEdge<number | number[]>;
    'segment-radius'?: PropertyValueEdge<number | number[]>;
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
//#endregion
//#region src/stylesheet.d.mts
interface StylesheetProperty {
  name: string;
  value: unknown;
}
interface StylesheetContext {
  selector: string;
  properties: StylesheetProperty[];
}
interface Stylesheet {
  length: number;
  [index: number]: StylesheetContext;
  instanceString(): string;
  selector(selector: string): Stylesheet;
  css(name: string | Css.Node | Css.Edge | Css.Core, value?: unknown): Stylesheet;
  style(name: string | Css.Node | Css.Edge | Css.Core, value?: unknown): Stylesheet;
  generateStyle(cy: unknown): unknown;
  appendToStyle<S>(style: S): S;
}
interface StylesheetStatic {
  (this: unknown): Stylesheet;
  new (): Stylesheet;
  prototype: Stylesheet;
}
declare let Stylesheet: StylesheetStatic;
//#endregion
//#region src/version.d.mts
declare const _default: string;
//#endregion
//#region src/extensions/layout/layout-base.d.mts
/** Emitter methods grafted onto every layout instance by the extension wrapper. */
interface LayoutEmitter {
  emit(events: string, ...extra: any[]): this;
  one(events: string, handler: (...args: unknown[]) => void): this;
  on(events: string, handler: (...args: unknown[]) => void): this;
  off(events: string, handler?: (...args: unknown[]) => void): this;
  trigger(events: unknown): this;
  removeAllListeners(): this;
}
/** Options common to all built-in layouts (each layout extends this). */
interface LayoutOptionsBase {
  cy: Core$1;
  eles: Collection$1;
  fit?: boolean;
  padding?: number;
  boundingBox?: BoundingBox$1 | {
    x1: number;
    y1: number;
    w: number;
    h: number;
  } | undefined;
  animate?: boolean | 'end' | 'during';
  animationDuration?: number;
  animationEasing?: string;
  animateFilter?: (node: Collection$1, i: number) => boolean;
  ready?: () => void;
  stop?: () => void;
  transform?: (node: Collection$1, position: any) => any;
  [key: string]: unknown;
}
/** The runtime layout instance (`this` inside layout methods). */
interface LayoutBase extends LayoutEmitter {
  options: LayoutOptionsBase;
  run(): this;
  start(): this;
  stop(): this;
  destroy(): this;
  cy(): Core$1;
}
//#endregion
//#region src/extensions/layout/breadthfirst.d.mts
/** Options for the breadthfirst layout (from the `defaults` object). */
interface BreadthFirstLayoutOptions$1 extends LayoutOptionsBase {
  directed?: boolean;
  direction?: 'downward' | 'upward' | 'rightward' | 'leftward';
  circle?: boolean;
  grid?: boolean;
  spacingFactor?: number;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  roots?: SharedCollection | string | string[] | undefined;
  depthSort?: (a: Element$2, b: Element$2) => number;
  maximal?: boolean;
  acyclic?: boolean;
  maximalAdjustments?: number;
}
//#endregion
//#region src/extensions/layout/circle.d.mts
/** Options accepted by the circle layout. */
interface CircleLayoutOptions$1 extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  radius?: number;
  startAngle?: number;
  sweep?: number;
  clockwise?: boolean;
  counterclockwise?: boolean;
  sort?: (a: NodeSingular$1, b: NodeSingular$1) => number;
}
//#endregion
//#region src/extensions/layout/concentric.d.mts
/** Options accepted by the concentric layout. */
interface ConcentricLayoutOptions$1 extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
  startAngle?: number;
  sweep?: number;
  clockwise?: boolean;
  counterclockwise?: boolean;
  equidistant?: boolean;
  minNodeSpacing?: number;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  height?: number;
  width?: number;
  spacingFactor?: number;
  concentric?: (node: Collection$1) => number;
  levelWidth?: (nodes: Collection$1) => number;
}
//#endregion
//#region src/extensions/layout/cose.d.mts
/** Options for the CoSE layout (from the `defaults` object). */
interface CoseLayoutOptions$1 extends LayoutOptionsBase {
  animationThreshold?: number;
  refresh?: number;
  nodeDimensionsIncludeLabels?: boolean;
  randomize?: boolean;
  componentSpacing?: number;
  nodeRepulsion?: number | ((node: NodeSingular$1) => number);
  nodeOverlap?: number;
  idealEdgeLength?: number | ((edge: EdgeSingular$1) => number);
  edgeElasticity?: number | ((edge: EdgeSingular$1) => number);
  nestingFactor?: number;
  gravity?: number;
  numIter?: number;
  initialTemp?: number;
  coolingFactor?: number;
  minTemp?: number;
  debug?: boolean;
  layout?: CoseLayout;
}
interface CoseLayout extends LayoutBase {
  options: CoseLayoutOptions$1;
  stopped?: boolean;
  thread?: any;
}
/**
 * @brief       : constructor
 * @arg options : object containing layout options
 */
declare function CoseLayout(this: CoseLayout, options: CoseLayoutOptions$1): void;
//#endregion
//#region src/extensions/layout/grid.d.mts
/** A row/col position, as returned by the `position` option. */
interface RowCol {
  row?: number;
  col?: number;
}
/** Options accepted by the grid layout. */
interface GridLayoutOptions$1 extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
  avoidOverlap?: boolean;
  avoidOverlapPadding?: number;
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  condense?: boolean;
  rows?: number;
  cols?: number;
  columns?: number;
  position?: (node: NodeSingular$1) => RowCol | undefined;
  sort?: (a: NodeSingular$1, b: NodeSingular$1) => number;
}
//#endregion
//#region src/extensions/layout/null.d.mts
/** Options accepted by the null layout. */
interface NullLayoutOptions$1 extends LayoutOptionsBase {
  ready?: () => void;
  stop?: () => void;
}
//#endregion
//#region src/extensions/layout/preset.d.mts
/** Options accepted by the preset layout. */
interface PresetLayoutOptions$1 extends LayoutOptionsBase {
  positions?: Record<string, Position$1> | ((node: Collection$1) => Position$1 | null | undefined);
  zoom?: number;
  pan?: Position$1;
  fit?: boolean;
  padding?: number;
  spacingFactor?: number;
}
//#endregion
//#region src/extensions/layout/random.d.mts
/** Options accepted by the random layout. */
interface RandomLayoutOptions$1 extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
}
//#endregion
//#region src/public-types.d.mts
type Animation = Animation$1;
type AnimationOptions = AnimationOptions$1;
type Collection = Collection$1;
type Core = Core$1;
type CytoscapeOptions = CytoscapeOptions$1;
type EdgeCollection = EdgeCollection$1;
type EdgeSingular = EdgeSingular$1;
type Element$1 = SharedCollection & {
  length: 1;
};
type ElementDefinition = ElementDefinition$1;
type NodeCollection = NodeCollection$1;
type NodeSingular = NodeSingular$1;
type Singular = Element$1;
type Position = Position$1;
type BoundingBox = BoundingBox$1;
type BoundingBox12 = BoundingBox12$1;
type BoundingBoxWH = Pick<BoundingBox$1, 'x1' | 'y1' | 'w' | 'h'>;
type BoundingBoxOptions = BoundingBoxOptions$1;
type ElementGroup = 'nodes' | 'edges';
type PositionDimension = 'x' | 'y';
type SelectionType = 'additive' | 'single';
type Selector = string;
type ClassName = string;
type ClassNames = string | ClassName[];
type Scratchpad = Record<string, unknown>;
type CssStyleDeclaration = Css.Node | Css.Edge | Css.Core;
type ElementDataDefinition = ElementData;
interface NodeDataDefinition extends ElementData {
  parent?: string;
}
interface EdgeDataDefinition extends ElementData {
  source: string;
  target: string;
}
type NodeDefinition = Omit<ElementDefinition$1, 'group' | 'data'> & {
  group?: 'nodes';
  data: NodeDataDefinition;
};
type EdgeDefinition = Omit<ElementDefinition$1, 'group' | 'data'> & {
  group?: 'edges';
  data: EdgeDataDefinition;
};
interface ElementsDefinition {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}
type CytoscapeRegistry = (type: 'core' | 'collection' | 'layout', name: string, extension: unknown) => void;
interface ZoomOptionsModel {
  position: Position;
}
interface ZoomOptionsRendered {
  renderedPosition: Position;
}
interface ZoomOptionsLevel {
  level: number;
}
type ZoomOptions = number | (ZoomOptionsLevel & (ZoomOptionsModel | ZoomOptionsRendered));
type CoreAnimation = CoreAnimation$1;
type CoreData = CoreData$1;
type CoreEvents = CoreEvents$1;
type CoreExport = CoreExport$1;
type CoreLayout = CoreLayout$1;
type CoreStyle = CoreStyle$1;
type CoreViewportManipulation = CoreViewport;
type CoreGraphManipulation = Pick<Core$1, 'add' | 'remove' | 'collection' | 'getElementById' | '$id' | '$' | 'elements' | 'nodes' | 'edges' | 'filter' | 'batch' | 'startBatch' | 'endBatch' | 'mount' | 'unmount' | 'destroy' | 'destroyed'>;
type CoreGraphManipulationExt = Pick<Core$1, 'scratch' | 'removeScratch'>;
type CollectionAlgorithms = CollectionAlgorithms$1;
type CollectionAnimation = CollectionAnimation$1;
type CollectionComparision = CollectionComparators;
type CollectionData = CollectionData$1;
type CollectionEvents = CollectionEvents$1;
interface CollectionIteration<TOut = Element$1, TIn = TOut> extends Pick<CollectionIteration$1, 'size' | 'empty' | 'nonempty'> {
  length: number;
  [index: number]: TOut;
  each(fn: (ele: TIn, i: number, eles: this) => unknown, thisArg?: unknown): this;
  forEach(fn: (ele: TIn, i: number, eles: this) => unknown, thisArg?: unknown): this;
  eq(index: number): TOut;
  first(): TOut;
  last(): TOut;
  slice(start?: number, end?: number): this;
  toArray(): TOut[];
  sort(sort: (a: TIn, b: TIn) => number): this;
  map<T>(fn: (ele: TIn, i: number, eles: this) => T, thisArg?: unknown): T[];
  reduce<T>(fn: (value: T, ele: TIn, i: number, eles: this) => T, initialValue: T): T;
  max(fn: (ele: TIn, i: number, eles: this) => number, thisArg?: unknown): {
    value: number;
    ele: TOut | undefined;
  };
  min(fn: (ele: TIn, i: number, eles: this) => number, thisArg?: unknown): {
    value: number;
    ele: TOut | undefined;
  };
  [Symbol.iterator](): Iterator<TOut>;
}
type CollectionLayout = CollectionLayout$1;
type CollectionPosition = CollectionPosition$1 & CollectionDimensions & CollectionBounds;
type CollectionSelection = CollectionSwitchFunctions;
type CollectionStyle = CollectionStyle$1;
type CollectionTraversing = CollectionTraversing$1;
type CollectionGraphManipulation = Pick<Collection$1, 'remove' | 'restore' | 'clone' | 'copy' | 'move'>;
type CollectionArgument = Collection | EdgeCollection | NodeCollection | SingularElementArgument;
type CollectionReturnValue = Collection;
type SingularElementArgument = EdgeSingular | NodeSingular;
type SingularElementReturnValue = Singular;
type CollectionBuildingDifferenceFunc = (eles: CollectionArgument | Selector) => CollectionReturnValue;
type CollectionBuildingIntersectionFunc = (eles: CollectionArgument | Selector) => CollectionReturnValue;
type CollectionBuildingUnionFunc = (eles: CollectionArgument | Selector) => CollectionReturnValue;
type CollectionSymmetricDifferenceFunc = (eles: CollectionArgument | Selector) => CollectionReturnValue;
type PublicCollectionFilter = Pick<CollectionFilter, 'nodes' | 'edges' | 'not' | 'difference' | 'relativeComplement' | 'subtract' | 'diff' | 'absoluteComplement' | 'complement' | 'abscomp' | 'intersect' | 'intersection' | 'and' | 'xor' | 'symmetricDifference' | 'symdiff' | 'add' | 'union' | 'or' | 'merge' | 'unmerge'>;
type CollectionBuildingFiltering<TIn = SingularElementArgument, TOut = SingularElementReturnValue> = PublicCollectionFilter & Pick<Collection$1, 'getElementById' | '$id'> & {
  u: PublicCollectionFilter['union'];
  '+': PublicCollectionFilter['union'];
  '|': PublicCollectionFilter['union'];
  '\\': PublicCollectionFilter['difference'];
  '!': PublicCollectionFilter['difference'];
  '-': PublicCollectionFilter['difference'];
  n: PublicCollectionFilter['intersection'];
  '&': PublicCollectionFilter['intersection'];
  '.': PublicCollectionFilter['intersection'];
  '^': PublicCollectionFilter['symmetricDifference'];
  '(+)': PublicCollectionFilter['symmetricDifference'];
  '(-)': PublicCollectionFilter['symmetricDifference'];
  filter(selector?: Selector | ((ele: TIn, i: number, eles: CollectionArgument) => boolean)): CollectionReturnValue;
  sort(sort: (a: TIn, b: TIn) => number): CollectionReturnValue;
  map<T>(fn: (ele: TIn, i: number, eles: CollectionArgument) => T, thisArg?: unknown): T[];
  reduce<T>(fn: (value: T, ele: TIn, i: number, eles: CollectionArgument) => T, initialValue: T): T;
  min(fn: (ele: TIn, i: number, eles: CollectionArgument) => number, thisArg?: unknown): {
    value: number;
    ele: TOut | undefined;
  };
  max(fn: (ele: TIn, i: number, eles: CollectionArgument) => number, thisArg?: unknown): {
    value: number;
    ele: TOut | undefined;
  };
};
type ElementPositionFunction = (ele: NodeSingular, ix: number) => Position;
type ElementCollectionFunction = (ele: NodeSingular, ix: number, eles: CollectionArgument) => Position;
type NodeCollectionCompound = CollectionCompounds;
type NodeCollectionLayout = CollectionLayout$1;
type NodeCollectionMetadata = Pick<NodeCollection, 'totalDegree' | 'minDegree' | 'maxDegree' | 'minIndegree' | 'maxIndegree' | 'minOutdegree' | 'maxOutdegree'>;
type NodeCollectionPosition = CollectionPosition$1;
type NodeCollectionTraversing = Pick<NodeCollection, 'edgesWith' | 'edgesTo' | 'connectedEdges' | 'roots' | 'leaves' | 'outgoers' | 'successors' | 'incomers' | 'predecessors'>;
type NodeSingularCompound = CollectionCompounds;
type NodeSingularLayout = CollectionLayout$1;
type NodeSingularMetadata = Pick<NodeSingular, 'degree' | 'indegree' | 'outdegree'>;
type NodeSingularPosition = CollectionPosition$1;
type EdgeCollectionTraversing = Pick<EdgeCollection, 'connectedNodes' | 'sources' | 'targets' | 'parallelEdges' | 'codirectedEdges'>;
type EdgeSingularData = Pick<EdgeSingular, 'isLoop' | 'isSimple'>;
type EdgeSingularPoints = CollectionEdgePoints;
type EdgeSingularTraversing = Pick<EdgeSingular, 'source' | 'target'>;
type SingularData = Pick<Singular, 'scratch' | 'removeScratch' | 'id' | 'json' | 'group' | 'isNode' | 'isEdge' | 'component'>;
type SingularGraphManipulation = CollectionGraphManipulation;
type SingularPosition = CollectionPosition$1;
type SingularSelection = CollectionSwitchFunctions;
type SingularStyle = Pick<Singular, 'hasClass' | 'renderedStyle' | 'renderedCss' | 'numericStyle' | 'numericStyleUnits' | 'visible' | 'hidden' | 'effectiveOpacity' | 'transparent'>;
interface AnimationFitOptions {
  eles: CollectionArgument | Selector;
  padding: number;
}
interface CenterOptions {
  eles: CollectionArgument | Selector;
}
type AnimateOptions = AnimationOptions$1;
type AnimationManipulation = Animation$1;
type ElementAnimateOptionsBase = AnimationOptions$1;
type ElementAnimateOptionPos = AnimationOptions$1 & {
  position?: Position;
};
type ElementAnimateOptionRen = AnimationOptions$1 & {
  renderedPosition?: Position;
};
type SingularAnimation = CollectionAnimation$1;
type SingularAnimationOptionsBase = AnimationOptions$1;
type SingularAnimationOptionsPos = AnimationOptions$1 & {
  position?: Position;
};
type SingularAnimationOptionsRen = AnimationOptions$1 & {
  renderedPosition?: Position;
};
type ExportOptions = ExportOptions$1;
type ExportStringOptions = ExportStringOptions$1;
type ExportBlobOptions = ExportBlobOptions$1;
type ExportBlobPromiseOptions = ExportBlobPromiseOptions$1;
type ExportJpgOptions = ExportJpgOptions$1;
type ExportJpgStringOptions = ExportJpgStringOptions$1;
type ExportJpgBlobOptions = ExportJpgBlobOptions$1;
type ExportJpgBlobPromiseOptions = ExportJpgBlobPromiseOptions$1;
type StylesheetJson = StyleJson;
type StylesheetJsonBlock = StyleJsonBlock;
interface StylesheetStyle {
  selector: string;
  style: Css.Node | Css.Edge | Css.Core;
}
interface StylesheetCSS {
  selector: string;
  css: Css.Node | Css.Edge | Css.Core;
}
type ElementStylesheetStyle = StylesheetStyle;
type ElementStylesheetCSS = StylesheetCSS;
type Style = Style$1;
type RemoveIndexSignature<T> = { [Key in keyof T as string extends Key ? never : number extends Key ? never : symbol extends Key ? never : Key]: T[Key]; };
type PublicLayoutCallbacks = {
  ready?: () => void;
  stop?: () => void;
  transform?: (node: NodeSingular, position: Position) => Position;
  animateFilter?: (node: NodeSingular, index: number) => boolean;
};
type PublicLayoutOptions<T, TName extends string, Omitted extends PropertyKey = never> = Omit<RemoveIndexSignature<T>, 'cy' | 'eles' | 'name' | keyof PublicLayoutCallbacks | Omitted> & PublicLayoutCallbacks & {
  name: TName;
  [key: string]: unknown;
};
type BaseLayoutOptions = PublicLayoutOptions<LayoutOptionsBase, string>;
type AnimatedLayoutOptions = Pick<BaseLayoutOptions, 'animate' | 'animationDuration' | 'animationEasing' | 'animateFilter'>;
type ShapedLayoutOptions = BaseLayoutOptions & AnimatedLayoutOptions & {
  fit?: boolean;
  padding?: number;
  boundingBox?: BoundingBox12 | BoundingBoxWH;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  sort?: SortingFunction;
};
type NullLayoutOptions = PublicLayoutOptions<NullLayoutOptions$1, 'null'>;
type RandomLayoutOptions = PublicLayoutOptions<RandomLayoutOptions$1, 'random'>;
type PresetLayoutOptions = PublicLayoutOptions<PresetLayoutOptions$1, 'preset', 'positions'> & {
  positions?: NodePositionMap | NodePositionFunction;
};
type GridLayoutOptions = PublicLayoutOptions<GridLayoutOptions$1, 'grid'>;
type CircleLayoutOptions = PublicLayoutOptions<CircleLayoutOptions$1, 'circle'>;
type ConcentricLayoutOptions = PublicLayoutOptions<ConcentricLayoutOptions$1, 'concentric'>;
type BreadthFirstLayoutOptions = PublicLayoutOptions<BreadthFirstLayoutOptions$1, 'breadthfirst'>;
type CoseLayoutOptions = PublicLayoutOptions<CoseLayoutOptions$1, 'cose'>;
type LayoutOptions = NullLayoutOptions | RandomLayoutOptions | PresetLayoutOptions | GridLayoutOptions | CircleLayoutOptions | ConcentricLayoutOptions | BreadthFirstLayoutOptions | CoseLayoutOptions | BaseLayoutOptions;
type Layouts = LayoutInstance;
type LayoutManipulation = LayoutInstance;
type LayoutEvents = LayoutInstance;
type LayoutHandler = (event: LayoutEventObject) => void;
type LayoutPositionOptions = Pick<LayoutOptions$1, 'animate' | 'animationDuration' | 'animationEasing' | 'fit' | 'padding' | 'spacingFactor' | 'pan' | 'zoom'> & PublicLayoutCallbacks & {
  eles: CollectionArgument;
};
type LayoutDimensionOptions = LayoutDimensionsOptions;
interface NodePositionMap {
  [nodeid: string]: Position;
}
type NodePositionFunction = (node: NodeSingular) => Position | null | undefined;
type SortingFunction = NonNullable<GridLayoutOptions['sort']>;
type WeightFn = (edge: EdgeSingular) => number;
type SearchVisitFunction = SearchVisitFn;
type SearchFirstOptionsBase = Omit<SearchOptions, 'root' | 'roots'>;
type SearchFirstOptions1 = SearchFirstOptionsBase & {
  roots: NonNullable<SearchOptions['roots']>;
  root?: SearchOptions['root'];
};
type SearchFirstOptions2 = SearchFirstOptionsBase & {
  root: NonNullable<SearchOptions['root']>;
  roots?: SearchOptions['roots'];
};
type SearchFirstOptions = SearchFirstOptions1 | SearchFirstOptions2;
type SearchFirstResult = SearchResult;
type SearchAStarOptions = Omit<AStarOptions, 'root' | 'goal'> & {
  root: NonNullable<AStarOptions['root']>;
  goal: NonNullable<AStarOptions['goal']>;
};
type SearchAStarResult = AStarResult;
type SearchBellmanFordOptions = Omit<BellmanFordOptions, 'root'> & {
  root: NonNullable<BellmanFordOptions['root']>;
};
type SearchBellmanFordResult = BellmanFordResult;
type SearchDijkstraOptions = Omit<DijkstraOptions, 'root'> & {
  root: NonNullable<DijkstraOptions['root']>;
};
type SearchDijkstraResult = DijkstraResult;
type SearchFloydWarshallOptions = FloydWarshallOptions;
type SearchFloydWarshallResult = FloydWarshallResult;
type SearchPageRankOptions = PageRankOptions;
type SearchPageRankResult = PageRankResult;
type SearchBetweennessOptions = BetweennessCentralityOptions;
type SearchBetweennessResult = BetweennessCentralityResult;
type SearchClosenessCentralityOptions = Omit<ClosenessCentralityOptions, 'root'> & {
  root: NonNullable<ClosenessCentralityOptions['root']>;
};
type SearchClosenessCentralityNormalizedOptions = ClosenessCentralityOptions;
type SearchClosenessCentralityNormalizedResult = ClosenessCentralityNormalizedResult;
type SearchDegreeCentralityOptions = Omit<DegreeCentralityOptions, 'root'> & {
  root: NonNullable<DegreeCentralityOptions['root']>;
};
type SearchDegreeCentralityNormalizedOptions = DegreeCentralityOptions;
type SearchDegreeCentralityResultDirected = DirectedDegreeCentrality;
type SearchDegreeCentralityResultUndirected = UndirectedDegreeCentrality;
type SearchDegreeCentralityNormalizedResultDirected = DirectedDegreeCentralityNormalized;
type SearchDegreeCentralityNormalizedResultUndirected = UndirectedDegreeCentralityNormalized;
type AffinityPropagationOptions = AffinityPropagationOptions$1;
type AffinityPropagationResult = ReturnType<CollectionAlgorithms$1['affinityPropagation']>;
type KMeansOptions = KClusteringOptions;
type KMeansResult = ReturnType<CollectionAlgorithms$1['kMeans']>;
type KMedoidsOptions = KClusteringOptions;
type KMedoidsResult = ReturnType<CollectionAlgorithms$1['kMedoids']>;
type FuzzyCMeansOptions = KClusteringOptions;
type FuzzyCMeansResult = FuzzyCMeansResult$1;
type HierarchicalClusteringOptions = HierarchicalClusteringOptions$1;
type HierarchicalClusteringResult = ReturnType<CollectionAlgorithms$1['hierarchicalClustering']>;
type MarkovClusteringOptions = MarkovClusteringOptions$1;
type MarkovClusteringResult = ReturnType<CollectionAlgorithms$1['markovClustering']>;
type HierholzerOptions = HierholzerOptions$1;
type HierholzerResult = HierholzerResult$1;
type SearchAlgorithms = Pick<CollectionAlgorithms$1, 'breadthFirstSearch' | 'bfs' | 'depthFirstSearch' | 'dfs' | 'dijkstra' | 'aStar' | 'floydWarshall' | 'bellmanFord' | 'hierholzer'>;
type SpanningAlgorithms = Pick<CollectionAlgorithms$1, 'kruskal'>;
type CutAlgorithms = Pick<CollectionAlgorithms$1, 'kargerStein' | 'hopcroftTarjanBiconnected' | 'hopcroftTarjanBiconnectedComponents' | 'htb' | 'htbc' | 'tarjanStronglyConnected' | 'tarjanStronglyConnectedComponents' | 'tsc' | 'tscc'>;
type CentralityAlgorithms = Pick<CollectionAlgorithms$1, 'degreeCentrality' | 'degreeCentralityNormalized' | 'closenessCentrality' | 'closenessCentralityNormalized' | 'betweennessCentrality' | 'pageRank'>;
type ClusteringAlgorithms = Pick<CollectionAlgorithms$1, 'markovClustering' | 'kMeans' | 'hierarchicalClustering' | 'kMedoids' | 'fuzzyCMeans' | 'affinityPropagation'>;
type MinumumSpanningTree = Collection;
type AbstractEventObject = AbstractEventObject$1;
type EventObject = EventObject$1;
type EventObjectNode = EventObjectNode$1;
type EventObjectEdge = EventObjectEdge$1;
type EventObjectCore = EventObjectCore$1;
type InputEventObject = InputEventObject$1;
type LayoutEventObject = LayoutEventObject$1;
type EventHandler = EventHandler$1;
type EventNames = string;
type UserInputDeviceEventName = 'mousedown' | 'mouseup' | 'click' | 'mouseover' | 'mouseout' | 'mousemove' | 'touchstart' | 'touchmove' | 'touchend';
type UserInputDeviceEventNameExt = 'tapstart' | 'vmousedown' | 'tapdrag' | 'vmousemove' | 'tapdragover' | 'tapdragout' | 'tapend' | 'vmouseup' | 'tap' | 'vclick' | 'taphold' | 'cxttapstart' | 'cxttapend' | 'cxttap' | 'cxtdrag' | 'cxtdragover' | 'cxtdragout' | 'boxstart' | 'boxend' | 'boxselect' | 'box';
type CollectionEventName = 'add' | 'remove' | 'move' | 'select' | 'unselect' | 'tapselect' | 'tapunselect' | 'boxselect' | 'box' | 'lock' | 'unlock' | 'grabon' | 'grab' | 'drag' | 'free' | 'freeon' | 'dragfree' | 'dragfreeon' | 'position' | 'data' | 'scratch' | 'style' | 'background';
type GraphEventName = 'layoutstart' | 'layoutready' | 'layoutstop' | 'ready' | 'destroy' | 'render' | 'pan' | 'dragpan' | 'zoom' | 'pinchzoom' | 'scrollzoom' | 'viewport' | 'resize';
//#endregion
//#region src/index.d.mts
/** A plugin registrant, as passed to `cytoscape.use(ext)`. */
type CytoscapeExtension<Args extends unknown[] = any[]> = (cy: CytoscapeFactory, ...args: Args) => void;
/** Legacy extension registrant name retained for v3 declaration compatibility. */
type Ext = CytoscapeExtension;
/** The cytoscape factory: create an instance, or register an extension. */
interface CytoscapeFactory {
  (options?: CytoscapeOptions$1): Core;
  (type: string, name: string, registrant?: unknown): unknown;
  use<Args extends unknown[]>(ext: CytoscapeExtension<Args>, ...args: Args): CytoscapeFactory;
  warnings(bool?: boolean): boolean;
  version: string;
  stylesheet: typeof Stylesheet;
  Stylesheet: typeof Stylesheet;
}
declare function cytoscape(options?: CytoscapeOptions$1): Core;
declare namespace cytoscape {
  export var use: <Args extends unknown[]>(this: CytoscapeFactory, ext: CytoscapeExtension<Args>, ...args: Args) => CytoscapeFactory;
  var _a: (bool?: boolean) => boolean;
  export { _a as warnings };
  export { _default as version };
  export var stylesheet: StylesheetStatic;
  export { Stylesheet };
}
declare function cytoscape(type: string, name: string, registrant?: unknown): unknown;
//#endregion

declare namespace cytoscape {
  export { type AbstractEventObject, type AffinityPropagationOptions, type AffinityPropagationResult, type AnimateOptions, type AnimatedLayoutOptions, type Animation, type AnimationFitOptions, type AnimationManipulation, type AnimationOptions, type BaseLayoutOptions, type BoundingBox, type BoundingBox12, type BoundingBoxOptions, type BoundingBoxWH, type BreadthFirstLayoutOptions, type CenterOptions, type CentralityAlgorithms, type CircleLayoutOptions, type ClassName, type ClassNames, type ClusteringAlgorithms, type Collection, type CollectionAlgorithms, type CollectionAnimation, type CollectionArgument, type CollectionBuildingDifferenceFunc, type CollectionBuildingFiltering, type CollectionBuildingIntersectionFunc, type CollectionBuildingUnionFunc, type CollectionComparision, type CollectionData, type CollectionEventName, type CollectionEvents, type CollectionGraphManipulation, type CollectionIteration, type CollectionLayout, type CollectionPosition, type CollectionReturnValue, type CollectionSelection, type CollectionStyle, type CollectionSymmetricDifferenceFunc, type CollectionTraversing, type ConcentricLayoutOptions, type Core, type CoreAnimation, type CoreData, type CoreEvents, type CoreExport, type CoreGraphManipulation, type CoreGraphManipulationExt, type CoreLayout, type CoreStyle, type CoreViewportManipulation, type CoseLayoutOptions, type Css, type CssStyleDeclaration, type CutAlgorithms, CytoscapeExtension, CytoscapeFactory, type CytoscapeOptions, type CytoscapeRegistry, type EdgeCollection, type EdgeCollectionTraversing, type EdgeDataDefinition, type EdgeDefinition, type EdgeSingular, type EdgeSingularData, type EdgeSingularPoints, type EdgeSingularTraversing, type Element$1 as Element, type ElementAnimateOptionPos, type ElementAnimateOptionRen, type ElementAnimateOptionsBase, type ElementCollectionFunction, type ElementDataDefinition, type ElementDefinition, type ElementGroup, type ElementJson, type ElementPositionFunction, type ElementStylesheetCSS, type ElementStylesheetStyle, type ElementsDefinition, type EventHandler, type EventNames, type EventObject, type EventObjectCore, type EventObjectEdge, type EventObjectNode, type ExportBlobOptions, type ExportBlobPromiseOptions, type ExportJpgBlobOptions, type ExportJpgBlobPromiseOptions, type ExportJpgOptions, type ExportJpgStringOptions, type ExportOptions, type ExportStringOptions, Ext, type FuzzyCMeansOptions, type FuzzyCMeansResult, type GraphEventName, type GridLayoutOptions, type HierarchicalClusteringOptions, type HierarchicalClusteringResult, type HierholzerOptions, type HierholzerResult, type InputEventObject, type KMeansOptions, type KMeansResult, type KMedoidsOptions, type KMedoidsResult, type LayoutDimensionOptions, type LayoutEventObject, type LayoutEvents, type LayoutHandler, type LayoutInstance, type LayoutManipulation, type LayoutOptions, type LayoutPositionOptions, type Layouts, type MarkovClusteringOptions, type MarkovClusteringResult, type MinumumSpanningTree, type NodeCollection, type NodeCollectionCompound, type NodeCollectionLayout, type NodeCollectionMetadata, type NodeCollectionPosition, type NodeCollectionTraversing, type NodeDataDefinition, type NodeDefinition, type NodePositionFunction, type NodePositionMap, type NodeSingular, type NodeSingularCompound, type NodeSingularLayout, type NodeSingularMetadata, type NodeSingularPosition, type NullLayoutOptions, type Position, type PositionDimension, type PresetLayoutOptions, type RandomLayoutOptions, type RendererInstance, type Scratchpad, type SearchAStarOptions, type SearchAStarResult, type SearchAlgorithms, type SearchBellmanFordOptions, type SearchBellmanFordResult, type SearchBetweennessOptions, type SearchBetweennessResult, type SearchClosenessCentralityNormalizedOptions, type SearchClosenessCentralityNormalizedResult, type SearchClosenessCentralityOptions, type SearchDegreeCentralityNormalizedOptions, type SearchDegreeCentralityNormalizedResultDirected, type SearchDegreeCentralityNormalizedResultUndirected, type SearchDegreeCentralityOptions, type SearchDegreeCentralityResultDirected, type SearchDegreeCentralityResultUndirected, type SearchDijkstraOptions, type SearchDijkstraResult, type SearchFirstOptions, type SearchFirstOptions1, type SearchFirstOptions2, type SearchFirstOptionsBase, type SearchFirstResult, type SearchFloydWarshallOptions, type SearchFloydWarshallResult, type SearchPageRankOptions, type SearchPageRankResult, type SearchVisitFunction, type SelectionType, type Selector, type ShapedLayoutOptions, type Singular, type SingularAnimation, type SingularAnimationOptionsBase, type SingularAnimationOptionsPos, type SingularAnimationOptionsRen, type SingularData, type SingularElementArgument, type SingularElementReturnValue, type SingularGraphManipulation, type SingularPosition, type SingularSelection, type SingularStyle, type SortingFunction, type SpanningAlgorithms, type Style, type StyleJson, type StyleJsonBlock, type StylesheetCSS, type StylesheetJson, type StylesheetJsonBlock, type StylesheetStyle, type UserInputDeviceEventName, type UserInputDeviceEventNameExt, type WeightFn, type ZoomOptions, type ZoomOptionsLevel, type ZoomOptionsModel, type ZoomOptionsRendered };
}
export = cytoscape;
export as namespace cytoscape;
