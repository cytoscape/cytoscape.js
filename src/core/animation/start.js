function startAnimation( self, ani, now, isCore ){
  let isEles = !isCore;
  let ele = self;
  let ani_p = ani._private;
  let cy = isCore ? self : self.cy();
  let style = cy.style();

  if( isEles ){
    let pos = ele.position();

    ani_p.startPosition = ani_p.startPosition || {
      x: pos.x,
      y: pos.y
    };

    ani_p.startStyle = ani_p.startStyle || style.getAnimationStartStyle( ele, ani_p.style );
  }

  if( isCore ){
    let pan = cy._private.pan;

    ani_p.startPan = ani_p.startPan || {
      x: pan.x,
      y: pan.y
    };

    ani_p.startZoom = ani_p.startZoom != null ? ani_p.startZoom : cy._private.zoom;
  }

  ani_p.started = true;
  ani_p.startTime = now - ani_p.progress * ani_p.duration;
}

module.exports = startAnimation;
