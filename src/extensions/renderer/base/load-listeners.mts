import * as is from '../../../is.mjs';
import * as util from '../../../util/index.mjs';
import * as math from '../../../math.mjs';
import { setFreed, setGrabbed } from './grab-state.mjs';
import type { Renderer, Element } from '../renderer-types.mjs';

// internal prototype-mixin object; reached via the open-ended Renderer surface
const BRp: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

/* global document, ResizeObserver, MutationObserver */

BRp.registerBinding = function( this: Renderer, target: any, event?: any, handler?: any, useCapture?: any ){ // eslint-disable-line no-unused-vars, @typescript-eslint/no-explicit-any
  // eslint-disable-next-line prefer-rest-params
  let args = Array.prototype.slice.apply( arguments, [1] ); // copy

  if( Array.isArray(target) ){
    let res = [];
    for( let i = 0; i < target.length; i++ ){
      let t = target[i];
      if( t !== undefined ){
        let b = this.binder( t );
        res.push( b.on.apply( b, args ) ); // eslint-disable-line prefer-spread
      }
    }
    return res;
  }

  let b = this.binder( target );
  return b.on.apply( b, args ); // eslint-disable-line prefer-spread
};

BRp.binder = function( this: Renderer, tgt: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cy.window() is the container's window (non-null in DOM contexts)
  let containerWindow: any = r.cy.window();

  let tgtIsDom = tgt === containerWindow || tgt === containerWindow.document || tgt === containerWindow.document.body || is.domElement( tgt );

  if( r.supportsPassiveEvents == null ){

    // from https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md#feature-detection
    let supportsPassive = false;
    try {
      let opts = Object.defineProperty( {}, 'passive', {
        get: function(){
          supportsPassive = true;

          return true;
        }
      } );

      containerWindow.addEventListener( 'test', null, opts );
    } catch( err ){ // eslint-disable-line no-unused-vars
      // not supported
    }

    r.supportsPassiveEvents = supportsPassive;
  }

  let on = function( this: any, event: string, handler: any, useCapture?: boolean ){ // eslint-disable-line no-unused-vars, @typescript-eslint/no-explicit-any
    // eslint-disable-next-line prefer-rest-params
    let args = Array.prototype.slice.call( arguments );

    if( tgtIsDom && r.supportsPassiveEvents ){ // replace useCapture w/ opts obj
      args[2] = {
        capture: useCapture != null ? useCapture : false,
        passive: false,
        once: false
      };
    }

    r.bindings.push({
      target: tgt,
      args: args
    });

    ( tgt.addEventListener || tgt.on ).apply( tgt, args ); // eslint-disable-line prefer-spread

    return this;
  };

  return {
    on: on,
    addEventListener: on,
    addListener: on,
    bind: on
  };
};

BRp.nodeIsDraggable = function( node: Element ){
  return (
    node
    && node.isNode()
    && !node.locked()
    && node.grabbable()
  );
};

BRp.nodeIsGrabbable = function( this: Renderer, node: Element ){
  return (
    this.nodeIsDraggable( node )
    && node.interactive()
  );
};

