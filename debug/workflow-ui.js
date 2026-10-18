/* Shared DOM and URL helpers for the debug workflow panels. */
(function (root) {
  'use strict';

  function clear(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function node(document, tag, props = {}, children = []) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
      if (key === 'text') {
        element.textContent = value;
      } else if (key === 'className') {
        element.className = value;
      } else if (key === 'htmlFor') {
        element.htmlFor = value;
      } else if (key === 'hidden') {
        element.hidden = value;
      } else if (key === 'value') {
        element.value = value;
      } else if (key === 'type') {
        element.type = value;
      } else if (key === 'disabled') {
        element.disabled = value;
      } else if (key.startsWith('aria-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    }

    for (const child of children) {
      element.append(child);
    }

    return element;
  }

  function button(document, label, handler, options = {}) {
    const control = node(document, 'button', {
      type: 'button',
      text: label,
      ...options,
    });

    control.addEventListener('click', handler);

    return control;
  }

  function select(document, values, initial) {
    const control = node(document, 'select');

    for (const item of values) {
      const entry = Array.isArray(item) ? item : [item, item];
      const option = node(document, 'option', {
        value: entry[0],
        text: entry[1],
      });

      control.append(option);
    }

    if (initial != null) {
      control.value = initial;
    }

    return control;
  }

  function field(document, labelText, control) {
    control.setAttribute('aria-label', labelText);

    return node(document, 'label', { className: 'feature-workflow-field' }, [
      node(document, 'span', { text: labelText }),
      control,
    ]);
  }

  function output(document, initial = 'Ready.') {
    return node(document, 'pre', {
      className: 'feature-workflow-output',
      text: initial,
      'aria-live': 'polite',
    });
  }

  function panel(container, title, description) {
    const document = container.ownerDocument;

    clear(container);
    container.hidden = false;
    container.append(
      node(document, 'h2', { text: title }),
      node(document, 'p', { className: 'note', text: description }),
    );

    return document;
  }

  function param(params, key, fallback, allowed) {
    const value = params?.get?.(key) ?? params?.[key];

    if (value == null || (allowed != null && !allowed.includes(value))) {
      return fallback;
    }

    return value;
  }

  function numericParam(params, key, fallback, min, max) {
    const value = Number(params?.get?.(key) ?? params?.[key]);

    return Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  }

  function saveParams(values) {
    const win = root.window;

    if (win?.history?.replaceState == null || win.location == null) return;

    const url = new URL(win.location.href);

    for (const [key, value] of Object.entries(values)) {
      if (value == null || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    }

    win.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  function table(document, rows) {
    const result = node(document, 'table', {
      className: 'feature-workflow-table',
    });
    const body = node(document, 'tbody');

    rows.forEach(([key, value]) => {
      body.append(
        node(document, 'tr', {}, [
          node(document, 'th', { scope: 'row', text: String(key) }),
          node(document, 'td', {
            text: typeof value === 'string' ? value : JSON.stringify(value),
          }),
        ]),
      );
    });

    result.append(body);

    return result;
  }

  function ids(eles) {
    return eles.map((ele) => ele.id());
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const api = {
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
  };
  root.featureWorkflowUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
