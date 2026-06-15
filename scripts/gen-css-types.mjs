// Generates src/style/css-types.mts (the public `Css.*` style typing surface)
// from the runtime style inventory in src/style/properties.mts — the source of
// truth for property names, element-kind grouping, and value families. Run via
// `npm run gen:css-types` whenever style properties change; the
// `npm run test:types:css` audit verifies the committed declarations stay in
// sync with the runtime inventory.
//
// Needs tsx to import the .mts runtime inventory (the npm script wires it).
import fs from 'node:fs';
import styfn from '../src/style/properties.mjs';

const types = styfn.types;
const typeName = new Map( Object.entries( types ).map( ( [ k, v ] ) => [ v, k ] ) );
const groupNames = styfn.propertyGroupNames; // group -> [names]
const propByName = styfn.properties; // table doubles as a name -> descriptor map

// Which generated interface each runtime property group maps onto. Keep in sync
// with GROUP_TARGET in test/types-css-surface.mjs.
const IFACE = {
  behavior: 'Common', transition: 'Common', visibility: 'Common',
  overlay: 'Common', underlay: 'Common', ghost: 'Common',
  commonLabel: 'Common', labelDimensions: 'Common', mainLabel: 'Common',
  sourceLabel: 'Common', targetLabel: 'Common',
  nodeBody: 'Node', nodeBorder: 'Node', nodeOutline: 'Node',
  backgroundImage: 'Node', pie: 'Node', stripe: 'Node', compound: 'Node',
  edgeLine: 'Edge', edgeArrow: 'Edge',
  core: 'Core'
};

// runtime value-type name -> named enum alias (alias body sourced from the
// runtime `enums`, so the literal unions track the engine automatically)
const ENUM_ALIAS = {
  nodeShape: 'NodeShape', overlayShape: 'OverlayShape', lineStyle: 'LineStyle',
  lineCap: 'LineCap', linePosition: 'LinePosition', lineJoin: 'LineJoin',
  borderStyle: 'BorderStyle', curveStyle: 'CurveStyle', radiusType: 'RadiusType',
  fill: 'Fill', boxSelection: 'BoxSelection', fontStyle: 'FontStyle',
  fontWeight: 'FontWeight', textDecoration: 'TextDecoration', textTransform: 'TextTransform',
  textWrap: 'TextWrap', textOverflowWrap: 'TextOverflowWrap', textBackgroundShape: 'TextBackgroundShape',
  compoundIncludeLabels: 'CompoundSizingWrtLabels', arrowShape: 'ArrowShape', arrowFill: 'ArrowFill',
  display: 'Display', visibility: 'Visibility', zCompoundDepth: 'ZCompoundDepth',
  zIndexCompare: 'ZIndexCompare', valign: 'VerticalAlign', halign: 'HorizontalAlign',
  justification: 'Justification', textMetrics: 'TextMetrics', edgeDistances: 'EdgeDistances',
  gradientDirection: 'GradientDirection', easing: 'TransitionTimingFunction',
  axisDirection: 'AxisDirection', axisDirectionPrimary: 'AxisDirectionPrimary',
  axisDirectionExplicit: 'AxisDirectionExplicit', paddingRelativeTo: 'PaddingRelativeTo',
  bgRelativeTo: 'BackgroundRelativeTo', bgRepeat: 'BackgroundRepeat', bgFit: 'BackgroundFit',
  bgCrossOrigin: 'BackgroundCrossOrigin', bgClip: 'BackgroundClip', bgContainment: 'BackgroundContainment',
  position: 'CompoundPosition'
};

// runtime value-type name -> scalar/structured TS value type
const SCALAR = {
  time: 'number | string', percent: 'number | string',
  percentages: 'number | string | Array<number | string>',
  zeroOneNumber: 'number', zeroOneNumbers: 'number | number[]',
  nOneOneNumber: 'number', nonNegativeInt: 'number', nonNegativeNumber: 'number',
  nodeSize: 'number | string', number: 'number', numbers: 'number | number[]',
  positiveNumber: 'number', size: 'number | string',
  bidirectionalSize: 'number | string', bidirectionalSizeMaybePercent: 'number | string',
  bidirectionalSizes: 'number | string | Array<number | string>',
  sizeMaybePercent: 'number | string',
  bgWH: 'number | string | Array<number | string>',
  bgPos: 'number | string | Array<number | string>',
  color: 'Colour', colors: 'Colour | Colour[]',
  bool: "'yes' | 'no'", bools: "'yes' | 'no' | Array<'yes' | 'no'>",
  cornerRadius: 'number | string', arrowWidth: 'number | string',
  text: 'string', fontFamily: 'string', propList: 'string | string[]',
  url: 'string', urls: 'string | string[]',
  angle: 'number | string', textRotation: 'number | string',
  polygonPointList: 'string | number[]',
  edgeEndpoint: 'string | number | Array<number | string>',
  boundsExpansion: 'number | number[]'
};

