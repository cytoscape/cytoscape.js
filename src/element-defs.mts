import type { GroupName } from './contract.mjs';
import type { ElementDefinition, ElementsDefinition } from './public-types.mjs';

/*
Element-definition plumbing shared by the core's add paths and the columnar
converter: group inference and clone-free partitioning of the accepted
definition shapes (single def, def array, { nodes, edges } map).
*/

export const inferGroup = ( def: ElementDefinition ): GroupName => {
  if( def.group != null ){
    if( def.group !== 'nodes' && def.group !== 'edges' ){
      throw new Error( `An element must be of group 'nodes' or 'edges'; got '${def.group}'` );
    }

    return def.group;
  }

  return def.data?.source != null && def.data?.target != null ? 'edges' : 'nodes';
};

export interface PartitionedDefs {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
}

/**
 * Split defs by group without cloning them.  In the `{ nodes, edges }` map
 * form the bucket decides the group (matching v3, where the bucket always
 * stamped the group); in the flat forms the group is inferred per def.
 */
export const partitionDefs = ( defs: ElementsDefinition | ElementDefinition ): PartitionedDefs => {
  if( Array.isArray( defs ) ){
    const nodes: ElementDefinition[] = [];
    const edges: ElementDefinition[] = [];

    for( const def of defs ){
      ( inferGroup( def ) === 'nodes' ? nodes : edges ).push( def );
    }

    return { nodes, edges };
  }

  const asMap = defs as { nodes?: ElementDefinition[]; edges?: ElementDefinition[] };

  if( asMap.nodes != null || asMap.edges != null ){
    return { nodes: asMap.nodes ?? [], edges: asMap.edges ?? [] };
  }

  const single = defs as ElementDefinition;

  return inferGroup( single ) === 'nodes'
    ? { nodes: [ single ], edges: [] }
    : { nodes: [], edges: [ single ] };
};
