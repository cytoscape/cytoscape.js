/* global document, window, fetch, cytoscape */

(function () {
  var toJson = function (res) {
    return res.json();
  };

  let elements = fetch('data.json').then(toJson);
  window.cy = cytoscape({
    container: document.getElementById('cy'),

    layout: {
      name: 'grid',
      rows: 2
    },

    style: fetch('cy-style.json').then(toJson),

    elements: elements
  });

  let cy = window.cy;

  let globalRadius = 20;

  document.getElementById("radius").onchange = e => {
    let edges = cy.edges();
    globalRadius = Number.parseInt(e.target.value);
    edges.style('segment-radii', globalRadius);
    let nodes = cy.nodes();
    nodes.forEach(node => {
      let position = node.position();
      position.x += 0.00001;
      node.position(position)
    })
  }

  elements.then(() => {
    setTimeout(() => {
      cy.edges().forEach(drawTrace)
      cy.nodes().on('position', (e) => e.target.connectedEdges().forEach(drawTrace))

      function drawTrace(edge) {
        setTimeout(() => {
          let rs = edge._private.rscratch;
          let radii = rs.radii;
          let radius = radii[0];
          if (radius !== globalRadius) return setTimeout(() => drawTrace(edge), 50);

          cy.nodes(`.point[edge="${edge.id()}"]`).remove();
          cy.nodes(`.circle[edge="${edge.id()}"]`).remove();

          let corners = rs.roundCorners;
          let isArcRadii = rs.isArcRadius;
          let pts = rs.allpts;
          for (let i = 0; i < corners.length; i++) {
            let corner = corners[i];
            let isArcRadius = isArcRadii[i];
            let radius = radii[i];
            let p = {x: pts[i * 2 + 2], y: pts[i * 2 + 3]};
            cy.add({
              data: {edge: edge.id()},
              classes: ['point'],
              position: p
            })

            if (isArcRadius) {
              cy.add({
                data: {diameter: 2 * corner.radius, edge: edge.id(), label: corner.radius === radius ? 'R' : 'limited'},
                classes: ['circle'],
                position: {x: corner.cx, y: corner.cy}
              })
            } else {
              let pp = {x: pts[i * 2], y: pts[i * 2 + 1]};
              let np = {x: pts[i * 2 + 4], y: pts[i * 2 + 5]};
              let r = Math.min(radius, dist(p, pp) / 2, dist(p, np) / 2)
              cy.add({
                data: {diameter: 2 * r, edge: edge.id(), label: r === radius ? 'R' : 'limited'},
                classes: ['circle'],
                position: p
              })
            }

          }
        })
      }
    })
  })

})();

dist = (p1, p2) => Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