BRp.load = function( this: Renderer ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let containerWindow = r.cy.window();
  let isSelected = ( ele: Element ) => ele.selected();

  let getShadowRoot = function( element: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any
    const rootNode = element.getRootNode();
    // Check if the root node is a shadow root
    if ( rootNode && rootNode.nodeType === 11 && rootNode.host !== undefined ) {
      return rootNode;
    }
  };

  let triggerEvents = function( target: any, names: string[], e: Event, position?: { x: number; y: number } ){ // eslint-disable-line @typescript-eslint/no-explicit-any
    if( target == null ){
      target = r.cy;
    }

    for( let i = 0; i < names.length; i++ ){
      let name = names[ i ];

      target.emit({
        originalEvent: e,
        type: name,
        position
      });
    }
  };

  let isMultSelKeyDown = function( e: MouseEvent | TouchEvent ){
    return e.shiftKey || e.metaKey || e.ctrlKey; // maybe e.altKey
  };

  let allowPanningPassthrough = function( down: Element | null, downs?: Element[] | null ){
    let allowPassthrough = true;

    if( r.cy.hasCompoundNodes() && down && down.pannable() ){
      // a grabbable compound node below the ele => no passthrough panning
      for( let i = 0; downs && i < downs.length; i++ ){
        let down = downs[i];

        //if any parent node in event hierarchy isn't pannable, reject passthrough
        if( down.isNode() && down.isParent() && !down.pannable() ){
          allowPassthrough = false;
          break;
        }
      }
    } else {
      allowPassthrough = true;
    }

    return allowPassthrough;
  };

  let setInDragLayer = function( ele: Element ){
    ele[0]._private.rscratch.inDragLayer = true;
  };

  let setOutDragLayer = function( ele: Element ){
    ele[0]._private.rscratch.inDragLayer = false;
  };

  let setGrabTarget = function( ele: Element ){
    ele[0]._private.rscratch.isGrabTarget = true;
  };

  let removeGrabTarget = function( ele: Element ){
    ele[0]._private.rscratch.isGrabTarget = false;
  };

  let addToDragList = function( ele: Element, opts: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any
    let list = opts.addToList;
    let listHasEle = list.has(ele);

    if( !listHasEle && ele.grabbable() && !ele.locked() ){
      list.merge( ele );
      setGrabbed( ele );
    }
  };

  // helper function to determine which child nodes and inner edges
  // of a compound node to be dragged as well as the grabbed and selected nodes
  let addDescendantsToDrag = function( node: any, opts: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any -- accepts node or collection
    if( !node.cy().hasCompoundNodes() ){
      return;
    }

    if( opts.inDragLayer == null && opts.addToList == null ){ return; } // nothing to do

    let innerNodes = node.descendants();

    if( opts.inDragLayer ){
      innerNodes.forEach( setInDragLayer );
      innerNodes.connectedEdges().forEach( setInDragLayer );
    }

    if( opts.addToList ){
      addToDragList(innerNodes, opts);
    }
  };

  // adds the given nodes and its neighbourhood to the drag layer
  let addNodesToDrag = function( nodes: any, opts?: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any -- accepts node or collection
    opts = opts || {};

    let hasCompoundNodes = nodes.cy().hasCompoundNodes();

    if( opts.inDragLayer ){
      nodes.forEach( setInDragLayer );

      nodes.neighborhood().stdFilter(function( ele: Element ){
        return !hasCompoundNodes || ele.isEdge();
      }).forEach( setInDragLayer );
    }

    if( opts.addToList ){
      nodes.forEach(function( ele: Element ){
        addToDragList( ele, opts );
      });
    }

    addDescendantsToDrag( nodes, opts ); // always add to drag

    // also add nodes and edges related to the topmost ancestor
    updateAncestorsInDragLayer( nodes, {
      inDragLayer: opts.inDragLayer
    } );

    r.updateCachedGrabbedEles();
  };

  let addNodeToDrag = addNodesToDrag;

  let freeDraggedElements = function( grabbedEles: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any -- collection of dragged eles
    if( !grabbedEles ){ return; }

    // just go over all elements rather than doing a bunch of (possibly expensive) traversals
    r.getCachedZSortedEles().forEach(function( ele: Element ){
      setFreed( ele );
      setOutDragLayer( ele );
      removeGrabTarget( ele );
    });

    r.updateCachedGrabbedEles();
  };

  // helper function to determine which ancestor nodes and edges should go
  // to the drag layer (or should be removed from drag layer).
  let updateAncestorsInDragLayer = function( node: any, opts: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any -- accepts node or collection

    if( opts.inDragLayer == null && opts.addToList == null ){ return; } // nothing to do

    if( !node.cy().hasCompoundNodes() ){
      return;
    }

    // find top-level parent
    let parent = node.ancestors().orphans();

    // no parent node: no nodes to add to the drag layer
    if( parent.same( node ) ){
      return;
    }

    let nodes = parent.descendants().spawnSelf()
      .merge( parent )
      .unmerge( node )
      .unmerge( node.descendants() )
    ;

    let edges = nodes.connectedEdges();

    if( opts.inDragLayer ){
      edges.forEach( setInDragLayer );
      nodes.forEach( setInDragLayer );
    }

    if( opts.addToList ){
      nodes.forEach(function( ele: Element ){
        addToDragList( ele, opts );
      });
    }
  };

  let blurActiveDomElement = function(){
    if( document.activeElement != null && ( document.activeElement as HTMLElement ).blur != null ){
      ( document.activeElement as HTMLElement ).blur();
    }
  };

  let haveMutationsApi = typeof MutationObserver !== 'undefined';
  let haveResizeObserverApi = typeof ResizeObserver !== 'undefined';

  // watch for when the cy container is removed from the dom
  if( haveMutationsApi ){
    r.removeObserver = new MutationObserver( function( mutns: MutationRecord[] ){ // eslint-disable-line no-undef
      for( let i = 0; i < mutns.length; i++ ){
        let mutn = mutns[ i ];
        let rNodes = mutn.removedNodes;

        if( rNodes ){ for( let j = 0; j < rNodes.length; j++ ){
          let rNode = rNodes[ j ];

          if( rNode === r.container ){
            r.destroy();
            break;
          }
        } }
      }
    } );

    if( r.container!.parentNode ){
      r.removeObserver.observe( r.container!.parentNode, { childList: true } );
    }
  } else {
    r.registerBinding( r.container, 'DOMNodeRemoved', function( e: Event ){ // eslint-disable-line no-unused-vars
      r.destroy();
    } );
  }

  let onResize = util.debounce( function(){
    r.cy.resize();
  }, 100 );

  if( haveMutationsApi ){
    r.styleObserver = new MutationObserver( onResize ); // eslint-disable-line no-undef

    r.styleObserver.observe( r.container, { attributes: true } );
  }

  // auto resize
  r.registerBinding( containerWindow, 'resize', onResize ); // eslint-disable-line no-undef

  if( haveResizeObserverApi ){
    r.resizeObserver = new ResizeObserver(onResize); // eslint-disable-line no-undef

    r.resizeObserver.observe( r.container );
  }

  let forEachUp = function( domEle: Node | null, fn: ( el: Node ) => void ){
    while( domEle != null ){
      fn( domEle );

      domEle = domEle.parentNode;
    }
  };

  let invalidateCoords = function(){
    r.invalidateContainerClientCoordsCache();
  };

  forEachUp( r.container, function( domEle: Node ){
    r.registerBinding( domEle, 'transitionend', invalidateCoords );
    r.registerBinding( domEle, 'animationend', invalidateCoords );
    r.registerBinding( domEle, 'scroll', invalidateCoords );
  } );

  // stop right click menu from appearing on cy
  r.registerBinding( r.container, 'contextmenu', function( e: Event ){
    e.preventDefault();
  } );

  let inBoxSelection = function(){
    return r.selection[4] !== 0;
  };

  let eventInContainer = function( e: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any -- mixed mouse/touch event reads e.touches
    // save cycles if mouse events aren't to be captured
    let containerPageCoords = r.findContainerClientCoords();
    let x = containerPageCoords[0];
    let y = containerPageCoords[1];
    let width = containerPageCoords[2];
    let height = containerPageCoords[3];

    let positions = e.touches ? e.touches : [ e ];
    let atLeastOnePosInside = false;

    for( let i = 0; i < positions.length; i++ ){
      let p = positions[i];

      if( x <= p.clientX && p.clientX <= x + width
        && y <= p.clientY && p.clientY <= y + height
      ){
        atLeastOnePosInside = true;
        break;
      }
    }

    if( !atLeastOnePosInside ){ return false; }

    let container = r.container;
    let target = e.target;
    let tParent = target.parentNode;
    let containerIsTarget = false;

    while( tParent ){
      if( tParent === container ){
        containerIsTarget = true;
        break;
      }

      tParent = tParent.parentNode;
    }

    if( !containerIsTarget ){ return false; } // if target is outisde cy container, then this event is not for us

    return true;
  };

  // Primary key
  r.registerBinding( r.container, 'mousedown', function mousedownHandler( e: MouseEvent ){
    if( !eventInContainer(e) ){ return; }

    // during left mouse button gestures, ignore other buttons
    if (r.hoverData.which === 1 && e.which !== 1) {
      return;
    }

    e.preventDefault();

    blurActiveDomElement();

    r.hoverData.capture = true;
    r.hoverData.which = e.which;

    let cy = r.cy;
    let gpos = [ e.clientX, e.clientY ];
    let pos = r.projectIntoViewport( gpos[0], gpos[1] );
    let select = r.selection;
    let nears = r.findNearestElements( pos[0], pos[1], true, false );
    let near = nears[0];
    let draggedElements = r.dragData.possibleDragElements;

    r.hoverData.mdownPos = pos;
    r.hoverData.mdownGPos = gpos;

    let makeEvent = (type: string) => ({
      originalEvent: e,
      type: type,
      position: { x: pos[0], y: pos[1] }
    });

    let checkForTaphold = function(){
      r.hoverData.tapholdCancelled = false;

      clearTimeout( r.hoverData.tapholdTimeout );

      r.hoverData.tapholdTimeout = setTimeout( function(){

        if( r.hoverData.tapholdCancelled ){
          return;
        } else {
          let ele = r.hoverData.down;

          if( ele ){
            ele.emit(makeEvent('taphold'));
          } else {
            cy.emit(makeEvent('taphold'));
          }
        }

      }, r.tapholdDuration );
    };

    // Right click button
    if( e.which == 3 ){

      r.hoverData.cxtStarted = true;

      let cxtEvt = {
        originalEvent: e,
        type: 'cxttapstart',
        position: { x: pos[0], y: pos[1] }
      };

      if( near ){
        near.activate();
        near.emit( cxtEvt );

        r.hoverData.down = near;
      } else {
        cy.emit( cxtEvt );
      }

      r.hoverData.downTime = (new Date()).getTime();
      r.hoverData.cxtDragged = false;

    // Primary button
    } else if( e.which == 1 ){

      if( near ){
        near.activate();
      }

      // Element dragging
      {
        // If something is under the cursor and it is draggable, prepare to grab it
        if( near != null ){

          if( r.nodeIsGrabbable( near ) ){
            let triggerGrab = function( ele: Element ){
              ele.emit( makeEvent('grab') );
            };

            setGrabTarget( near );

            if( !near.selected() ){

              draggedElements = r.dragData.possibleDragElements = cy.collection();
              addNodeToDrag( near, { addToList: draggedElements } );

              near.emit( makeEvent('grabon') ).emit( makeEvent('grab') );

            } else {
              draggedElements = r.dragData.possibleDragElements = cy.collection();

              let selectedNodes = cy.$( function( ele: Element ){ return ele.isNode() && ele.selected() && r.nodeIsGrabbable( ele ); } );

              addNodesToDrag( selectedNodes, { addToList: draggedElements } );

              near.emit( makeEvent('grabon') );

              selectedNodes.forEach( triggerGrab );
            }

            r.redrawHint( 'eles', true );
            r.redrawHint( 'drag', true );

          }

        }

        r.hoverData.down = near;
        r.hoverData.downs = nears;
        r.hoverData.downTime = (new Date()).getTime();
      }

      triggerEvents( near, [ 'mousedown', 'tapstart', 'vmousedown' ], e, { x: pos[0], y: pos[1] } );

      if( near == null ){
        select[4] = 1;

        r.data.bgActivePosistion = {
          x: pos[0],
          y: pos[1]
        };

        r.redrawHint( 'select', true );

        r.redraw();
      } else if( near.pannable() ){
        select[4] = 1; // for future pan
      }

      checkForTaphold();

    }

    // Initialize selection box coordinates
    select[0] = select[2] = pos[0];
    select[1] = select[3] = pos[1];

  }, false );

  let shadowRoot = getShadowRoot( r.container );
  r.registerBinding( [ containerWindow, shadowRoot ], 'mousemove', function mousemoveHandler( e: MouseEvent ){ // eslint-disable-line no-undef
    let capture = r.hoverData.capture;

    if( !capture && !eventInContainer(e) ){ return; }

    let preventDefault = false;
    let cy = r.cy;
    let zoom = cy.zoom();
    let gpos = [ e.clientX, e.clientY ];
    let pos = r.projectIntoViewport( gpos[0], gpos[1] );
    let mdownPos = r.hoverData.mdownPos;
    let mdownGPos = r.hoverData.mdownGPos;
    let select = r.selection;

    let near = null;
    if( !r.hoverData.draggingEles && !r.hoverData.dragging && !r.hoverData.selecting ){
      near = r.findNearestElement( pos[0], pos[1], true, false );
    }
    let last = r.hoverData.last;
    let down = r.hoverData.down;

    let disp = [ pos[0] - select[2], pos[1] - select[3] ];

    let draggedElements = r.dragData.possibleDragElements;

    let isOverThresholdDrag;

    if( mdownGPos ){
      let dx = gpos[0] - mdownGPos[0];
      let dx2 = dx * dx;
      let dy = gpos[1] - mdownGPos[1];
      let dy2 = dy * dy;
      let dist2 = dx2 + dy2;

      r.hoverData.isOverThresholdDrag = isOverThresholdDrag = dist2 >= r.desktopTapThreshold2;
    }

    let multSelKeyDown = isMultSelKeyDown( e );

    if (isOverThresholdDrag) {
      r.hoverData.tapholdCancelled = true;
    }

    let updateDragDelta = function(){
      let dragDelta = r.hoverData.dragDelta = r.hoverData.dragDelta || [];

      if( dragDelta.length === 0 ){
        dragDelta.push( disp[0] );
        dragDelta.push( disp[1] );
      } else {
        dragDelta[0] += disp[0];
        dragDelta[1] += disp[1];
      }
    };


    preventDefault = true;

    triggerEvents( near, [ 'mousemove', 'vmousemove', 'tapdrag' ], e, { x: pos[0], y: pos[1] } );

    let makeEvent = (type: string) => ({
      originalEvent: e,
      type: type,
      position: { x: pos[0], y: pos[1] }
    });
    
    let goIntoBoxMode = function(){
      r.data.bgActivePosistion = undefined;

      if( !r.hoverData.selecting ){
        cy.emit(makeEvent('boxstart'));
      }

      select[4] = 1;
      r.hoverData.selecting = true;

      r.redrawHint( 'select', true );
      r.redraw();
    };

    // trigger context drag if rmouse down
    if( r.hoverData.which === 3 ){
      // but only if over threshold
      if( isOverThresholdDrag ){
        let cxtEvt = makeEvent('cxtdrag');

        if( down ){
          down.emit( cxtEvt );
        } else {
          cy.emit( cxtEvt );
        }

        r.hoverData.cxtDragged = true;

        if( !r.hoverData.cxtOver || near !== r.hoverData.cxtOver ){

          if( r.hoverData.cxtOver ){
            r.hoverData.cxtOver.emit(makeEvent('cxtdragout'));
          }

          r.hoverData.cxtOver = near;

          if( near ){
            near.emit(makeEvent('cxtdragover'));
          }

        }
      }

    // Check if we are drag panning the entire graph
    } else if( r.hoverData.dragging ){
      preventDefault = true;

      if( cy.panningEnabled() && cy.userPanningEnabled() ){
        let deltaP;

        if( r.hoverData.justStartedPan ){
          let mdPos = r.hoverData.mdownPos;

          deltaP = {
            x: ( pos[0] - mdPos[0] ) * zoom,
            y: ( pos[1] - mdPos[1] ) * zoom
          };

          r.hoverData.justStartedPan = false;

        } else {
          deltaP = {
            x: disp[0] * zoom,
            y: disp[1] * zoom
          };

        }

        cy.panBy( deltaP );
        cy.emit(makeEvent('dragpan'));

        r.hoverData.dragged = true;
      }

      // Needs reproject due to pan changing viewport
      pos = r.projectIntoViewport( e.clientX, e.clientY );

    // Checks primary button down & out of time & mouse not moved much
    } else if(
        select[4] == 1 && (down == null || down.pannable())
    ){

      if( isOverThresholdDrag ){

        if( !r.hoverData.dragging && cy.boxSelectionEnabled() && ( multSelKeyDown || !cy.panningEnabled() || !cy.userPanningEnabled() ) ){
          goIntoBoxMode();

        } else if( !r.hoverData.selecting && cy.panningEnabled() && cy.userPanningEnabled() ){
          let allowPassthrough = allowPanningPassthrough( down, r.hoverData.downs );

          if( allowPassthrough ){
            r.hoverData.dragging = true;
            r.hoverData.justStartedPan = true;
            select[4] = 0;

            r.data.bgActivePosistion = math.array2point( mdownPos );

            r.redrawHint( 'select', true );
            r.redraw();
          }
        }

        if( down && down.pannable() && down.active() ){ down.unactivate(); }

      }

    } else {
      if( down && down.pannable() && down.active() ){ down.unactivate(); }

      if( ( !down || !down.grabbed() ) && near != last ){

        if( last ){
          triggerEvents( last, [ 'mouseout', 'tapdragout' ], e, { x: pos[0], y: pos[1] } );
        }

        if( near ){
          triggerEvents( near, [ 'mouseover', 'tapdragover' ], e, { x: pos[0], y: pos[1] } );
        }

        r.hoverData.last = near;
      }

      if( down ){

        if( isOverThresholdDrag ){ // then we can take action

          if( cy.boxSelectionEnabled() && multSelKeyDown ){ // then selection overrides
            if( down && down.grabbed() ){
              freeDraggedElements( draggedElements );

              down.emit(makeEvent('freeon'));
              draggedElements.emit(makeEvent('free'));

              if( r.dragData.didDrag ){
                down.emit(makeEvent('dragfreeon'));
                draggedElements.emit(makeEvent('dragfree'));
              }
            }

            goIntoBoxMode();

          } else if( down && down.grabbed() && r.nodeIsDraggable( down ) ){ // drag node
            let justStartedDrag = !r.dragData.didDrag;

            if( justStartedDrag ){
              r.redrawHint( 'eles', true );
            }

            r.dragData.didDrag = true; // indicate that we actually did drag the node

            // now, add the elements to the drag layer if not done already
            if( !r.hoverData.draggingEles ){
              addNodesToDrag( draggedElements, { inDragLayer: true } );
            }

            let totalShift = { x: 0, y: 0 };

            if( is.number( disp[0] ) && is.number( disp[1] ) ){
              totalShift.x += disp[0];
              totalShift.y += disp[1];

              if( justStartedDrag ){
                let dragDelta = r.hoverData.dragDelta;

                if( dragDelta && is.number( dragDelta[0] ) && is.number( dragDelta[1] ) ){
                  totalShift.x += dragDelta[0];
                  totalShift.y += dragDelta[1];
                }
              }
            }

            r.hoverData.draggingEles = true;

            ( draggedElements
              .silentShift( totalShift )
              .emit(makeEvent('position'))
              .emit(makeEvent('drag'))
            );

            r.redrawHint( 'drag', true );
            r.redraw();
          }

        } else { // otherwise save drag delta for when we actually start dragging so the relative grab pos is constant
          updateDragDelta();
        }
      }

      // prevent the dragging from triggering text selection on the page
      preventDefault = true;
    }

    select[2] = pos[0]; select[3] = pos[1];

    if( preventDefault ){
      if( e.stopPropagation ) e.stopPropagation();
      if( e.preventDefault ) e.preventDefault();
      return false;
    }
  }, false );

  let clickTimeout: ReturnType<typeof setTimeout> | undefined, didDoubleClick: boolean, prevClickTimeStamp: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- nullable timestamp compared arithmetically
  r.registerBinding( containerWindow, 'mouseup', function mouseupHandler( e: MouseEvent ){ // eslint-disable-line no-undef
    // during left mouse button gestures, ignore other buttons
    if (r.hoverData.which === 1 && e.which !== 1 && r.hoverData.capture) {
      return;
    }

    let capture = r.hoverData.capture;
    if( !capture ){ return; }
    r.hoverData.capture = false;

    let cy = r.cy; let pos = r.projectIntoViewport( e.clientX, e.clientY ); let select = r.selection;
    let near = r.findNearestElement( pos[0], pos[1], true, false );
    let draggedElements = r.dragData.possibleDragElements; let down = r.hoverData.down;
    let multSelKeyDown = isMultSelKeyDown( e );

    if( r.data.bgActivePosistion ){
      r.redrawHint( 'select', true );
      r.redraw();
    }

    r.hoverData.tapholdCancelled = true;

    r.data.bgActivePosistion = undefined; // not active bg now

    if( down ){
      down.unactivate();
    }

    let makeEvent = (type: string) => ({
      originalEvent: e,
      type: type,
      position: { x: pos[0], y: pos[1] }
    });

    if( r.hoverData.which === 3 ){
      let cxtEvt = (makeEvent('cxttapend'));

      if( down ){
        down.emit( cxtEvt );
      } else {
        cy.emit( cxtEvt );
      }

      if( !r.hoverData.cxtDragged ){
        let cxtTap = makeEvent('cxttap');

        if( down ){
          down.emit( cxtTap );
        } else {
          cy.emit( cxtTap );
        }
      }

      r.hoverData.cxtDragged = false;
      r.hoverData.which = null;

    } else if( r.hoverData.which === 1 ){

      triggerEvents( near, [ 'mouseup', 'tapend', 'vmouseup' ], e, { x: pos[0], y: pos[1] } );

      if (
        !r.dragData.didDrag && // didn't move a node around
        !r.hoverData.dragged && // didn't pan
        !r.hoverData.selecting && // not box selection
        !r.hoverData.isOverThresholdDrag // didn't move too much
      ) {
        triggerEvents(down, ["click", "tap", "vclick"], e, { x: pos[0], y: pos[1] });

        didDoubleClick = false;
        if (e.timeStamp - prevClickTimeStamp <= cy.multiClickDebounceTime()) {
          clickTimeout && clearTimeout(clickTimeout); // eslint-disable-line @typescript-eslint/no-unused-expressions
          didDoubleClick = true;
          prevClickTimeStamp = null;
          triggerEvents(down, ["dblclick", "dbltap", "vdblclick"], e, { x: pos[0], y: pos[1] });
        } else {
          clickTimeout = setTimeout(() => {
            if (didDoubleClick) return;
            triggerEvents(down, ["oneclick", "onetap", "voneclick"], e, { x: pos[0], y: pos[1] });
          }, cy.multiClickDebounceTime());
          prevClickTimeStamp = e.timeStamp;
        }
      }

      // Deselect all elements if nothing is currently under the mouse cursor and we aren't dragging something
      if( (down == null) // not mousedown on node
        && !r.dragData.didDrag // didn't move the node around
        && !r.hoverData.selecting // not box selection
        && !r.hoverData.dragged // didn't pan
        && !isMultSelKeyDown( e )
      ){

        cy.$(isSelected).unselect(['tapunselect']);

        if( draggedElements.length > 0 ){
          r.redrawHint( 'eles', true );
        }

        r.dragData.possibleDragElements = draggedElements = cy.collection();
      }

      // Single selection
      if( near == down && !r.dragData.didDrag && !r.hoverData.selecting ){
        if( near != null && near._private.selectable ){

          if( r.hoverData.dragging ){
            // if panning, don't change selection state
          } else if( cy.selectionType() === 'additive' || multSelKeyDown ){
            if( near.selected() ){
              near.unselect(['tapunselect']);
            } else {
              near.select(['tapselect']);
            }
          } else {
            if( !multSelKeyDown ){
              cy.$(isSelected).unmerge( near ).unselect(['tapunselect']);
              near.select(['tapselect']);
            }
          }

          r.redrawHint( 'eles', true );
        }
      }

      if( r.hoverData.selecting ){
        let box = cy.collection( r.getAllInBox( select[0], select[1], select[2], select[3] ) );

        r.redrawHint( 'select', true );

        if( box.length > 0 ){
          r.redrawHint( 'eles', true );
        }

        cy.emit(makeEvent('boxend'));

        let eleWouldBeSelected = function( ele: Element ){ return ele.selectable() && !ele.selected(); };

        if( cy.selectionType() === 'additive' ){
          box
            .emit(makeEvent('box'))
            .stdFilter( eleWouldBeSelected )
              .select()
              .emit(makeEvent('boxselect'))
          ;
        } else {
          if( !multSelKeyDown ){
            cy.$(isSelected).unmerge(box).unselect();
          }

          box
            .emit(makeEvent('box'))
            .stdFilter( eleWouldBeSelected )
              .select()
              .emit(makeEvent('boxselect'))
          ;
        }

        // always need redraw in case eles unselectable
        r.redraw();

      }

      // Cancel drag pan
      if( r.hoverData.dragging ){
        r.hoverData.dragging = false;

        r.redrawHint( 'select', true );
        r.redrawHint( 'eles', true );

        r.redraw();
      }

      if( !select[4] ) {
        r.redrawHint('drag', true);
        r.redrawHint('eles', true);

        let downWasGrabbed = down && down.grabbed();

        freeDraggedElements( draggedElements );

        if( downWasGrabbed ){
          down.emit(makeEvent('freeon'));
          draggedElements.emit(makeEvent('free'));

          if( r.dragData.didDrag ){
            down.emit(makeEvent('dragfreeon'));
            draggedElements.emit(makeEvent('dragfree'));
          }
        }
      }

    } // else not right mouse

    select[4] = 0; r.hoverData.down = null;

    r.hoverData.cxtStarted = false;
    r.hoverData.draggingEles = false;
    r.hoverData.selecting = false;
    r.hoverData.isOverThresholdDrag = false;
    r.dragData.didDrag = false;
    r.hoverData.dragged = false;
    r.hoverData.dragDelta = [];
    r.hoverData.mdownPos = null;
    r.hoverData.mdownGPos = null;
    r.hoverData.which = null;

  }, false );

  let wheelDeltas: number[] = []; // log of first N wheel deltas
  let wheelDeltaN = 4; // how many events to log
  let inaccurateScrollDevice: boolean | null | undefined;
  let inaccurateScrollFactor = 100000; // base of inaccurate wheel deltas (e.g. base 5 could yield wheels of 10, 25, 50, etc.)

  let allAreDivisibleBy = function( list: number[], factor: number ){
    for( let i = 0; i < list.length; i++ ){
      if( list[i] % factor !== 0 ){
        return false;
      }
    }

    return true;
  }

  let allAreSameMagnitude = function(list: number[]) {
    let firstMag = Math.abs(list[0]);
    for (let i = 1; i < list.length; i++) {
      if (Math.abs(list[i]) !== firstMag) {
        return false;
      }
    }
    return true;
  }
      
  let wheelHandler = function( e: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any -- reads vendor-prefixed wheel/gesture fields
    let clamp = false;
    let delta = e.deltaY;

    if (delta == null) { // compatibility with old browsers
      if (e.wheelDeltaY != null) {
        delta = e.wheelDeltaY / 4;
      } else if (e.wheelDelta != null) {
        delta = e.wheelDelta / 4;
      }
    }

    if (delta === 0) {
      return; // no change in zoom (Bug: Zoom becomes erratic on rapid scroll due to deltaY: 0 event #3394)
    }

    if (inaccurateScrollDevice == null) {
      if (wheelDeltas.length >= wheelDeltaN) { // use log to determine if inaccurate
        let wds = wheelDeltas;
        inaccurateScrollDevice = allAreDivisibleBy(wds, 5);

        if (!inaccurateScrollDevice) { // check for all large values of exact same magnitude
          let firstMag = Math.abs(wds[0]);

          inaccurateScrollDevice = allAreSameMagnitude(wds) && firstMag > 5;
        }
        
        if (inaccurateScrollDevice) {
          for (let i = 0; i < wds.length; i++) {
            inaccurateScrollFactor = Math.min(Math.abs(wds[i]), inaccurateScrollFactor);
          }
        }

        // console.log('Sampled wheel deltas:', wds);
        // console.log('inaccurateScrollDevice:', inaccurateScrollDevice);
        // console.log('inaccurateScrollFactor:', inaccurateScrollFactor);
      } else { // clamp and log until we reach N
        wheelDeltas.push(delta);
        clamp = true;
        // console.log('Clamping initial wheel events until we get a good sample');
      }
    } else if(inaccurateScrollDevice) { // keep updating
      inaccurateScrollFactor = Math.min(Math.abs(delta), inaccurateScrollFactor);
      // console.log('Keep updating inaccurateScrollFactor beyond sample in case we did not get the smallest possible val:', inaccurateScrollFactor);
    }

    if( r.scrollingPage ){ return; } // while scrolling, ignore wheel-to-zoom

    let cy = r.cy;
    let zoom = cy.zoom();
    let pan = cy.pan();
    let pos = r.projectIntoViewport( e.clientX, e.clientY );
    let rpos = [ pos[0] * zoom + pan.x,
                  pos[1] * zoom + pan.y ];

    if( r.hoverData.draggingEles || r.hoverData.dragging || r.hoverData.cxtStarted || inBoxSelection() ){ // if pan dragging or cxt dragging, wheel movements make no zoom
      e.preventDefault();
      return;
    }

    if( cy.panningEnabled() && cy.userPanningEnabled() && cy.zoomingEnabled() && cy.userZoomingEnabled() ){
      e.preventDefault();

      r.data.wheelZooming = true;
      clearTimeout( r.data.wheelTimeout );
      r.data.wheelTimeout = setTimeout( function(){
        r.data.wheelZooming = false;

        r.redrawHint( 'eles', true );
        r.redraw();
      }, 150 );

      let diff;

      if (clamp && Math.abs(delta) > 5) {
        delta = math.signum(delta) * 5;
      }

      diff = delta / -250;

      if (inaccurateScrollDevice) {
        diff /= inaccurateScrollFactor;

        diff *= 3;
      }

      diff = diff * r.wheelSensitivity;

      // console.log(`delta = ${delta}, diff = ${diff}, mode = ${e.deltaMode}`)

      let needsWheelFix = e.deltaMode === 1;
      if( needsWheelFix ){ // fixes slow wheel events on ff/linux and ff/windows
        diff *= 33;
      }

      let newZoom = cy.zoom() * Math.pow( 10, diff );

      if( e.type === 'gesturechange' ){
        newZoom = r.gestureStartZoom * e.scale;
      }

      cy.zoom( {
        level: newZoom,
        renderedPosition: { x: rpos[0], y: rpos[1] }
      } );

      cy.emit({
        type: e.type === 'gesturechange' ? 'pinchzoom' : 'scrollzoom',
        originalEvent: e,
        position: { x: pos[0], y: pos[1] }
      });
    }

  };

  // Functions to help with whether mouse wheel should trigger zooming
  // --
  r.registerBinding( r.container, 'wheel', wheelHandler, true );

  // disable nonstandard wheel events
  // r.registerBinding(r.container, 'mousewheel', wheelHandler, true);
  // r.registerBinding(r.container, 'DOMMouseScroll', wheelHandler, true);
  // r.registerBinding(r.container, 'MozMousePixelScroll', wheelHandler, true); // older firefox

  r.registerBinding( containerWindow, 'scroll', function scrollHandler( e: Event ){ // eslint-disable-line no-unused-vars
    r.scrollingPage = true;

    clearTimeout( r.scrollingPageTimeout );
    r.scrollingPageTimeout = setTimeout( function(){
      r.scrollingPage = false;
    }, 250 );
  }, true );

  // desktop safari pinch to zoom start
  r.registerBinding( r.container, 'gesturestart', function gestureStartHandler(e: Event){
    r.gestureStartZoom = r.cy.zoom();

    if( !r.hasTouchStarted ){ // don't affect touch devices like iphone
      e.preventDefault();
    }
  }, true );

  r.registerBinding( r.container, 'gesturechange', function(e: Event){
    if( !r.hasTouchStarted ){ // don't affect touch devices like iphone
      wheelHandler(e);
    }
  }, true );

  // Functions to help with handling mouseout/mouseover on the Cytoscape container
  // Handle mouseout on Cytoscape container
  r.registerBinding( r.container, 'mouseout', function mouseOutHandler( e: MouseEvent ){
    let pos = r.projectIntoViewport( e.clientX, e.clientY );

    r.cy.emit( ( {
      originalEvent: e,
      type: 'mouseout',
      position: { x: pos[0], y: pos[1] }
    } ) );
  }, false );

  r.registerBinding( r.container, 'mouseover', function mouseOverHandler( e: MouseEvent ){
    let pos = r.projectIntoViewport( e.clientX, e.clientY );

    r.cy.emit( ( {
      originalEvent: e,
      type: 'mouseover',
      position: { x: pos[0], y: pos[1] }
    } ) );
  }, false );

  let f1x1: number, f1y1: number, f2x1: number, f2y1: number; // starting points for pinch-to-zoom
  let distance1: number, distance1Sq: number; // initial distance between finger 1 and finger 2 for pinch-to-zoom
  let center1: number[], modelCenter1: number[]; // center point on start pinch to zoom
  let offsetLeft: number, offsetTop: number;
  let containerWidth: number, containerHeight: number;
  let twoFingersStartInside: boolean;

  let distance = function( x1: number, y1: number, x2: number, y2: number ){
    return Math.sqrt( (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) );
  };

  let distanceSq = function( x1: number, y1: number, x2: number, y2: number ){
    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  };

  let touchstartHandler: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- reused for synthetic pointer events
  r.registerBinding( r.container, 'touchstart', touchstartHandler = function( e: any ){ // eslint-disable-line @typescript-eslint/no-explicit-any -- TouchEvent or synthetic pointer event
    r.hasTouchStarted = true;
    
    if( !eventInContainer(e) ){ return; }

    blurActiveDomElement();

    r.touchData.capture = true;
    r.data.bgActivePosistion = undefined;

    let cy = r.cy;
    let now = r.touchData.now;
    let earlier = r.touchData.earlier;

    if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
    if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
    if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches

    let makeEvent = (type: string) => ({
      originalEvent: e,
      type: type,
      position: { x: now[0], y: now[1] }
    });

    // record starting points for pinch-to-zoom
    if( e.touches[1] ){

      r.touchData.singleTouchMoved = true;

      freeDraggedElements( r.dragData.touchDragEles );

      let offsets = r.findContainerClientCoords();
      offsetLeft = offsets[0];
      offsetTop = offsets[1];
      containerWidth = offsets[2];
      containerHeight = offsets[3];

      f1x1 = e.touches[0].clientX - offsetLeft;
      f1y1 = e.touches[0].clientY - offsetTop;

      f2x1 = e.touches[1].clientX - offsetLeft;
      f2y1 = e.touches[1].clientY - offsetTop;

      twoFingersStartInside =
           0 <= f1x1 && f1x1 <= containerWidth
        && 0 <= f2x1 && f2x1 <= containerWidth
        && 0 <= f1y1 && f1y1 <= containerHeight
        && 0 <= f2y1 && f2y1 <= containerHeight
      ;

      let pan = cy.pan();
      let zoom = cy.zoom();

      distance1 = distance( f1x1, f1y1, f2x1, f2y1 );
      distance1Sq = distanceSq( f1x1, f1y1, f2x1, f2y1 );
      center1 = [ (f1x1 + f2x1) / 2, (f1y1 + f2y1) / 2 ];
      modelCenter1 = [
        (center1[0] - pan.x) / zoom,
        (center1[1] - pan.y) / zoom
      ];

      // consider context tap
      let cxtDistThreshold = 200;
      let cxtDistThresholdSq = cxtDistThreshold * cxtDistThreshold;
      if( distance1Sq < cxtDistThresholdSq && !e.touches[2] ){

        let near1 = r.findNearestElement( now[0], now[1], true, true );
        let near2 = r.findNearestElement( now[2], now[3], true, true );

        if( near1 && near1.isNode() ){
          near1.activate().emit(makeEvent('cxttapstart'));
          r.touchData.start = near1;

        } else if( near2 && near2.isNode() ){
          near2.activate().emit(makeEvent('cxttapstart'));
          r.touchData.start = near2;

        } else {
          cy.emit(makeEvent('cxttapstart'));
        }

        if( r.touchData.start ){ r.touchData.start._private.grabbed = false; }
        r.touchData.cxt = true;
        r.touchData.cxtDragged = false;
        r.data.bgActivePosistion = undefined;

        r.redraw();
        return;

      }

    }

    if( e.touches[2] ){
      // ignore

      // safari on ios pans the page otherwise (normally you should be able to preventdefault on touchmove...)
      if( cy.boxSelectionEnabled() ){
        e.preventDefault();
      }

    } else if( e.touches[1] ){
      // ignore
    } else if( e.touches[0] ){
      let nears = r.findNearestElements( now[0], now[1], true, true );
      let near = nears[0];

      if( near != null ){
        near.activate();

        r.touchData.start = near;
        r.touchData.starts = nears;

        if( r.nodeIsGrabbable( near ) ){

          let draggedEles = r.dragData.touchDragEles = cy.collection();
          let selectedNodes = null;

          r.redrawHint( 'eles', true );
          r.redrawHint( 'drag', true );

          if( near.selected() ){
            // reset drag elements, since near will be added again

            selectedNodes = cy.$( function( ele: Element ){
              return ele.selected() && r.nodeIsGrabbable( ele );
            } );

            addNodesToDrag( selectedNodes, { addToList: draggedEles } );
          } else {
            addNodeToDrag( near, { addToList: draggedEles } );
          }

          setGrabTarget( near );

          near.emit( makeEvent('grabon') );

          if( selectedNodes ){
            selectedNodes.forEach(function( n: Element ){ n.emit( makeEvent('grab') ); });
          } else {
            near.emit( makeEvent('grab') );
          }
        }
      }

      triggerEvents( near, [ 'touchstart', 'tapstart', 'vmousedown' ], e, { x: now[0], y: now[1] } );

      if( near == null ){
        r.data.bgActivePosistion = {
          x: pos[0],
          y: pos[1]
        };

        r.redrawHint( 'select', true );
        r.redraw();
      }


      // Tap, taphold
      // -----

      r.touchData.singleTouchMoved = false;
      r.touchData.singleTouchStartTime = +new Date();

      clearTimeout( r.touchData.tapholdTimeout );
      r.touchData.tapholdTimeout = setTimeout( function(){
        if(
            r.touchData.singleTouchMoved === false
            && !r.pinching // if pinching, then taphold unselect shouldn't take effect
            && !r.touchData.selecting // box selection shouldn't allow taphold through
        ){
          triggerEvents( r.touchData.start, [ 'taphold' ], e, { x: now[0], y: now[1] } );
        }
      }, r.tapholdDuration );
    }

    if( e.touches.length >= 1 ){
      let sPos = r.touchData.startPosition = [null, null, null, null, null, null];

      for( let i = 0; i < now.length; i++ ){
        sPos[i] = earlier[i] = now[i];
      }

      let touch0 = e.touches[0];

      r.touchData.startGPosition = [ touch0.clientX, touch0.clientY ];
    }

  }, false );

  let touchmoveHandler: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- reused for synthetic pointer events
  r.registerBinding(containerWindow, 'touchmove', touchmoveHandler = function(this: any, e: any) { // eslint-disable-line no-undef, @typescript-eslint/no-explicit-any -- TouchEvent or synthetic pointer event; this is the bound DOM target
    let capture = r.touchData.capture;

    if( !capture && !eventInContainer(e) ){ return; }

    let select = r.selection;
    let cy = r.cy;
    let now = r.touchData.now;
    let earlier = r.touchData.earlier;
    let zoom = cy.zoom();

    if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
    if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
    if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches

    let makeEvent = (type: string) => ({
      originalEvent: e,
      type: type,
      position: { x: now[0], y: now[1] }
    }); 

    let startGPos = r.touchData.startGPosition;
    let isOverThresholdDrag;

    if( capture && e.touches[0] && startGPos ){
      // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any -- function-scoped, used (possibly unassigned) in later touchmove branches
      var disp: any = []; for (let j=0;j<now.length;j++) { disp[j] = now[j] - earlier[j]; }
      var dx: any = e.touches[0].clientX - startGPos[0]; // eslint-disable-line no-var, @typescript-eslint/no-explicit-any -- function-scoped, used in later touchmove branches
      let dx2 = dx * dx;
      var dy: any = e.touches[0].clientY - startGPos[1]; // eslint-disable-line no-var, @typescript-eslint/no-explicit-any -- function-scoped, used in later touchmove branches
      let dy2 = dy * dy;
      let dist2 = dx2 + dy2;

      isOverThresholdDrag = dist2 >= r.touchTapThreshold2;
    }

    // context swipe cancelling
    if( capture && r.touchData.cxt ){
      e.preventDefault();

      let f1x2 = e.touches[0].clientX - offsetLeft, f1y2 = e.touches[0].clientY - offsetTop;
      let f2x2 = e.touches[1].clientX - offsetLeft, f2y2 = e.touches[1].clientY - offsetTop;
      // let distance2 = distance( f1x2, f1y2, f2x2, f2y2 );
      let distance2Sq = distanceSq( f1x2, f1y2, f2x2, f2y2 );
      let factorSq = distance2Sq / distance1Sq;

      let distThreshold = 150;
      let distThresholdSq = distThreshold * distThreshold;
      let factorThreshold = 1.5;
      let factorThresholdSq = factorThreshold * factorThreshold;

      // cancel ctx gestures if the distance b/t the fingers increases
      if( factorSq >= factorThresholdSq || distance2Sq >= distThresholdSq ){
        r.touchData.cxt = false;

        r.data.bgActivePosistion = undefined;

        r.redrawHint( 'select', true );

        let cxtEvt = makeEvent('cxttapend');

        if( r.touchData.start ){
          r.touchData.start
            .unactivate()
            .emit( cxtEvt )
          ;

          r.touchData.start = null;
        } else {
          cy.emit( cxtEvt );
        }
      }

    }

    // context swipe
    if( capture && r.touchData.cxt ){
      let cxtEvt = makeEvent('cxtdrag');
      r.data.bgActivePosistion = undefined;
      r.redrawHint( 'select', true );

      if( r.touchData.start ){
        r.touchData.start.emit( cxtEvt );
      } else {
        cy.emit( cxtEvt );
      }

      if( r.touchData.start ){ r.touchData.start._private.grabbed = false; }
      r.touchData.cxtDragged = true;

      let near = r.findNearestElement( now[0], now[1], true, true );

      if( !r.touchData.cxtOver || near !== r.touchData.cxtOver ){

        if( r.touchData.cxtOver ){
          r.touchData.cxtOver.emit(makeEvent('cxtdragout'));
        }

        r.touchData.cxtOver = near;

        if( near ){
          near.emit(makeEvent('cxtdragover'));
        }

      }

    // box selection
    } else if( capture && e.touches[2] && cy.boxSelectionEnabled() ){
      e.preventDefault();

      r.data.bgActivePosistion = undefined;

      this.lastThreeTouch = +new Date();

      if( !r.touchData.selecting ){
        cy.emit(makeEvent('boxstart'));
      }

      r.touchData.selecting = true;
      r.touchData.didSelect = true;
      select[4] = 1;

      if( !select || select.length === 0 || select[0] === undefined ){
        select[0] = (now[0] + now[2] + now[4]) / 3;
        select[1] = (now[1] + now[3] + now[5]) / 3;
        select[2] = (now[0] + now[2] + now[4]) / 3 + 1;
        select[3] = (now[1] + now[3] + now[5]) / 3 + 1;
      } else {
        select[2] = (now[0] + now[2] + now[4]) / 3;
        select[3] = (now[1] + now[3] + now[5]) / 3;
      }

      r.redrawHint( 'select', true );
      r.redraw();

    // pinch to zoom
    } else if(
      capture && e.touches[1]
      && !r.touchData.didSelect // don't allow box selection to degrade to pinch-to-zoom
      && cy.zoomingEnabled() && cy.panningEnabled() && cy.userZoomingEnabled() && cy.userPanningEnabled()
    ){ // two fingers => pinch to zoom
      e.preventDefault();

      r.data.bgActivePosistion = undefined;
      r.redrawHint( 'select', true );

      let draggedEles = r.dragData.touchDragEles;
      if( draggedEles ){
        r.redrawHint( 'drag', true );

        for( let i = 0; i < draggedEles.length; i++ ){
          let de_p = draggedEles[i]._private;

          de_p.grabbed = false;
          de_p.rscratch.inDragLayer = false;
        }
      }

      let start = r.touchData.start;

      // (x2, y2) for fingers 1 and 2
      let f1x2 = e.touches[0].clientX - offsetLeft, f1y2 = e.touches[0].clientY - offsetTop;
      let f2x2 = e.touches[1].clientX - offsetLeft, f2y2 = e.touches[1].clientY - offsetTop;


      let distance2 = distance( f1x2, f1y2, f2x2, f2y2 );
      // let distance2Sq = distanceSq( f1x2, f1y2, f2x2, f2y2 );
      // let factor = Math.sqrt( distance2Sq ) / Math.sqrt( distance1Sq );
      let factor = distance2 / distance1;

      if( twoFingersStartInside ){
        // delta finger1
        let df1x = f1x2 - f1x1;
        let df1y = f1y2 - f1y1;

        // delta finger 2
        let df2x = f2x2 - f2x1;
        let df2y = f2y2 - f2y1;

        // translation is the normalised vector of the two fingers movement
        // i.e. so pinching cancels out and moving together pans
        let tx = (df1x + df2x) / 2;
        let ty = (df1y + df2y) / 2;

        // now calculate the zoom
        let zoom1 = cy.zoom();
        let zoom2 = zoom1 * factor;
        let pan1 = cy.pan();

        // the model center point converted to the current rendered pos
        let ctrx = modelCenter1[0] * zoom1 + pan1.x;
        let ctry = modelCenter1[1] * zoom1 + pan1.y;

        let pan2 = {
          x: -zoom2 / zoom1 * (ctrx - pan1.x - tx) + ctrx,
          y: -zoom2 / zoom1 * (ctry - pan1.y - ty) + ctry
        };

        // remove dragged eles
        if( start && start.active() ){
          let draggedEles = r.dragData.touchDragEles;

          freeDraggedElements( draggedEles );

          r.redrawHint( 'drag', true );
          r.redrawHint( 'eles', true );

          start
            .unactivate()
            .emit(makeEvent('freeon'))
          ;

          draggedEles.emit(makeEvent('free'));

          if( r.dragData.didDrag ){
            start.emit(makeEvent('dragfreeon'));
            draggedEles.emit(makeEvent('dragfree'));
          }
        }

        cy.viewport( {
          zoom: zoom2,
          pan: pan2,
          cancelOnFailedZoom: true
        } );
        cy.emit(makeEvent('pinchzoom'));

        distance1 = distance2;
        f1x1 = f1x2;
        f1y1 = f1y2;
        f2x1 = f2x2;
        f2y1 = f2y2;

        r.pinching = true;
      }

      // Re-project
      if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
      if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
      if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches

    } else if(
      e.touches[0]
      && !r.touchData.didSelect // don't allow box selection to degrade to single finger events like panning
    ){
      let start = r.touchData.start;
      let last = r.touchData.last;
      let near;

      if( !r.hoverData.draggingEles && !r.swipePanning ){
        near = r.findNearestElement( now[0], now[1], true, true );
      }

      if( capture && start != null ){
        e.preventDefault();
      }

      // dragging nodes
      if( capture && start != null && r.nodeIsDraggable( start ) ){

        if( isOverThresholdDrag ){ // then dragging can happen
          let draggedEles = r.dragData.touchDragEles;
          let justStartedDrag = !r.dragData.didDrag;

          if( justStartedDrag ){
            addNodesToDrag( draggedEles , { inDragLayer: true } );
          }

          r.dragData.didDrag = true;

          let totalShift = { x: 0, y: 0 };

          if( is.number( disp[0] ) && is.number( disp[1] ) ){
            totalShift.x += disp[0];
            totalShift.y += disp[1];

            if( justStartedDrag ){
              r.redrawHint( 'eles', true );

              let dragDelta = r.touchData.dragDelta;

              if( dragDelta && is.number( dragDelta[0] ) && is.number( dragDelta[1] ) ){
                totalShift.x += dragDelta[0];
                totalShift.y += dragDelta[1];
              }
            }
          }

          r.hoverData.draggingEles = true;

          ( draggedEles
            .silentShift( totalShift )
            .emit(makeEvent('position'))
            .emit(makeEvent('drag'))
          );

          r.redrawHint( 'drag', true );

          if(
               r.touchData.startPosition[0] == earlier[0]
            && r.touchData.startPosition[1] == earlier[1]
          ){

            r.redrawHint( 'eles', true );
          }

          r.redraw();
        } else { // otherwise keep track of drag delta for later
          let dragDelta = r.touchData.dragDelta = r.touchData.dragDelta || [];

          if( dragDelta.length === 0 ){
            dragDelta.push( disp[0] );
            dragDelta.push( disp[1] );
          } else {
            dragDelta[0] += disp[0];
            dragDelta[1] += disp[1];
          }
        }
      }

      // touchmove
      {
        triggerEvents( (start || near), [ 'touchmove', 'tapdrag', 'vmousemove' ], e, { x: now[0], y: now[1] } );

        if( ( !start || !start.grabbed() ) && near != last ){
          if( last ){ last.emit(makeEvent('tapdragout')); }
          if( near ){ near.emit(makeEvent('tapdragover')); }
        }

        r.touchData.last = near;
      }

      // check to cancel taphold
      if( capture ){
        for( let i = 0; i < now.length; i++ ){
          if( now[ i ]
            && r.touchData.startPosition[ i ]
            && isOverThresholdDrag ){

            r.touchData.singleTouchMoved = true;
          }
        }
      }

      // panning
      if(
          capture
          && ( start == null || start.pannable() )
          && cy.panningEnabled() && cy.userPanningEnabled()
      ){

        let allowPassthrough = allowPanningPassthrough( start, r.touchData.starts );

        if( allowPassthrough ){
          e.preventDefault();

          if( !r.data.bgActivePosistion ){
            r.data.bgActivePosistion = math.array2point( r.touchData.startPosition );
          }

          if( r.swipePanning ){
            cy.panBy( {
              x: disp[0] * zoom,
              y: disp[1] * zoom
            } );
            cy.emit(makeEvent('dragpan'));

          } else if( isOverThresholdDrag ){
            r.swipePanning = true;

            cy.panBy( {
              x: dx * zoom,
              y: dy * zoom
            } );
            cy.emit(makeEvent('dragpan'));

            if( start ){
              start.unactivate();

              r.redrawHint( 'select', true );

              r.touchData.start = null;
            }
          }

        }

        // Re-project
        let pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY );
        now[0] = pos[0]; now[1] = pos[1];
      }
    }

    for( let j = 0; j < now.length; j++ ){ earlier[ j ] = now[ j ]; }

    // the active bg indicator should be removed when making a swipe that is neither for dragging nodes or panning
    if( capture && e.touches.length > 0 && !r.hoverData.draggingEles && !r.swipePanning && r.data.bgActivePosistion != null ){
      r.data.bgActivePosistion = undefined;
      r.redrawHint( 'select', true );
      r.redraw();
    }

  }, false );
  let touchcancelHandler: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- reused for synthetic pointer events
  r.registerBinding( containerWindow, 'touchcancel', touchcancelHandler = function( e: any ){ // eslint-disable-line no-unused-vars, @typescript-eslint/no-explicit-any -- TouchEvent or synthetic pointer event
    let start = r.touchData.start;

    r.touchData.capture = false;

    if( start ){
      start.unactivate();
    }
  } );

  let touchendHandler: any, didDoubleTouch: boolean, touchTimeout: ReturnType<typeof setTimeout> | undefined, prevTouchTimeStamp: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- handler reused for synthetic pointer events; timestamp compared arithmetically
  r.registerBinding( containerWindow, 'touchend', touchendHandler = function( e: any ){ // eslint-disable-line no-unused-vars, @typescript-eslint/no-explicit-any -- TouchEvent or synthetic pointer event
    let start = r.touchData.start;

    let capture = r.touchData.capture;

    if( capture ){
      if( e.touches.length === 0 ){
        r.touchData.capture = false;
      }

      e.preventDefault();
    } else {
      return;
    }

    let select = r.selection;

    r.swipePanning = false;
    r.hoverData.draggingEles = false;

    let cy = r.cy;
    let zoom = cy.zoom();
    let now = r.touchData.now;
    let earlier = r.touchData.earlier;

    if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
    if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches
    if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; } // eslint-disable-line no-var, @typescript-eslint/no-redeclare -- function-scoped pos reused across touch branches

    let makeEvent = (type: string) => ({
      originalEvent: e,
      type: type,
      position: { x: now[0], y: now[1] }
    });

    if( start ){
      start.unactivate();
    }

    let ctxTapend;
    if( r.touchData.cxt ){
      ctxTapend = makeEvent('cxttapend');

      if( start ){
        start.emit( ctxTapend );
      } else {
        cy.emit( ctxTapend );
      }

      if( !r.touchData.cxtDragged ){
        let ctxTap = makeEvent('cxttap');

        if( start ){
          start.emit( ctxTap );
        } else {
          cy.emit( ctxTap );
        }

      }

      if( r.touchData.start ){ r.touchData.start._private.grabbed = false; }
      r.touchData.cxt = false;
      r.touchData.start = null;

      r.redraw();
      return;
    }

    // no more box selection if we don't have three fingers
    if( !e.touches[2] && cy.boxSelectionEnabled() && r.touchData.selecting ){
      r.touchData.selecting = false;

      let box = cy.collection( r.getAllInBox( select[0], select[1], select[2], select[3] ) );

      select[0] = undefined;
      select[1] = undefined;
      select[2] = undefined;
      select[3] = undefined;
      select[4] = 0;

      r.redrawHint( 'select', true );

      cy.emit(makeEvent('boxend'));

      let eleWouldBeSelected = function( ele: Element ){ return ele.selectable() && !ele.selected(); };

      box
        .emit(makeEvent('box'))
        .stdFilter( eleWouldBeSelected )
          .select()
          .emit(makeEvent('boxselect'))
      ;

      if( box.nonempty() ){
        r.redrawHint( 'eles', true );
      }

      r.redraw();
    }

    if( start != null ){
      start.unactivate();
    }

    if( e.touches[2] ){
      r.data.bgActivePosistion = undefined;
      r.redrawHint( 'select', true );
    } else if( e.touches[1] ){
      // ignore
    } else if( e.touches[0] ){
      // ignore

    // Last touch released
    } else if( !e.touches[0] ){

      r.data.bgActivePosistion = undefined;
      r.redrawHint( 'select', true );

      let draggedEles = r.dragData.touchDragEles;

      if( start != null ){

        let startWasGrabbed = start._private.grabbed;

        freeDraggedElements( draggedEles );

        r.redrawHint( 'drag', true );
        r.redrawHint( 'eles', true );

        if( startWasGrabbed ){
          start.emit(makeEvent('freeon'));
          draggedEles.emit(makeEvent('free'));

          if( r.dragData.didDrag ){
            start.emit(makeEvent('dragfreeon'));
            draggedEles.emit(makeEvent('dragfree'));
          }
        }

        triggerEvents( start, [ 'touchend', 'tapend', 'vmouseup', 'tapdragout' ], e, { x: now[0], y: now[1] } );

        start.unactivate();

        r.touchData.start = null;

      } else {
        let near = r.findNearestElement( now[0], now[1], true, true );

        triggerEvents( near, [ 'touchend', 'tapend', 'vmouseup', 'tapdragout' ], e, { x: now[0], y: now[1] } );
      }

      let dx = r.touchData.startPosition[0] - now[0];
      let dx2 = dx * dx;
      let dy = r.touchData.startPosition[1] - now[1];
      let dy2 = dy * dy;
      let dist2 = dx2 + dy2;
      let rdist2 = dist2 * zoom * zoom;

      // Tap event, roughly same as mouse click event for touch
      if( !r.touchData.singleTouchMoved ){
        if( !start ){
          cy.$(':selected').unselect(['tapunselect']);
        }

        triggerEvents( start, [ 'tap', 'vclick' ], e, { x: now[0], y: now[1] } );

        didDoubleTouch = false;
        if (e.timeStamp - prevTouchTimeStamp <= cy.multiClickDebounceTime()) {
          touchTimeout && clearTimeout(touchTimeout); // eslint-disable-line @typescript-eslint/no-unused-expressions
          didDoubleTouch = true;
          prevTouchTimeStamp = null;
          triggerEvents( start, [ 'dbltap', 'vdblclick' ], e, { x: now[0], y: now[1] } );
        } else {
          touchTimeout = setTimeout(() => {
            if (didDoubleTouch) return;
            triggerEvents( start, [ 'onetap', 'voneclick' ], e, { x: now[0], y: now[1] } );
          }, cy.multiClickDebounceTime());
          prevTouchTimeStamp = e.timeStamp;
        }
      }

      // Prepare to select the currently touched node, only if it hasn't been dragged past a certain distance
      if( start != null
          && !r.dragData.didDrag // didn't drag nodes around
          && start._private.selectable
          && rdist2 < r.touchTapThreshold2
          && !r.pinching // pinch to zoom should not affect selection
      ){

        if( cy.selectionType() === 'single' ){
          cy.$(isSelected).unmerge( start ).unselect(['tapunselect']);
          start.select(['tapselect']);
        } else {
          if( start.selected() ){
            start.unselect(['tapunselect']);
          } else {
            start.select(['tapselect']);
          }
        }

        r.redrawHint( 'eles', true );
      }

      r.touchData.singleTouchMoved = true;
    }

    for( let j = 0; j < now.length; j++ ){ earlier[ j ] = now[ j ]; }

    r.dragData.didDrag = false; // reset for next touchstart

    if( e.touches.length === 0 ){
      r.touchData.dragDelta = [];
      r.touchData.startPosition = [null, null, null, null, null, null];
      r.touchData.startGPosition = null;
      r.touchData.didSelect = false;
    }

    if( e.touches.length < 2 ){
      if( e.touches.length === 1 ){
        // the old start global pos'n may not be the same finger that remains
        r.touchData.startGPosition = [ e.touches[0].clientX, e.touches[0].clientY ];
      }

      r.pinching = false;

      r.redrawHint( 'eles', true );
      r.redraw();
    }

    //r.redraw();

  }, false );

  // fallback compatibility layer for ms pointer events
  if( typeof TouchEvent === 'undefined' ){

    /* eslint-disable @typescript-eslint/no-explicit-any -- pointer-event shim reads vendor fields and builds synthetic touches */
    let pointers: any[] = [];

    let makeTouch = function( e: any ){
      return {
        clientX: e.clientX,
        clientY: e.clientY,
        force: 1,
        identifier: e.pointerId,
        pageX: e.pageX,
        pageY: e.pageY,
        radiusX: e.width / 2,
        radiusY: e.height / 2,
        screenX: e.screenX,
        screenY: e.screenY,
        target: e.target
      };
    };

    let makePointer = function( e: any ){
      return {
        event: e,
        touch: makeTouch( e )
      };
    };

    let addPointer = function( e: any ){
      pointers.push( makePointer( e ) );
    };

    let removePointer = function( e: any ){
      for( let i = 0; i < pointers.length; i++ ){
        let p = pointers[ i ];

        if( p.event.pointerId === e.pointerId ){
          pointers.splice( i, 1 );
          return;
        }
      }
    };

    let updatePointer = function( e: any ){
      let p = pointers.filter( function( p: any ){
        return p.event.pointerId === e.pointerId;
      } )[0];

      p.event = e;
      p.touch = makeTouch( e );
    };

    let addTouchesToEvent = function( e: any ){
      e.touches = pointers.map( function( p: any ){
        return p.touch;
      } );
    };

    let pointerIsMouse = function( e: any ){
      return e.pointerType === 'mouse' || e.pointerType === 4;
    };

    r.registerBinding( r.container, 'pointerdown', function( e: any ){
      if( pointerIsMouse(e) ){ return; } // mouse already handled

      e.preventDefault();

      addPointer( e );

      addTouchesToEvent( e );
      touchstartHandler( e );
    } );

    r.registerBinding( r.container, 'pointerup', function( e: any ){
      if( pointerIsMouse(e) ){ return; } // mouse already handled

      removePointer( e );

      addTouchesToEvent( e );
      touchendHandler( e );
    } );

    r.registerBinding( r.container, 'pointercancel', function( e: any ){
      if( pointerIsMouse(e) ){ return; } // mouse already handled

      removePointer( e );

      addTouchesToEvent( e );
      touchcancelHandler( e );
    } );

    r.registerBinding( r.container, 'pointermove', function( e: any ){
      if( pointerIsMouse(e) ){ return; } // mouse already handled

      e.preventDefault();

      updatePointer( e );

      addTouchesToEvent( e );
      touchmoveHandler( e );
    } );
    /* eslint-enable @typescript-eslint/no-explicit-any */

  }
};

export default BRp;