function enumBody( name ){
  let vals = ( types[ name ].enums || [] ).filter( ( v, i, a ) => a.indexOf( v ) === i );

  return vals.map( v => typeof v === 'number' ? String( v ) : `'${v}'` ).join( ' | ' );
}

function valueType( tname ){
  if( ENUM_ALIAS[ tname ] ){ return ENUM_ALIAS[ tname ]; }
  if( SCALAR[ tname ] ){ return SCALAR[ tname ]; }

  throw new Error( `Unmapped style value-type family '${tname}'. Add it to ENUM_ALIAS or SCALAR in scripts/gen-css-types.mjs.` );
}

function wrap( iface, vt ){
  if( iface === 'Node' ){ return `PropertyValueNode<${vt}>`; }
  if( iface === 'Edge' ){ return `PropertyValueEdge<${vt}>`; }
  if( iface === 'Core' ){ return `PropertyValueCore<${vt}>`; }

  return `PropertyValueNode<${vt}> | PropertyValueEdge<${vt}>`; // Common (node or edge)
}

function key( name ){ return /[^a-zA-Z0-9_$]/.test( name ) ? `'${name}'` : name; }

const members = { Common: [], Node: [], Edge: [], Core: [] };
const usedEnums = new Set();

for( let group of styfn.propertyGroupKeys ){
  let iface = IFACE[ group ];

  if( !iface ){
    throw new Error( `Unmapped style property group '${group}'. Update IFACE in scripts/gen-css-types.mjs.` );
  }

  for( let name of groupNames[ group ] ){
    let tname = typeName.get( propByName[ name ].type );

    if( ENUM_ALIAS[ tname ] ){ usedEnums.add( tname ); }

    members[ iface ].push( `    ${key( name )}?: ${wrap( iface, valueType( tname ) )};` );
  }
}

for( let alias of styfn.aliases ){
  let target = propByName[ alias.pointsTo ];
  let iface = IFACE[ target.groupKey ];
  let tname = typeName.get( target.type );

  if( ENUM_ALIAS[ tname ] ){ usedEnums.add( tname ); }

  members[ iface ].push( `    ${key( alias.name )}?: ${wrap( iface, valueType( tname ) )}; // alias of '${alias.pointsTo}'` );
}

const enumDefs = [ ...usedEnums ]
  .map( tname => ( { alias: ENUM_ALIAS[ tname ], body: enumBody( tname ) } ) )
  .sort( ( a, b ) => a.alias.localeCompare( b.alias ) )
  .map( e => `  type ${e.alias} =\n    | ${e.body.split( ' | ' ).join( '\n    | ' )};` )
  .join( '\n\n' );

const header = `import type { EdgeSingular, NodeSingular } from '../collection/eles-types.mjs';
// aliased so the namespace-local \`Css.Core\` property block (below) does not
// shadow the cytoscape instance type used by core-property mapper functions
import type { Core as CoreInstance } from '../core/core-types.mjs';

/**
 * Public style ("CSS") typing surface.
 *
 * GENERATED FILE — do not hand-edit the property blocks. It mirrors the runtime
 * style inventory in \`src/style/properties.mts\` (the source of truth for
 * property names and value families). Regenerate with \`npm run gen:css-types\`
 * after changing the style properties; \`npm run test:types:css\` audits that
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
`;

const out = `${header}
${enumDefs}

  interface CommonElement {
    [name: string]: PropertyValueNode<unknown> | PropertyValueEdge<unknown> | undefined;
${members.Common.join( '\n' )}
  }

  interface Node extends CommonElement {
${members.Node.join( '\n' )}
  }

  interface Edge extends CommonElement {
${members.Edge.join( '\n' )}
  }

  interface Core {
    [name: string]: PropertyValueCore<unknown> | undefined;
${members.Core.join( '\n' )}
  }
}
`;

const outPath = new URL( '../src/style/css-types.mts', import.meta.url );

fs.writeFileSync( outPath, out );

console.log( `wrote src/style/css-types.mts (common ${members.Common.length}, node ${members.Node.length}, edge ${members.Edge.length}, core ${members.Core.length}; ${usedEnums.size} enums)` );
