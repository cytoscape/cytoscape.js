/* global $, cy, networks, params */

(function(){

  function reloadPage(reset = false) {
    if(reset) {
      window.location.href = window.location.origin + window.location.pathname;
      return;
    }

    const networkID = $("#network-select").value;
    const webgl = $("#webgl-check").checked;
    const bgcolor = $("#bg-color-select").value;

    const params = new URLSearchParams();
    params.set('networkID', networkID);
    params.set('webgl', webgl);
    params.set('bgcolor', bgcolor);

    const href = window.location.origin + window.location.pathname + '?' + params.toString();
    window.location.href = href;
  }

  for(const [networkID, network] of Object.entries(networks)) {
    const option = document.createElement('option');
    option.value = networkID;
    option.innerHTML = `${network.desc} (${network.nodes} nodes, ${network.edges} edges)`;
    $("#network-select").appendChild(option);
  }

  $("#network-select").value = params.networkID;
  $("#webgl-check").checked = params.webgl;
  $("#bg-color-select").value = params.bgcolor;

  $("#fit-button").addEventListener('click', () => cy.fit());
  $("#reset-button").addEventListener('click', () => reloadPage(true));
  $("#network-select").addEventListener('change', () => reloadPage());
  $("#webgl-check").addEventListener('click', () => reloadPage());
  $("#bg-color-select").addEventListener('change', () => reloadPage());
  
})();
