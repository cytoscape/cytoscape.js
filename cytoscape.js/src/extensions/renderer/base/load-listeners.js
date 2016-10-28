'use strict';

var is = require( '../../../is' );
var util = require( '../../../util' );
var math = require( '../../../math' );
var Event = require( '../../../event' );

var BRp = {};

BRp.registerBinding = function( target, event, handler, useCapture ){
  var args = Array.prototype.slice.apply( arguments, [1] ); // copy
  var b = this.binder( target );

  return b.on.apply( b, args );
};

BRp.binder = function( tgt ){
  var r = this;

  var on = function(){
    var args = arguments;

    r.bindings.push({
      target: tgt,
      args: args
    });

    ( tgt.addEventListener || tgt.on ).apply( tgt, args );

    return this;
  };

  return {
    on: on,
    addEventListener: on,
    addListener: on,
    bind: on
  };
};

BRp.nodeIsDraggable = function( node ){
  return (
    node
    && node.isNode()
    && !node.locked()
    && node.grabbable()
  );
};

BRp.nodeIsGrabbable = function( node ){
  return (
    this.nodeIsDraggable( node )
    && node.pstyle( 'opacity' ).value !== 0
    && node.pstyle( 'visibility' ).value === 'visible'
    && node.pstyle( 'display' ).value === 'element'
  );
};

