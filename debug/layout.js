/* global $, cy, cy2 */

(function(){

	$("#layout-button").addEventListener("click", function(){
		cy.layout({
			name: $("#layout-select").value
		}).run();
	});

	var start, end;
	cy.bind("layoutstart", function(){
		start = +new Date;
	}).bind("layoutstop", function(){
		end = +new Date;
		var time = end - start;

		if( !isNaN(time) ){
			$("#layout-time").innerHTML = ( (time) + " ms" );
		}
	});

})
// === START: Layout buttons wiring ===
(function () {
  var status = document.getElementById('layout-status');

  function runLayout(name, options) {
    try {
      status.textContent = 'Running ' + name + '...';
      var opts = Object.assign({}, options || {});
      var layout = cy.layout(Object.assign({ name: name }, opts));
      layout.run();

      setTimeout(function () {
        status.textContent = 'Last: ' + name;
      }, 600);
    } catch (err) {
      status.textContent = 'Error: ' + (err.message || err);
      console.error('Layout run error:', err);
    }
  }

  var btnCose = document.getElementById('layout-cose');
  var btnGrid = document.getElementById('layout-grid');
  var btnBreadth = document.getElementById('layout-breadth');

  if (btnCose && btnGrid && btnBreadth) {
    btnCose.addEventListener('click', function () {
      runLayout('cose', { animate: true, fit: true });
    });

    btnGrid.addEventListener('click', function () {
      runLayout('grid', { rows: 4, fit: true });
    });

    btnBreadth.addEventListener('click', function () {
      runLayout('breadthfirst', { directed: false, spacingFactor: 1.2, fit: true });
    });
  } else {
    console.warn('Layout control buttons not found in DOM.');
  }
})();
// === END: Layout buttons wiring ===
();
