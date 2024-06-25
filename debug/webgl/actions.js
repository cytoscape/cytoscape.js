/* global $, cy, networks, params */

(function(){

  function reloadPage() {
    const networkID = $("#network-select").value;
    const webgl = $("#webgl-check").checked;

    const params = new URLSearchParams();
    params.set('networkID', networkID);
    params.set('webgl', webgl);

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

  $("#fit-button").addEventListener('click', () => cy.fit());
  $("#network-select").addEventListener('change', () => reloadPage());
  $("#webgl-check").addEventListener('click', () => reloadPage());
  
})();