BRp.load = function(){
  var r = this;

  var triggerEvents = function( target, names, e, props ){
    if( target == null ){
      target = r.cy;
    }

    for( var i = 0; i < names.length; i++ ){
      var name = names[ i ];

      var event = new Event( e, util.extend( { type: name }, props ) );
      target.trigger( event );
    }
  };

  var isMultSelKeyDown = function( e ){
    return e.shiftKey || e.metaKey || e.ctrlKey; // maybe e.altKey
  };

  var allowPanningPassthrough = function( down, downs ){
    var allowPassthrough = true;

    if( r.cy.hasCompoundNodes() && down && down.isEdge() ){
      // a compound node below the edge => no passthrough panning
      for( var i = 0; downs && i < downs.length; i++ ){
        var down = downs[i];

        if( down.isNode() && down.isParent() ){
          allowPassthrough = false;
          break;
        }
      }
    } else {
      allowPassthrough = true;
    }

    return allowPassthrough;
  };

  var getDragListIds = function( opts ){
    var listHasId;

    if( opts.addToList && r.cy.hasCompoundNodes() ){ // only needed for compound graphs
      if( !opts.addToList.hasId ){ // build ids lookup if doesn't already exist
        opts.addToList.hasId = {};

        for( var i = 0; i < opts.addToList.length; i++ ){
          var ele = opts.addToList[ i ];

          opts.addToList.hasId[ ele.id() ] = true;
        }
      }

      listHasId = opts.addToList.hasId;
    }

    return listHasId || {};
  };

  var setGrabbed = function( ele ){
    ele[0]._private.grabbed = true;
  };

  var setFreed = function( ele ){
    ele[0]._private.grabbed = false;
  };

  var setInDragLayer = function( ele ){
    ele[0]._private.rscratch.inDragLayer = true;
  };

  var setOutDragLayer = function( ele ){
    ele[0]._private.rscratch.inDragLayer = false;
  };

  var setGrabTarget = function( ele ){
    ele[0]._private.rscratch.isGrabTarget = true;
  };

  var removeGrabTarget = function( ele ){
    ele[0]._private.rscratch.isGrabTarget = false;
  };

  var addToDragList = function( ele, opts ){
    var listHasId = getDragListIds( opts );

    if( !listHasId[ ele.id() ] ){
      opts.addToList.push( ele );
      listHasId[ ele.id() ] = true;

      setGrabbed( ele );
    }
  };

  // helper function to determine which child nodes and inner edges
  // of a compound node to be dragged as well as the grabbed and selected nodes
  var addDescendantsToDrag = function( node, opts ){
    if( !node.cy().hasCompoundNodes() ){
      return;
    }

    if( opts.inDragLayer == null && opts.addToList == null ){ return; } // nothing to do

    var innerNodes = node.descendants();

    if( opts.inDragLayer ){
      innerNodes.forEach( setInDragLayer );
      innerNodes.connectedEdges().forEach( setInDragLayer );
    }

    if( opts.addToList ){
      innerNodes.forEach(function( ele ){
        addToDragList( ele, opts );
      });
    }
  };

  // adds the given nodes and its neighbourhood to the drag layer
  var addNodesToDrag = function( nodes, opts ){
    opts = opts || {};

    var hasCompoundNodes = nodes.cy().hasCompoundNodes();

    if( opts.inDragLayer ){
      nodes.forEach( setInDragLayer );

      nodes.neighborhood().stdFilter(function( ele ){
        return !hasCompoundNodes || ele.isEdge();
      }).forEach( setInDragLayer );
    }

    if( opts.addToList ){
      nodes.forEach(function( ele ){
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

  var addNodeToDrag = addNodesToDrag;

  var freeDraggedElements = function( grabbedEles ){
    if( !grabbedEles ){ return; }

    grabbedEles.hasId = {}; // clear the id list

    // just go over all elements rather than doing a bunch of (possibly expensive) traversals
    r.getCachedZSortedEles().forEach(function( ele ){
      setFreed( ele );
      setOutDragLayer( ele );
      removeGrabTarget( ele );
    });

    r.updateCachedGrabbedEles();
  };

  // helper function to determine which ancestor nodes and edges should go
  // to the drag layer (or should be removed from drag layer).
  var updateAncestorsInDragLayer = function( node, opts ){

    if( opts.inDragLayer == null && opts.addToList == null ){ return; } // nothing to do

    if( !node.cy().hasCompoundNodes() ){
      return;
    }

    // find top-level parent
    var parent = node.ancestors().orphans();

    // no parent node: no nodes to add to the drag layer
    if( parent.same( node ) ){
      return;
    }

    var nodes = parent.descendants().spawnSelf()
      .merge( parent )
      .unmerge( node )
      .unmerge( node.descendants() )
    ;

    var edges = nodes.connectedEdges();

    if( opts.inDragLayer ){
      edges.forEach( setInDragLayer );
      nodes.forEach( setInDragLayer );
    }

    if( opts.addToList ){
      nodes.forEach(function( ele ){
        addToDragList( ele, opts );
      });
    }
  };

  var haveMutationsApi = typeof MutationObserver !== 'undefined';

  // watch for when the cy container is removed from the dom
  if( haveMutationsApi ){
    r.removeObserver = new MutationObserver( function( mutns ){ // eslint-disable-line no-undef
      for( var i = 0; i < mutns.length; i++ ){
        var mutn = mutns[ i ];
        var rNodes = mutn.removedNodes;

        if( rNodes ){ for( var j = 0; j < rNodes.length; j++ ){
          var rNode = rNodes[ j ];

          if( rNode === r.container ){
            r.destroy();
            break;
          }
        } }
      }
    } );

    if( r.container.parentNode ){
      r.removeObserver.observe( r.container.parentNode, { childList: true } );
    }
  } else {
    r.registerBinding( r.container, 'DOMNodeRemoved', function( e ){
      r.destroy();
    } );
  }

  var onResize = util.debounce( function(){
    r.cy.invalidateSize();
    r.invalidateContainerClientCoordsCache();

    r.matchCanvasSize( r.container );
    r.redrawHint( 'eles', true );
    r.redrawHint( 'drag', true );
    r.redraw();
  }, 100 );

  if( haveMutationsApi ){
    r.styleObserver = new MutationObserver( onResize ); // eslint-disable-line no-undef

    r.styleObserver.observe( r.container, { attributes: true } );
  }

  // auto resize
  r.registerBinding( window, 'resize', onResize ); // eslint-disable-line no-undef

  var invalCtnrBBOnScroll = function( domEle ){
    r.registerBinding( domEle, 'scroll', function( e ){
      r.invalidateContainerClientCoordsCache();
    } );
  };

  var bbCtnr = r.cy.container();

  for( ;; ){

    invalCtnrBBOnScroll( bbCtnr );

    if( bbCtnr.parentNode ){
      bbCtnr = bbCtnr.parentNode;
    } else {
      break;
    }

  }

  // stop right click menu from appearing on cy
  r.registerBinding( r.container, 'contextmenu', function( e ){
    e.preventDefault();
  } );

  var inBoxSelection = function(){
    return r.selection[4] !== 0;
  };

  // Primary key
  r.registerBinding( r.container, 'mousedown', function mousedownHandler( e ){
    e.preventDefault();
    r.hoverData.capture = true;
    r.hoverData.which = e.which;

    var cy = r.cy;
    var gpos = [ e.clientX, e.clientY ];
    var pos = r.projectIntoViewport( gpos[0], gpos[1] );
    var select = r.selection;
    var nears = r.findNearestElements( pos[0], pos[1], true, false );
    var near = nears[0];
    var draggedElements = r.dragData.possibleDragElements;

    r.hoverData.mdownPos = pos;
    r.hoverData.mdownGPos = gpos;

    var checkForTaphold = function(){
      r.hoverData.tapholdCancelled = false;

      clearTimeout( r.hoverData.tapholdTimeout );

      r.hoverData.tapholdTimeout = setTimeout( function(){

        if( r.hoverData.tapholdCancelled ){
          return;
        } else {
          var ele = r.hoverData.down;

          if( ele ){
            ele.trigger( new Event( e, {
              type: 'taphold',
              cyPosition: { x: pos[0], y: pos[1] }
            } ) );
          } else {
            cy.trigger( new Event( e, {
              type: 'taphold',
              cyPosition: { x: pos[0], y: pos[1] }
            } ) );
          }
        }

      }, r.tapholdDuration );
    };

    // Right click button
    if( e.which == 3 ){

      r.hoverData.cxtStarted = true;

      var cxtEvt = new Event( e, {
        type: 'cxttapstart',
        cyPosition: { x: pos[0], y: pos[1] }
      } );

      if( near ){
        near.activate();
        near.trigger( cxtEvt );

        r.hoverData.down = near;
      } else {
        cy.trigger( cxtEvt );
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

            var grabEvent = new Event( e, {
              type: 'grab',
              cyPosition: { x: pos[0], y: pos[1] }
            } );

            setGrabTarget( near );

            if( !near.selected() ){

              draggedElements = r.dragData.possibleDragElements = [];
              addNodeToDrag( near, { addToList: draggedElements } );

              near.trigger( grabEvent );

            } else if( near.selected() ){
              draggedElements = r.dragData.possibleDragElements = [  ];

              var selectedNodes = cy.$( function(){ return this.isNode() && this.selected() && r.nodeIsGrabbable( this ); } );

              addNodesToDrag( selectedNodes, { addToList: draggedElements } );

              near.trigger( grabEvent );
            }

            r.redrawHint( 'eles', true );
            r.redrawHint( 'drag', true );

          }

        }

        r.hoverData.down = near;
        r.hoverData.downs = nears;
        r.hoverData.downTime = (new Date()).getTime();
      }

      triggerEvents( near, [ 'mousedown', 'tapstart', 'vmousedown' ], e, {
        cyPosition: { x: pos[0], y: pos[1] }
      } );

      if( near == null ){
        select[4] = 1;

        r.data.bgActivePosistion = {
          x: pos[0],
          y: pos[1]
        };

        r.redrawHint( 'select', true );

        r.redraw();
      } else if( near.isEdge() ){
        select[4] = 1; // for future pan
      }

      checkForTaphold();

    }

    // Initialize selection box coordinates
    select[0] = select[2] = pos[0];
    select[1] = select[3] = pos[1];

  }, false );

  r.registerBinding( window, 'mousemove', function mousemoveHandler( e ){ // eslint-disable-line no-undef
    var preventDefault = false;
    var capture = r.hoverData.capture;

    // save cycles if mouse events aren't to be captured
    if( !capture ){
      var containerPageCoords = r.findContainerClientCoords();

      if( e.clientX > containerPageCoords[0] && e.clientX < containerPageCoords[0] + r.canvasWidth
        && e.clientY > containerPageCoords[1] && e.clientY < containerPageCoords[1] + r.canvasHeight
      ){
        // inside container bounds so OK
      } else {
        return;
      }

      var cyContainer = r.container;
      var target = e.target;
      var tParent = target.parentNode;
      var containerIsTarget = false;

      while( tParent ){
        if( tParent === cyContainer ){
          containerIsTarget = true;
          break;
        }

        tParent = tParent.parentNode;
      }

      if( !containerIsTarget ){ return; } // if target is outisde cy container, then this event is not for us
    }

    var cy = r.cy;
    var zoom = cy.zoom();
    var gpos = [ e.clientX, e.clientY ];
    var pos = r.projectIntoViewport( gpos[0], gpos[1] );
    var mdownPos = r.hoverData.mdownPos;
    var mdownGPos = r.hoverData.mdownGPos;
    var select = r.selection;

    var near = null;
    if( !r.hoverData.draggingEles && !r.hoverData.dragging && !r.hoverData.selecting ){
      near = r.findNearestElement( pos[0], pos[1], true, false );
    }
    var last = r.hoverData.last;
    var down = r.hoverData.down;

    var disp = [ pos[0] - select[2], pos[1] - select[3] ];

    var draggedElements = r.dragData.possibleDragElements;

    var isOverThresholdDrag;

    if( mdownGPos ){
      var dx = gpos[0] - mdownGPos[0];
      var dx2 = dx * dx;
      var dy = gpos[1] - mdownGPos[1];
      var dy2 = dy * dy;
      var dist2 = dx2 + dy2;

      isOverThresholdDrag = dist2 >= r.desktopTapThreshold2;
    }

    var multSelKeyDown = isMultSelKeyDown( e );

    if (isOverThresholdDrag) {
      r.hoverData.tapholdCancelled = true;
    }

    var updateDragDelta = function(){
      var dragDelta = r.hoverData.dragDelta = r.hoverData.dragDelta || [];

      if( dragDelta.length === 0 ){
        dragDelta.push( disp[0] );
        dragDelta.push( disp[1] );
      } else {
        dragDelta[0] += disp[0];
        dragDelta[1] += disp[1];
      }
    };


    preventDefault = true;

    triggerEvents( near, [ 'mousemove', 'vmousemove', 'tapdrag' ], e, {
      cyPosition: { x: pos[0], y: pos[1] }
    } );

    // trigger context drag if rmouse down
    if( r.hoverData.which === 3 ){
      // but only if over threshold
      if( isOverThresholdDrag ){
        var cxtEvt = new Event( e, {
          type: 'cxtdrag',
          cyPosition: { x: pos[0], y: pos[1] }
        } );

        if( down ){
          down.trigger( cxtEvt );
        } else {
          cy.trigger( cxtEvt );
        }

        r.hoverData.cxtDragged = true;

        if( !r.hoverData.cxtOver || near !== r.hoverData.cxtOver ){

          if( r.hoverData.cxtOver ){
            r.hoverData.cxtOver.trigger( new Event( e, {
              type: 'cxtdragout',
              cyPosition: { x: pos[0], y: pos[1] }
            } ) );
          }

          r.hoverData.cxtOver = near;

          if( near ){
            near.trigger( new Event( e, {
              type: 'cxtdragover',
              cyPosition: { x: pos[0], y: pos[1] }
            } ) );
          }

        }
      }

    // Check if we are drag panning the entire graph
    } else if( r.hoverData.dragging ){
      preventDefault = true;

      if( cy.panningEnabled() && cy.userPanningEnabled() ){
        var deltaP;

        if( r.hoverData.justStartedPan ){
          var mdPos = r.hoverData.mdownPos;

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

        r.hoverData.dragged = true;
      }

      // Needs reproject due to pan changing viewport
      pos = r.projectIntoViewport( e.clientX, e.clientY );

    // Checks primary button down & out of time & mouse not moved much
    } else if(
        select[4] == 1 && (down == null || down.isEdge())
    ){

      if( isOverThresholdDrag ){

        if( !r.hoverData.dragging && cy.boxSelectionEnabled() && ( multSelKeyDown || !cy.panningEnabled() || !cy.userPanningEnabled() ) ){
          r.data.bgActivePosistion = undefined;

          if( !r.hoverData.selecting ){
            cy.trigger('boxstart');
          }

          r.hoverData.selecting = true;

          r.redrawHint( 'select', true );
          r.redraw();

        } else if( !r.hoverData.selecting && cy.panningEnabled() && cy.userPanningEnabled() ){
          var allowPassthrough = allowPanningPassthrough( down, r.hoverData.downs );

          if( allowPassthrough ){
            r.hoverData.dragging = true;
            r.hoverData.justStartedPan = true;
            select[4] = 0;

            r.data.bgActivePosistion = math.array2point( mdownPos );

            r.redrawHint( 'select', true );
            r.redraw();
          }
        }

        if( down && down.isEdge() && down.active() ){ down.unactivate(); }

      }

    } else {
      if( down && down.isEdge() && down.active() ){ down.unactivate(); }

      if( ( !down || !down.grabbed() ) && near != last ){

        if( last ){
          triggerEvents( last, [ 'mouseout', 'tapdragout' ], e, {
            cyPosition: { x: pos[0], y: pos[1] }
          } );
        }

        if( near ){
          triggerEvents( near, [ 'mouseover', 'tapdragover' ], e, {
            cyPosition: { x: pos[0], y: pos[1] }
          } );
        }

        r.hoverData.last = near;
      }

      if( down && r.nodeIsDraggable( down ) ){

        if( isOverThresholdDrag ){ // then drag

          var justStartedDrag = !r.dragData.didDrag;

          if( justStartedDrag ){
            r.redrawHint( 'eles', true );
          }

          r.dragData.didDrag = true; // indicate that we actually did drag the node

          var toTrigger = [];

          // now, add the elements to the drag layer if not done already
          if( !r.hoverData.draggingEles ){
            addNodesToDrag( cy.collection( draggedElements ), { inDragLayer: true } );
          }

          for( var i = 0; i < draggedElements.length; i++ ){
            var dEle = draggedElements[ i ];

            // Locked nodes not draggable, as well as non-visible nodes
            if( r.nodeIsDraggable( dEle ) && dEle.grabbed() ){
              var dPos = dEle._private.position;

              toTrigger.push( dEle );

              if( is.number( disp[0] ) && is.number( disp[1] ) ){
                var updatePos = !dEle.isParent();

                if( updatePos ){
                  dPos.x += disp[0];
                  dPos.y += disp[1];
                }

                if( justStartedDrag ){
                  var dragDelta = r.hoverData.dragDelta;

                  if( updatePos && dragDelta && is.number( dragDelta[0] ) && is.number( dragDelta[1] ) ){
                    dPos.x += dragDelta[0];
                    dPos.y += dragDelta[1];
                  }
                }
              }

            }
          }

          r.hoverData.draggingEles = true;

          var tcol = cy.collection( toTrigger );

          tcol.updateCompoundBounds();
          tcol.trigger( 'position drag' );

          r.redrawHint( 'drag', true );
          r.redraw();

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

  r.registerBinding( window, 'mouseup', function mouseupHandler( e ){ // eslint-disable-line no-undef
    var capture = r.hoverData.capture;
    if( !capture ){ return; }
    r.hoverData.capture = false;

    var cy = r.cy; var pos = r.projectIntoViewport( e.clientX, e.clientY ); var select = r.selection;
    var near = r.findNearestElement( pos[0], pos[1], true, false );
    var draggedElements = r.dragData.possibleDragElements; var down = r.hoverData.down;
    var multSelKeyDown = isMultSelKeyDown( e );

    if( r.data.bgActivePosistion ){
      r.redrawHint( 'select', true );
      r.redraw();
    }

    r.hoverData.tapholdCancelled = true;

    r.data.bgActivePosistion = undefined; // not active bg now

    if( down ){
      down.unactivate();
    }

    if( r.hoverData.which === 3 ){
      var cxtEvt = new Event( e, {
        type: 'cxttapend',
        cyPosition: { x: pos[0], y: pos[1] }
      } );

      if( down ){
        down.trigger( cxtEvt );
      } else {
        cy.trigger( cxtEvt );
      }

      if( !r.hoverData.cxtDragged ){
        var cxtTap = new Event( e, {
          type: 'cxttap',
          cyPosition: { x: pos[0], y: pos[1] }
        } );

        if( down ){
          down.trigger( cxtTap );
        } else {
          cy.trigger( cxtTap );
        }
      }

      r.hoverData.cxtDragged = false;
      r.hoverData.which = null;

    } else if( r.hoverData.which === 1 ){

      // Deselect all elements if nothing is currently under the mouse cursor and we aren't dragging something
      if( (down == null) // not mousedown on node
        && !r.dragData.didDrag // didn't move the node around
        && !r.hoverData.selecting // not box selection
        && !r.hoverData.dragged // didn't pan
        && !isMultSelKeyDown( e )
      ){

        cy.$( function(){
          return this.selected();
        } ).unselect();

        if( draggedElements.length > 0 ){
          r.redrawHint( 'eles', true );
        }

        r.dragData.possibleDragElements = draggedElements = [];
      }

      triggerEvents( near, [ 'mouseup', 'tapend', 'vmouseup' ], e, {
        cyPosition: { x: pos[0], y: pos[1] }
      } );

      if(
        !r.dragData.didDrag // didn't move a node around
        && !r.hoverData.dragged // didn't pan
        && !r.hoverData.selecting // not box selection
      ){
        triggerEvents( down, ['click', 'tap', 'vclick'], e, {
          cyPosition: { x: pos[0], y: pos[1] }
        } );
      }

      // Single selection
      if( near == down && !r.dragData.didDrag && !r.hoverData.selecting ){
        if( near != null && near._private.selectable ){

          if( r.hoverData.dragging ){
            // if panning, don't change selection state
          } else if( cy.selectionType() === 'additive' || multSelKeyDown ){
            if( near.selected() ){
              near.unselect();
            } else {
              near.select();
            }
          } else {
            if( !multSelKeyDown ){
              cy.$( ':selected' ).unmerge( near ).unselect();
              near.select();
            }
          }

          r.redrawHint( 'eles', true );
        }
      }

      if( r.hoverData.selecting ){
        var box = cy.collection( r.getAllInBox( select[0], select[1], select[2], select[3] ) );

        r.redrawHint( 'select', true );

        if( box.length > 0 ){
          r.redrawHint( 'eles', true );
        }

        cy.trigger('boxend');

        var eleWouldBeSelected = function( ele ){ return ele.selectable() && !ele.selected(); };

        if( cy.selectionType() === 'additive' ){
          box
            .trigger('box')
            .stdFilter( eleWouldBeSelected )
              .select()
              .trigger('boxselect')
          ;
        } else {
          if( !multSelKeyDown ){
            cy.$( ':selected' ).unmerge( box ).unselect();
          }

          box
            .trigger('box')
            .stdFilter( eleWouldBeSelected )
              .select()
              .trigger('boxselect')
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

        var downWasGrabbed = down && down.grabbed();

        freeDraggedElements( draggedElements );

        if( downWasGrabbed ){ down.trigger('free'); }
      }

    } // else not right mouse

    select[4] = 0; r.hoverData.down = null;

    r.hoverData.cxtStarted = false;
    r.hoverData.draggingEles = false;
    r.hoverData.selecting = false;
    r.dragData.didDrag = false;
    r.hoverData.dragged = false;
    r.hoverData.dragDelta = [];
    r.hoverData.mdownPos = null;
    r.hoverData.mdownGPos = null;

  }, false );

  var wheelHandler = function( e ){


    if( r.scrollingPage ){ return; } // while scrolling, ignore wheel-to-zoom

    var cy = r.cy;
    var pos = r.projectIntoViewport( e.clientX, e.clientY );
    var rpos = [ pos[0] * cy.zoom() + cy.pan().x,
                  pos[1] * cy.zoom() + cy.pan().y ];

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

      var diff;

      if( e.deltaY != null ){
        diff = e.deltaY / -250;
      } else if( e.wheelDeltaY != null ){
        diff = e.wheelDeltaY / 1000;
      } else {
        diff = e.wheelDelta / 1000;
      }

      diff = diff * r.wheelSensitivity;

      var needsWheelFix = e.deltaMode === 1;
      if( needsWheelFix ){ // fixes slow wheel events on ff/linux and ff/windows
        diff *= 33;
      }

      cy.zoom( {
        level: cy.zoom() * Math.pow( 10, diff ),
        renderedPosition: { x: rpos[0], y: rpos[1] }
      } );
    }

  };

  // Functions to help with whether mouse wheel should trigger zooming
  // --
  r.registerBinding( r.container, 'wheel', wheelHandler, true );

  // disable nonstandard wheel events
  // r.registerBinding(r.container, 'mousewheel', wheelHandler, true);
  // r.registerBinding(r.container, 'DOMMouseScroll', wheelHandler, true);
  // r.registerBinding(r.container, 'MozMousePixelScroll', wheelHandler, true); // older firefox

  r.registerBinding( window, 'scroll', function scrollHandler( e ){ // eslint-disable-line no-undef
    r.scrollingPage = true;

    clearTimeout( r.scrollingPageTimeout );
    r.scrollingPageTimeout = setTimeout( function(){
      r.scrollingPage = false;
    }, 250 );
  }, true );

  // Functions to help with handling mouseout/mouseover on the Cytoscape container
  // Handle mouseout on Cytoscape container
  r.registerBinding( r.container, 'mouseout', function mouseOutHandler( e ){
    var pos = r.projectIntoViewport( e.clientX, e.clientY );

    r.cy.trigger( new Event( e, {
      type: 'mouseout',
      cyPosition: { x: pos[0], y: pos[1] }
    } ) );
  }, false );

  r.registerBinding( r.container, 'mouseover', function mouseOverHandler( e ){
    var pos = r.projectIntoViewport( e.clientX, e.clientY );

    r.cy.trigger( new Event( e, {
      type: 'mouseover',
      cyPosition: { x: pos[0], y: pos[1] }
    } ) );
  }, false );

  var f1x1, f1y1, f2x1, f2y1; // starting points for pinch-to-zoom
  var distance1, distance1Sq; // initial distance between finger 1 and finger 2 for pinch-to-zoom
  var center1, modelCenter1; // center point on start pinch to zoom
  var offsetLeft, offsetTop;
  var containerWidth, containerHeight;
  var twoFingersStartInside;

  var distance = function( x1, y1, x2, y2 ){
    return Math.sqrt( (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) );
  };

  var distanceSq = function( x1, y1, x2, y2 ){
    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  };

  var touchstartHandler;
  r.registerBinding( r.container, 'touchstart', touchstartHandler = function( e ){
    r.touchData.capture = true;
    r.data.bgActivePosistion = undefined;

    var cy = r.cy;
    var now = r.touchData.now;
    var earlier = r.touchData.earlier;

    if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; }
    if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; }
    if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; }

    // record starting points for pinch-to-zoom
    if( e.touches[1] ){

      freeDraggedElements( r.dragData.touchDragEles );

      var offsets = r.findContainerClientCoords();
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

      var pan = cy.pan();
      var zoom = cy.zoom();

      distance1 = distance( f1x1, f1y1, f2x1, f2y1 );
      distance1Sq = distanceSq( f1x1, f1y1, f2x1, f2y1 );
      center1 = [ (f1x1 + f2x1) / 2, (f1y1 + f2y1) / 2 ];
      modelCenter1 = [
        (center1[0] - pan.x) / zoom,
        (center1[1] - pan.y) / zoom
      ];

      // consider context tap
      var cxtDistThreshold = 200;
      var cxtDistThresholdSq = cxtDistThreshold * cxtDistThreshold;
      if( distance1Sq < cxtDistThresholdSq && !e.touches[2] ){

        var near1 = r.findNearestElement( now[0], now[1], true, true );
        var near2 = r.findNearestElement( now[2], now[3], true, true );

        if( near1 && near1.isNode() ){
          near1.activate().trigger( new Event( e, {
            type: 'cxttapstart',
            cyPosition: { x: now[0], y: now[1] }
          } ) );
          r.touchData.start = near1;

        } else if( near2 && near2.isNode() ){
          near2.activate().trigger( new Event( e, {
            type: 'cxttapstart',
            cyPosition: { x: now[0], y: now[1] }
          } ) );
          r.touchData.start = near2;

        } else {
          cy.trigger( new Event( e, {
            type: 'cxttapstart',
            cyPosition: { x: now[0], y: now[1] }
          } ) );
          r.touchData.start = null;
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
    } else if( e.touches[1] ){
      // ignore
    } else if( e.touches[0] ){
      var nears = r.findNearestElements( now[0], now[1], true, true );
      var near = nears[0];

      if( near != null ){
        near.activate();

        r.touchData.start = near;
        r.touchData.starts = nears;

        if( r.nodeIsGrabbable( near ) ){

          var draggedEles = r.dragData.touchDragEles = [];

          r.redrawHint( 'eles', true );
          r.redrawHint( 'drag', true );

          if( near.selected() ){
            // reset drag elements, since near will be added again

            var selectedNodes = cy.$( function(){
              return this.selected() && r.nodeIsGrabbable( this );
            } );

            addNodesToDrag( selectedNodes, { addToList: draggedEles } );
          } else {
            addNodeToDrag( near, { addToList: draggedEles } );
          }

          setGrabTarget( near );

          near.trigger( new Event( e, {
            type: 'grab',
            cyPosition: { x: now[0], y: now[1] }
          } ) );
        }
      }

      triggerEvents( near, [ 'touchstart', 'tapstart', 'vmousedown' ], e, {
        cyPosition: { x: now[0], y: now[1] }
      } );

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

      r.touchData.startPosition = [];
      for (var i=0; i<now.length; i++) {
        earlier[i] = now[i];
        r.touchData.startPosition[i] = now[i];
      }

      r.touchData.startGPosition = [ e.touches[0].clientX, e.touches[0].clientY ];

      r.touchData.singleTouchMoved = false;
      r.touchData.singleTouchStartTime = +new Date();

      clearTimeout( r.touchData.tapholdTimeout );
      r.touchData.tapholdTimeout = setTimeout( function(){
        if(
            r.touchData.singleTouchMoved === false
            && !r.pinching // if pinching, then taphold unselect shouldn't take effect
            && !r.touchData.selecting // box selection shouldn't allow taphold through
        ){
          triggerEvents( r.touchData.start, [ 'taphold' ], e, {
            cyPosition: { x: now[0], y: now[1] }
          } );

          if( !r.touchData.start ){
            cy.$( ':selected' ).unselect();
          }

        }
      }, r.tapholdDuration );
    }

  }, false );

  var touchmoveHandler;
  r.registerBinding(window, 'touchmove', touchmoveHandler = function(e) { // eslint-disable-line no-undef
    var select = r.selection;
    var capture = r.touchData.capture;
    var cy = r.cy;
    var now = r.touchData.now;
    var earlier = r.touchData.earlier;
    var zoom = cy.zoom();

    if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; }
    if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; }
    if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; }

    var isOverThresholdDrag;

    if( capture && e.touches[0] ){
      var disp = []; for (var j=0;j<now.length;j++) { disp[j] = now[j] - earlier[j]; }
      var startGPos = r.touchData.startGPosition;
      var dx = e.touches[0].clientX - startGPos[0];
      var dx2 = dx * dx;
      var dy = e.touches[0].clientY - startGPos[1];
      var dy2 = dy * dy;
      var dist2 = dx2 + dy2;

      isOverThresholdDrag = dist2 >= r.touchTapThreshold2;
    }

    // context swipe cancelling
    if( capture && r.touchData.cxt ){
      e.preventDefault();

      var f1x2 = e.touches[0].clientX - offsetLeft, f1y2 = e.touches[0].clientY - offsetTop;
      var f2x2 = e.touches[1].clientX - offsetLeft, f2y2 = e.touches[1].clientY - offsetTop;
      // var distance2 = distance( f1x2, f1y2, f2x2, f2y2 );
      var distance2Sq = distanceSq( f1x2, f1y2, f2x2, f2y2 );
      var factorSq = distance2Sq / distance1Sq;

      var distThreshold = 150;
      var distThresholdSq = distThreshold * distThreshold;
      var factorThreshold = 1.5;
      var factorThresholdSq = factorThreshold * factorThreshold;

      // cancel ctx gestures if the distance b/t the fingers increases
      if( factorSq >= factorThresholdSq || distance2Sq >= distThresholdSq ){
        r.touchData.cxt = false;
        if( r.touchData.start ){ r.touchData.start.unactivate(); r.touchData.start = null; }
        r.data.bgActivePosistion = undefined;
        r.redrawHint( 'select', true );

        var cxtEvt = new Event( e, {
          type: 'cxttapend',
          cyPosition: { x: now[0], y: now[1] }
        } );
        if( r.touchData.start ){
          r.touchData.start.trigger( cxtEvt );
        } else {
          cy.trigger( cxtEvt );
        }
      }

    }

    // context swipe
    if( capture && r.touchData.cxt ){
      var cxtEvt = new Event( e, {
        type: 'cxtdrag',
        cyPosition: { x: now[0], y: now[1] }
      } );
      r.data.bgActivePosistion = undefined;
      r.redrawHint( 'select', true );

      if( r.touchData.start ){
        r.touchData.start.trigger( cxtEvt );
      } else {
        cy.trigger( cxtEvt );
      }

      if( r.touchData.start ){ r.touchData.start._private.grabbed = false; }
      r.touchData.cxtDragged = true;

      var near = r.findNearestElement( now[0], now[1], true, true );

      if( !r.touchData.cxtOver || near !== r.touchData.cxtOver ){

        if( r.touchData.cxtOver ){
          r.touchData.cxtOver.trigger( new Event( e, {
            type: 'cxtdragout',
            cyPosition: { x: now[0], y: now[1] }
          } ) );
        }

        r.touchData.cxtOver = near;

        if( near ){
          near.trigger( new Event( e, {
            type: 'cxtdragover',
            cyPosition: { x: now[0], y: now[1] }
          } ) );

        }

      }

    // box selection
    } else if( capture && e.touches[2] && cy.boxSelectionEnabled() ){
      e.preventDefault();

      r.data.bgActivePosistion = undefined;

      this.lastThreeTouch = +new Date();

      if( !r.touchData.selecting ){
        cy.trigger('boxstart');
      }

      r.touchData.selecting = true;

      r.redrawHint( 'select', true );

      if( !select || select.length === 0 || select[0] === undefined ){
        select[0] = (now[0] + now[2] + now[4]) / 3;
        select[1] = (now[1] + now[3] + now[5]) / 3;
        select[2] = (now[0] + now[2] + now[4]) / 3 + 1;
        select[3] = (now[1] + now[3] + now[5]) / 3 + 1;
      } else {
        select[2] = (now[0] + now[2] + now[4]) / 3;
        select[3] = (now[1] + now[3] + now[5]) / 3;
      }

      select[4] = 1;
      r.touchData.selecting = true;

      r.redraw();

    // pinch to zoom
    } else if( capture && e.touches[1] && cy.zoomingEnabled() && cy.panningEnabled() && cy.userZoomingEnabled() && cy.userPanningEnabled() ){ // two fingers => pinch to zoom
      e.preventDefault();

      r.data.bgActivePosistion = undefined;
      r.redrawHint( 'select', true );

      var draggedEles = r.dragData.touchDragEles;
      if( draggedEles ){
        r.redrawHint( 'drag', true );

        for( var i = 0; i < draggedEles.length; i++ ){
          draggedEles[ i ]._private.grabbed = false;
          draggedEles[ i ]._private.rscratch.inDragLayer = false;
        }
      }

      // (x2, y2) for fingers 1 and 2
      var f1x2 = e.touches[0].clientX - offsetLeft, f1y2 = e.touches[0].clientY - offsetTop;
      var f2x2 = e.touches[1].clientX - offsetLeft, f2y2 = e.touches[1].clientY - offsetTop;


      var distance2 = distance( f1x2, f1y2, f2x2, f2y2 );
      // var distance2Sq = distanceSq( f1x2, f1y2, f2x2, f2y2 );
      // var factor = Math.sqrt( distance2Sq ) / Math.sqrt( distance1Sq );
      var factor = distance2 / distance1;

      if( factor != 1 && twoFingersStartInside ){
        // delta finger1
        var df1x = f1x2 - f1x1;
        var df1y = f1y2 - f1y1;

        // delta finger 2
        var df2x = f2x2 - f2x1;
        var df2y = f2y2 - f2y1;

        // translation is the normalised vector of the two fingers movement
        // i.e. so pinching cancels out and moving together pans
        var tx = (df1x + df2x) / 2;
        var ty = (df1y + df2y) / 2;

        // adjust factor by the speed multiplier
        // var speed = 1.5;
        // if( factor > 1 ){
        //   factor = (factor - 1) * speed + 1;
        // } else {
        //   factor = 1 - (1 - factor) * speed;
        // }

        // now calculate the zoom
        var zoom1 = cy.zoom();
        var zoom2 = zoom1 * factor;
        var pan1 = cy.pan();

        // the model center point converted to the current rendered pos
        var ctrx = modelCenter1[0] * zoom1 + pan1.x;
        var ctry = modelCenter1[1] * zoom1 + pan1.y;

        var pan2 = {
          x: -zoom2 / zoom1 * (ctrx - pan1.x - tx) + ctrx,
          y: -zoom2 / zoom1 * (ctry - pan1.y - ty) + ctry
        };

        // remove dragged eles
        if( r.touchData.start ){
          var draggedEles = r.dragData.touchDragEles;

          freeDraggedElements( draggedEles );

          r.redrawHint( 'drag', true );
          r.redrawHint( 'eles', true );

          r.touchData.start
            .trigger( 'free' )
            .unactivate()
          ;
        }

        cy.viewport( {
          zoom: zoom2,
          pan: pan2,
          cancelOnFailedZoom: true
        } );

        distance1 = distance2;
        f1x1 = f1x2;
        f1y1 = f1y2;
        f2x1 = f2x2;
        f2y1 = f2y2;

        r.pinching = true;
      }

      // Re-project
      if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; }
      if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; }
      if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; }

    } else if( e.touches[0] ){
      var start = r.touchData.start;
      var last = r.touchData.last;
      var near;

      if( !r.hoverData.draggingEles && !r.swipePanning ){
        near = r.findNearestElement( now[0], now[1], true, true );
      }

      if( capture && start != null ){
        e.preventDefault();
      }

      // dragging nodes
      if( capture && start != null && r.nodeIsDraggable( start ) ){

        if( isOverThresholdDrag ){ // then dragging can happen
          var draggedEles = r.dragData.touchDragEles;
          var justStartedDrag = !r.dragData.didDrag;

          if( justStartedDrag ){
            addNodesToDrag( cy.collection( draggedEles ), { inDragLayer: true } );
          }

          for( var k = 0; k < draggedEles.length; k++ ){
            var draggedEle = draggedEles[ k ];

            if( r.nodeIsDraggable( draggedEle ) && draggedEle.grabbed() ){
              r.dragData.didDrag = true;
              var dPos = draggedEle._private.position;
              var updatePos = !draggedEle.isParent();

              if( updatePos && is.number( disp[0] ) && is.number( disp[1] ) ){
                dPos.x += disp[0];
                dPos.y += disp[1];
              }

              if( justStartedDrag ){
                r.redrawHint( 'eles', true );

                var dragDelta = r.touchData.dragDelta;

                if( updatePos && dragDelta && is.number( dragDelta[0] ) && is.number( dragDelta[1] ) ){
                  dPos.x += dragDelta[0];
                  dPos.y += dragDelta[1];
                }

              }
            }
          }

          var tcol = cy.collection( draggedEles );

          tcol.updateCompoundBounds();
          tcol.trigger( 'position drag' );

          r.hoverData.draggingEles = true;

          r.redrawHint( 'drag', true );

          if(
               r.touchData.startPosition[0] == earlier[0]
            && r.touchData.startPosition[1] == earlier[1]
          ){

            r.redrawHint( 'eles', true );
          }

          r.redraw();
        } else { // otherise keep track of drag delta for later
          var dragDelta = r.touchData.dragDelta = r.touchData.dragDelta || [];

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
        triggerEvents( (start || near), [ 'touchmove', 'tapdrag', 'vmousemove' ], e, {
          cyPosition: { x: now[0], y: now[1] }
        } );

        if( ( !start || !start.grabbed() ) && near != last ){
          if( last ){ last.trigger( new Event( e, { type: 'tapdragout', cyPosition: { x: now[0], y: now[1] } } ) ); }
          if( near ){ near.trigger( new Event( e, { type: 'tapdragover', cyPosition: { x: now[0], y: now[1] } } ) ); }
        }

        r.touchData.last = near;
      }

      // check to cancel taphold
      if( capture ){
        for( var i = 0; i < now.length; i++ ){
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
          && ( start == null || start.isEdge() )
          && cy.panningEnabled() && cy.userPanningEnabled()
      ){

        var allowPassthrough = allowPanningPassthrough( start, r.touchData.starts );

        if( allowPassthrough ){
          e.preventDefault();

          if( r.swipePanning ){
            cy.panBy( {
              x: disp[0] * zoom,
              y: disp[1] * zoom
            } );

          } else if( isOverThresholdDrag ){
            r.swipePanning = true;

            cy.panBy( {
              x: dx * zoom,
              y: dy * zoom
            } );

            if( start ){
              start.unactivate();

              if( !r.data.bgActivePosistion ){
                r.data.bgActivePosistion = math.array2point( r.touchData.startPosition );
              }

              r.redrawHint( 'select', true );

              r.touchData.start = null;
            }
          }

        }

        // Re-project
        var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY );
        now[0] = pos[0]; now[1] = pos[1];
      }
    }

    for( var j = 0; j < now.length; j++ ){ earlier[ j ] = now[ j ]; }
    //r.redraw();

  }, false );

  var touchcancelHandler;
  r.registerBinding( window, 'touchcancel', touchcancelHandler = function( e ){ // eslint-disable-line no-undef
    var start = r.touchData.start;

    r.touchData.capture = false;

    if( start ){
      start.unactivate();
    }
  } );

  var touchendHandler;
  r.registerBinding( window, 'touchend', touchendHandler = function( e ){ // eslint-disable-line no-undef
    var start = r.touchData.start;

    var capture = r.touchData.capture;

    if( capture ){
      r.touchData.capture = false;

      e.preventDefault();
    } else {
      return;
    }

    var select = r.selection;

    r.swipePanning = false;
    r.hoverData.draggingEles = false;

    var cy = r.cy;
    var zoom = cy.zoom();
    var now = r.touchData.now;
    var earlier = r.touchData.earlier;

    if( e.touches[0] ){ var pos = r.projectIntoViewport( e.touches[0].clientX, e.touches[0].clientY ); now[0] = pos[0]; now[1] = pos[1]; }
    if( e.touches[1] ){ var pos = r.projectIntoViewport( e.touches[1].clientX, e.touches[1].clientY ); now[2] = pos[0]; now[3] = pos[1]; }
    if( e.touches[2] ){ var pos = r.projectIntoViewport( e.touches[2].clientX, e.touches[2].clientY ); now[4] = pos[0]; now[5] = pos[1]; }

    if( start ){
      start.unactivate();
    }

    var ctxTapend;
    if( r.touchData.cxt ){
      ctxTapend = new Event( e, {
        type: 'cxttapend',
        cyPosition: { x: now[0], y: now[1] }
      } );

      if( start ){
        start.trigger( ctxTapend );
      } else {
        cy.trigger( ctxTapend );
      }

      if( !r.touchData.cxtDragged ){
        var ctxTap = new Event( e, {
          type: 'cxttap',
          cyPosition: { x: now[0], y: now[1] }
        } );

        if( start ){
          start.trigger( ctxTap );
        } else {
          cy.trigger( ctxTap );
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

      var box = cy.collection( r.getAllInBox( select[0], select[1], select[2], select[3] ) );

      select[0] = undefined;
      select[1] = undefined;
      select[2] = undefined;
      select[3] = undefined;
      select[4] = 0;

      r.redrawHint( 'select', true );

      cy.trigger('boxend');

      var eleWouldBeSelected = function( ele ){ return ele.selectable() && !ele.selected(); };

      box
        .trigger('box')
        .stdFilter( eleWouldBeSelected )
          .select()
          .trigger('boxselect')
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

      var draggedEles = r.dragData.touchDragEles;

      if( start != null ){

        var startWasGrabbed = start._private.grabbed;

        freeDraggedElements( draggedEles );

        r.redrawHint( 'drag', true );
        r.redrawHint( 'eles', true );

        if( startWasGrabbed ){
          start.trigger( 'free' );
        }

        triggerEvents( start, [ 'touchend', 'tapend', 'vmouseup', 'tapdragout' ], e, {
          cyPosition: { x: now[0], y: now[1] }
        } );

        start.unactivate();

        r.touchData.start = null;

      } else {
        var near = r.findNearestElement( now[0], now[1], true, true );

        triggerEvents( near, [ 'touchend', 'tapend', 'vmouseup', 'tapdragout' ], e, {
          cyPosition: { x: now[0], y: now[1] }
        } );

      }

      var dx = r.touchData.startPosition[0] - now[0];
      var dx2 = dx * dx;
      var dy = r.touchData.startPosition[1] - now[1];
      var dy2 = dy * dy;
      var dist2 = dx2 + dy2;
      var rdist2 = dist2 * zoom * zoom;

      // Prepare to select the currently touched node, only if it hasn't been dragged past a certain distance
      if( start != null
          && !r.dragData.didDrag // didn't drag nodes around
          && start._private.selectable
          && rdist2 < r.touchTapThreshold2
          && !r.pinching // pinch to zoom should not affect selection
      ){

        if( cy.selectionType() === 'single' ){
          cy.$( ':selected' ).unmerge( start ).unselect();
          start.select();
        } else {
          if( start.selected() ){
            start.unselect();
          } else {
            start.select();
          }
        }

        r.redrawHint( 'eles', true );
      }

      // Tap event, roughly same as mouse click event for touch
      if( !r.touchData.singleTouchMoved ){
        triggerEvents( start, [ 'tap', 'vclick' ], e, {
          cyPosition: { x: now[0], y: now[1] }
        } );
      }

      r.touchData.singleTouchMoved = true;
    }

    for( var j = 0; j < now.length; j++ ){ earlier[ j ] = now[ j ]; }

    r.dragData.didDrag = false; // reset for next mousedown

    if( e.touches.length === 0 ){
      r.touchData.dragDelta = [];
      r.touchData.startPosition = null;
      r.touchData.startGPosition = null;
    }

    if( e.touches.length < 2 ){
      r.pinching = false;
      r.redrawHint( 'eles', true );
      r.redraw();
    }

    //r.redraw();

  }, false );

  // fallback compatibility layer for ms pointer events
  if( typeof TouchEvent === 'undefined' ){

    var pointers = [];

    var makeTouch = function( e ){
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

    var makePointer = function( e ){
      return {
        event: e,
        touch: makeTouch( e )
      };
    };

    var addPointer = function( e ){
      pointers.push( makePointer( e ) );
    };

    var removePointer = function( e ){
      for( var i = 0; i < pointers.length; i++ ){
        var p = pointers[ i ];

        if( p.event.pointerId === e.pointerId ){
          pointers.splice( i, 1 );
          return;
        }
      }
    };

    var updatePointer = function( e ){
      var p = pointers.filter( function( p ){
        return p.event.pointerId === e.pointerId;
      } )[0];

      p.event = e;
      p.touch = makeTouch( e );
    };

    var addTouchesToEvent = function( e ){
      e.touches = pointers.map( function( p ){
        return p.touch;
      } );
    };

    r.registerBinding( r.container, 'pointerdown', function( e ){
      if( e.pointerType === 'mouse' ){ return; } // mouse already handled

      e.preventDefault();

      addPointer( e );

      addTouchesToEvent( e );
      touchstartHandler( e );
    } );

    r.registerBinding( r.container, 'pointerup', function( e ){
      if( e.pointerType === 'mouse' ){ return; } // mouse already handled

      removePointer( e );

      addTouchesToEvent( e );
      touchendHandler( e );
    } );

    r.registerBinding( r.container, 'pointercancel', function( e ){
      if( e.pointerType === 'mouse' ){ return; } // mouse already handled

      removePointer( e );

      addTouchesToEvent( e );
      touchcancelHandler( e );
    } );

    r.registerBinding( r.container, 'pointermove', function( e ){
      if( e.pointerType === 'mouse' ){ return; } // mouse already handled

      e.preventDefault();

      updatePointer( e );

      addTouchesToEvent( e );
      touchmoveHandler( e );
    } );

  }
};

module.exports = BRp;
