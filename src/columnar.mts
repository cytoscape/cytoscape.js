import { partitionDefs } from './element-defs.mjs';
import { NO_PARENT } from './gpu-types.mjs';
import type {
  GpuColumnarEdges, GpuColumnarElements, GpuColumnarNodes,
  GpuElementDefinition, GpuElementsDefinition, GpuPackedIds
} from './gpu-types.mjs';

/*
Definition-form (v3-style JSON) → columnar bulk-load form.  The columnar
form is what the loader ingests fastest — typed-array columns, edge
endpoints as node indices — and this converter is the compat path for
callers holding classic elements JSON.  Payloads are self-contained:
every edge endpoint must name a node in the same payload.
*/

/**
 * Whether an id column is in the packed byte form rather than a plain
 * array of strings.
 *
 * @param ids — the id column to test
 * @returns true for the `{ offsets, blob }` packed form
 */
export const isPackedIds = (
  ids: ( string | undefined )[] | GpuPackedIds
): ids is GpuPackedIds => {
  return !Array.isArray( ids );
};

/**
 * Whether an elements payload is in the columnar bulk-load form.
 *
 * @param elements — a payload in definition or columnar form
 * @returns true when it carries `columnar: true`
 */
export const isColumnarElements = (
  elements: GpuElementsDefinition | GpuElementDefinition | GpuColumnarElements
): elements is GpuColumnarElements => {
  return ( elements as GpuColumnarElements ).columnar === true;
};

/**
 * Convert classic v3-style elements JSON into the columnar bulk-load
 * form: typed-array columns with edge endpoints as node *indices*.
 *
 * This is the compatibility path for callers holding definition-form
 * JSON; the columnar form is what the loader ingests fastest, since
 * contiguous slot runs become memcpys and no per-element objects or
 * per-edge id lookups are needed.  Exposed publicly as
 * `cytoscape.toColumnarElements`.
 *
 * @param defs — one element, an array, or `{ nodes, edges }`
 * @returns the equivalent self-contained columnar payload
 * @throws if an edge names a source or target that is not a node in the
 *   same payload — columnar payloads must be self-contained
 */
export const toColumnarElements = (
  defs: GpuElementsDefinition | GpuElementDefinition
): GpuColumnarElements => {
  const { nodes, edges } = partitionDefs( defs );
  const index = new Map<string, number>();

  const nodeIds = new Array<string | undefined>( nodes.length );
  const nodesOut: GpuColumnarNodes = {
    count: nodes.length,
    ids: nodeIds,
    positions: new Float32Array( nodes.length * 2 )
  };

  for( let i = 0; i < nodes.length; i++ ){
    const def = nodes[ i ];
    const rawId = def.data?.id;
    const id = rawId != null ? String( rawId ) : undefined;

    nodeIds[ i ] = id;

    if( id != null ){ index.set( id, i ); }

    const pos = def.position;

    if( pos != null ){
      nodesOut.positions![ i * 2 ] = pos.x;
      nodesOut.positions![ i * 2 + 1 ] = pos.y;
    }
  }

  applySelectionColumns( nodesOut, nodes );

  // def parents lift into the parent column (round 14.8): payload
  // indices, sentinel = orphan; an unknown in-payload parent warns and
  // orphans (the def-ingest rule — payloads are self-contained)
  let parents: Uint32Array | undefined;

  for( let i = 0; i < nodes.length; i++ ){
    const rawParent = nodes[ i ].data?.parent;

    if( rawParent == null ){ continue; }

    const at = index.get( String( rawParent ) );

    if( at == null ){
      console.warn(
        `Node '${nodeIds[ i ] ?? '?'}' has nonexistant parent '${String( rawParent )}'; added as an orphan` );

      continue;
    }

    parents ??= new Uint32Array( nodes.length ).fill( NO_PARENT );
    parents[ i ] = at;
  }

  if( parents != null ){ nodesOut.parent = parents; }

  const nodeData = collectDataColumns( nodes, true );

  if( nodeData != null ){ nodesOut.data = nodeData; }

  const edgeIds = new Array<string | undefined>( edges.length );
  const edgesOut: GpuColumnarEdges = {
    count: edges.length,
    ids: edgeIds,
    sources: new Uint32Array( edges.length ),
    targets: new Uint32Array( edges.length )
  };

  const endpoint = ( edgeId: string | undefined, which: 'source' | 'target', raw: unknown ): number => {
    if( raw == null ){
      throw new Error( `Can not create edge '${edgeId ?? '?'}' without a source and target` );
    }

    const at = index.get( String( raw ) );

    if( at == null ){
      throw new Error(
        `The ${which} '${String( raw )}' of edge '${edgeId ?? '?'}' is not a node in this payload ` +
        `(columnar payloads are self-contained; use the definition form for cross-references)`
      );
    }

    return at;
  };

  for( let i = 0; i < edges.length; i++ ){
    const def = edges[ i ];
    const data = def.data ?? {};
    const id = data.id != null ? String( data.id ) : undefined;

    edgeIds[ i ] = id;
    edgesOut.sources[ i ] = endpoint( id, 'source', data.source );
    edgesOut.targets[ i ] = endpoint( id, 'target', data.target );
  }

  applySelectionColumns( edgesOut, edges );

  const edgeData = collectDataColumns( edges );

  if( edgeData != null ){ edgesOut.data = edgeData; }

  return { columnar: true, nodes: nodesOut, edges: edgesOut };
};

/** Sidecar data() keys → sparse index-aligned columns (id/source/target
 * stay first-class; a node's parent is hierarchy, never sidecar). */
const collectDataColumns = (
  defs: GpuElementDefinition[], skipParent: boolean = false
): Record<string, unknown[]> | undefined => {
  let cols: Record<string, unknown[]> | undefined;

  for( let i = 0; i < defs.length; i++ ){
    const data = defs[ i ].data;

    if( data == null ){ continue; }

    for( const key of Object.keys( data ) ){
      if( key === 'id' || key === 'source' || key === 'target' || data[ key ] === undefined ){ continue; }
      if( skipParent && key === 'parent' ){ continue; }

      ( ( cols ??= {} )[ key ] ??= new Array( defs.length ) )[ i ] = data[ key ];
    }
  }

  return cols;
};

/** Build selected/selectable arrays only when some def deviates from the defaults. */
const applySelectionColumns = (
  out: { count: number; selected?: Uint8Array; selectable?: Uint8Array },
  defs: GpuElementDefinition[]
): void => {
  for( let i = 0; i < defs.length; i++ ){
    if( defs[ i ].selected === true ){
      out.selected ??= new Uint8Array( out.count );
      out.selected[ i ] = 1;
    }

    if( defs[ i ].selectable === false ){
      out.selectable ??= new Uint8Array( out.count ).fill( 1 );
      out.selectable[ i ] = 0;
    }
  }
};
