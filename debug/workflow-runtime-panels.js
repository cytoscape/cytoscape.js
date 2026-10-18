/* featureWorkflowRuntimePanels workflow panels for the debug network. */
(function (root) {
  'use strict';

  const {
    clear,
    node,
    button,
    select,
    field,
    output,
    panel,
    param,
    numericParam,
    saveParams,
    table,
    ids,
    copy,
  } = root.featureWorkflowUI;

  function mountExport({ cy, container, params }) {
    const document = panel(
      container,
      'Image export',
      'Export the rendered graph through png() or jpg(). Preview and download use the returned image bytes; scale, viewport/full bounds, and background are the API options exercised here.',
    );
    const format = select(
      document,
      [
        ['png', 'PNG'],
        ['jpg', 'JPEG'],
      ],
      param(params, 'workflowExportFormat', 'png', ['png', 'jpg']),
    );
    const scale = node(document, 'input', {
      type: 'number',
      min: 0.25,
      max: 4,
      step: 0.25,
      value: numericParam(params, 'workflowExportScale', 1, 0.25, 4),
    });
    const background = node(document, 'input', {
      type: 'color',
      value: param(params, 'workflowExportBackground', '#ffffff'),
    });
    const full = node(document, 'input', {
      type: 'checkbox',
      checked: param(params, 'workflowExportFull', 'false') === 'true',
    });
    const status = output(document, 'Ready.');
    const preview = node(document, 'img', {
      alt: 'Export preview',
      hidden: true,
      className: 'feature-workflow-preview',
    });
    const download = node(document, 'a', {
      text: 'Download image',
      hidden: true,
      download: 'cytoscape-workflow.png',
    });
    let objectUrl = null;
    let disposed = false;
    let exportGeneration = 0;
    let previewWait = null;
    let exportButton = null;
    const saveExportInputs = () =>
      saveParams({
        workflowExportFormat: format.value,
        workflowExportScale: scale.value,
        workflowExportBackground: background.value,
        workflowExportFull: full.checked,
      });
    const clearPreviewWait = (cancel = false) => {
      if (previewWait == null) return;
      const waiting = previewWait;
      previewWait = null;
      preview.removeEventListener('load', waiting.onLoad);
      preview.removeEventListener('error', waiting.onError);
      if (cancel) waiting.cancel();
    };

    const exportImage = async () => {
      if (disposed || exportButton.disabled) return;
      const generation = ++exportGeneration;
      exportButton.disabled = true;
      saveExportInputs();
      status.textContent = 'Rendering export…';
      download.hidden = true;

      try {
        const options = {
          output: 'blob',
          scale: Math.max(0.25, Number(scale.value) || 1),
          bg: background.value,
          full: full.checked,
        };
        const blob =
          format.value === 'jpg'
            ? await cy.jpg({ ...options, quality: 0.92 })
            : await cy.png(options);

        if (disposed) return;

        if (objectUrl != null) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        preview.hidden = false;
        download.href = objectUrl;
        download.download = `cytoscape-workflow.${format.value === 'jpg' ? 'jpg' : 'png'}`;
        download.hidden = false;
        await new Promise((resolve, reject) => {
          const onLoad = () => {
            clearPreviewWait();
            resolve();
          };
          const onError = () => {
            clearPreviewWait();
            reject(
              new Error('The exported image preview could not be loaded.'),
            );
          };
          const cancel = () => resolve();

          previewWait = { onLoad, onError, cancel };
          preview.addEventListener('load', onLoad);
          preview.addEventListener('error', onError);
          preview.src = objectUrl;
        });
        if (!disposed && generation === exportGeneration)
          status.textContent = `${format.value.toUpperCase()} ${preview.naturalWidth} × ${preview.naturalHeight}; ${blob.size} bytes; full=${full.checked}; scale=${options.scale}.`;
      } catch (error) {
        if (!disposed && generation === exportGeneration)
          status.textContent = `Export error: ${error?.message || error}`;
      } finally {
        if (!disposed && generation === exportGeneration)
          exportButton.disabled = false;
      }
    };
    exportButton = button(document, 'Render preview', exportImage);

    format.addEventListener('change', saveExportInputs);
    scale.addEventListener('input', saveExportInputs);
    background.addEventListener('input', saveExportInputs);
    full.addEventListener('change', saveExportInputs);
    saveExportInputs();

    container.append(
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        field(document, 'Format', format),
        field(document, 'Scale', scale),
        field(document, 'Background', background),
        field(document, 'Full graph bounds', full),
        exportButton,
        download,
      ]),
      status,
      preview,
    );

    return () => {
      disposed = true;
      exportGeneration++;
      exportButton.disabled = true;
      clearPreviewWait(true);
      format.removeEventListener('change', saveExportInputs);
      scale.removeEventListener('input', saveExportInputs);
      background.removeEventListener('input', saveExportInputs);
      full.removeEventListener('change', saveExportInputs);
      if (objectUrl != null) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      preview.removeAttribute('src');
    };
  }

  function mountRuntime({ cy, container, params, setParams }) {
    const document = panel(
      container,
      'Renderer host and instance lifecycle',
      'The renderer host is chosen at construction. Worker rendering requires Worker, OffscreenCanvas, and WebGPU in a worker; the library reports a failure rather than switching hosts silently. The public stats do not identify the host implementation, so readiness and the requested route setting are reported separately.',
    );
    const host = select(
      document,
      [
        ['false', 'Main thread'],
        ['true', 'Worker renderer'],
      ],
      params?.rendererWorker || 'false',
    );
    const requested = host.value === 'true' ? 'worker' : 'main';
    const status = output(
      document,
      `Requested host: ${requested}; renderer ready: yes (cy.ready resolved). Actual host identity: not exposed by the public stats API.`,
    );
    const stats = output(document, 'Waiting for renderer statistics…');
    const containerElement = cy.container();
    let disposed = false;
    const updateStats = async () => {
      try {
        const counts = await cy.viewportCounts();
        const snapshot = cy.stats();

        if (disposed) return;
        stats.textContent =
          snapshot == null
            ? 'Renderer stats unavailable; the instance is headless or unmounted.'
            : `Renderer ready; counts ${counts ? `${counts.nodes} nodes / ${counts.edges} edges` : 'unavailable'}; frames=${snapshot.frames}; GPU allocations=${snapshot.gpu.liveBytes} bytes; scale=${snapshot.renderScale}. The public stats do not expose the internal host object.`;
      } catch (error) {
        if (!disposed)
          stats.textContent = `Renderer readiness/stats error: ${error?.message || error}`;
      }
    };
    const hostChange = () => {
      const value = host.value;

      status.textContent = `Reloading with renderer worker=${value}.`;
      if (typeof setParams === 'function') {
        setParams({ rendererWorker: value });
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set('rendererWorker', value);
        window.location.assign(url);
      }
    };
    const mountAgain = () => {
      try {
        if (cy.container() == null && containerElement != null) {
          cy.mount(containerElement);
          status.textContent = 'Mounted renderer again; awaiting cy.ready.';
          cy.ready.then(
            () => {
              if (!disposed)
                status.textContent =
                  'Renderer mounted and ready; host identity is not exposed by public stats.';
              updateStats();
            },
            (error) => {
              if (!disposed)
                status.textContent = `Mount failed: ${error?.message || error}`;
            },
          );
        } else if (cy.container() != null) {
          cy.unmount();
          status.textContent =
            'Renderer unmounted; model remains live. Click Mount renderer to attach again.';
        }
      } catch (error) {
        status.textContent = `Lifecycle error: ${error?.message || error}`;
      }
    };

    host.addEventListener('change', hostChange);
    container.append(
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        field(document, 'Renderer host (reloads the page)', host),
        button(document, 'Unmount / mount renderer', mountAgain),
        button(document, 'Refresh renderer stats', updateStats),
      ]),
      status,
      stats,
      node(document, 'p', {
        className: 'note',
        text: 'Automated recipes for headless runtimes, declarations, schemas, bundles, and benchmark claims live in the runtime/type/schema/package/benchmark suites. This panel reports renderer readiness and current public stats only.',
      }),
    );
    updateStats();

    return () => {
      disposed = true;
      host.removeEventListener('change', hostChange);
    };
  }

  const api = {
    mountExport,
    mountRuntime,
  };
  root.featureWorkflowRuntimePanels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
