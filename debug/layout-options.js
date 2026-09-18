/* eslint-disable no-unused-vars */

// Round 125.11: every layout's options on the page.  The first sitting
// pass of the layout audit asked for it — flow's direction first, then
// the rest, each shown only when a compatible layout is selected — so a
// sitting can try an option without the console.
//
// The table below is the page's knowledge of the option surface, and
// `test/modules/layout-options-panel.mjs` holds it to the declaration:
// every member of a layout's option interface in src/public-types.mts
// is either here, owned by one of the panel's existing controls
// (`OWNED`), or excluded with a reason (`EXCLUDED`); nothing here is
// unknown to the interface.  A default written here is checked against
// the library's resolved default where a layout exposes one.
//
// Values are read as the library reads them: a 'number' input sends a
// number, a 'boolean' a boolean, a 'select' its string, a 'json' field
// whatever JSON.parse gives (so `1`, `{"data":"cluster"}` and
// `["R-HSA-168256"]` all work), and an empty field sends nothing — the
// run then takes the library's default, so a row at defaults is the
// library's defaults, not the page's.

var layoutOptionsPanel = (function () {
  var TAU = 2 * Math.PI;

  // -- the option specs ------------------------------------------------

  /** the plumbing every layout takes (LayoutBaseOptions) */
  var SHARED = [
    {
      key: 'fit',
      type: 'boolean',
      def: true,
      note: 'fit the viewport after the run',
    },
    { key: 'padding', type: 'number', def: 30, note: 'px, on fit' },
    {
      key: 'boundingBox',
      type: 'json',
      note: '{"x1":0,"y1":0,"w":800,"h":600}',
    },
    {
      key: 'animationDuration',
      type: 'number',
      def: 500,
      note: 'ms, under Animate',
    },
    { key: 'animationEasing', type: 'text', note: 'e.g. ease-in-out-cubic' },
    { key: 'zoom', type: 'number', note: 'with fit off' },
    { key: 'pan', type: 'json', note: '{"x":0,"y":0}, with fit off' },
  ];

  /** the packing options the discrete layouts share (123) */
  var PACKING = [
    {
      key: 'componentSpacing',
      type: 'number',
      def: 40,
      note: 'px between packed components',
    },
    {
      key: 'groupSpacing',
      type: 'number',
      note: 'px between component groups',
    },
  ];

  var DIRECTIONS = ['downward', 'upward', 'leftward', 'rightward'];

  var avoidOverlap = function (def) {
    return { key: 'avoidOverlap', type: 'boolean', def: def };
  };
  var avoidOverlapPadding = function (def) {
    return {
      key: 'avoidOverlapPadding',
      type: 'number',
      def: def,
      note: 'px kept between boxes',
    };
  };
  var startAngle = {
    key: 'startAngle',
    type: 'number',
    def: (3 / 2) * Math.PI,
    note: 'radians; 4.712 is the top',
  };
  var clockwise = { key: 'clockwise', type: 'boolean', def: true };
  var sort = {
    key: 'sort',
    type: 'json',
    note: '{"data":"cluster"} or {"data":"score","order":"desc"}',
  };
  var roots = { key: 'roots', type: 'json', note: '["id", …]; empty infers' };

  var SPECS = {
    grid: [
      avoidOverlap(true),
      avoidOverlapPadding(10),
      {
        key: 'condense',
        type: 'boolean',
        def: false,
        note: 'size by the nodes, not the box',
      },
      { key: 'rows', type: 'number' },
      { key: 'cols', type: 'number' },
      sort,
    ].concat(PACKING),
    circle: [
      avoidOverlap(true),
      avoidOverlapPadding(10),
      {
        key: 'condense',
        type: 'boolean',
        def: false,
        note: 'the ring by its nodes, not the box (125.5)',
      },
      { key: 'radius', type: 'number' },
      startAngle,
      { key: 'sweep', type: 'number', note: 'radians; empty is a full circle' },
      clockwise,
      sort,
    ].concat(PACKING),
    concentric: [
      startAngle,
      { key: 'sweep', type: 'number', note: 'radians' },
      clockwise,
      {
        key: 'equidistant',
        type: 'boolean',
        def: false,
        note: 'every ring the largest step apart',
      },
      {
        key: 'minNodeSpacing',
        type: 'number',
        def: 10,
        note: 'px between boxes on and across rings',
      },
      avoidOverlap(true),
      {
        key: 'height',
        type: 'number',
        note: 'of the box, with avoidOverlap off',
      },
      {
        key: 'width',
        type: 'number',
        note: 'of the box, with avoidOverlap off',
      },
      {
        key: 'concentric',
        type: 'json',
        note: '{"data":"score"}; empty is degree',
      },
    ].concat(PACKING),
    breadthfirst: [
      { key: 'directed', type: 'boolean', def: false },
      { key: 'direction', type: 'select', def: 'downward', values: DIRECTIONS },
      {
        key: 'circle',
        type: 'boolean',
        def: false,
        note: 'rings instead of rows',
      },
      {
        key: 'grid',
        type: 'boolean',
        def: false,
        note: 'v3: fill the rows evenly',
      },
      avoidOverlap(true),
      avoidOverlapPadding(0),
      roots,
      { key: 'depthSort', type: 'json', note: '{"data":"name"}' },
      {
        key: 'maximal',
        type: 'boolean',
        def: false,
        note: 'DAGs: nodes at their maximal depth',
      },
      { key: 'acyclic', type: 'boolean', def: false },
    ].concat(PACKING),
    radial: [
      roots,
      startAngle,
      {
        key: 'sweep',
        type: 'number',
        def: TAU,
        note: 'radians the trees share',
      },
      clockwise,
      {
        key: 'levelSpacing',
        type: 'number',
        note: 'px per ring; a floor under avoidOverlap',
      },
      avoidOverlap(true),
      avoidOverlapPadding(10),
      {
        key: 'condense',
        type: 'boolean',
        def: false,
        note: 'the rings by their nodes, not the box (125.3)',
      },
      {
        key: 'weight',
        type: 'select',
        def: 'leaves',
        values: ['leaves', 'subtree'],
      },
    ].concat(PACKING),
    flow: [
      { key: 'direction', type: 'select', def: 'downward', values: DIRECTIONS },
      {
        key: 'nodeSep',
        type: 'number',
        def: 50,
        note: 'px between boxes in a rank',
      },
      { key: 'rankSep', type: 'number', def: 60, note: 'px between ranks' },
      {
        key: 'edgeSep',
        type: 'number',
        def: 10,
        note: 'px per taxi track a gap grows',
      },
      {
        key: 'layering',
        type: 'select',
        def: 'network-simplex',
        values: ['network-simplex', 'longest-path', 'auto'],
      },
      {
        key: 'thoroughness',
        type: 'number',
        def: 7,
        note: '1..10, crossing minimisation',
      },
      {
        key: 'minLength',
        type: 'json',
        def: 1,
        note: 'ranks an edge spans: 1, or {"data":"w"}',
      },
      {
        key: 'edgeWeight',
        type: 'json',
        def: 1,
        note: 'straightening weight: 1, or {"data":"w"}',
      },
      {
        key: 'acyclic',
        type: 'boolean',
        def: false,
        note: 'skip cycle removal',
      },
      {
        key: 'cycleRemoval',
        type: 'select',
        def: 'greedy',
        values: ['greedy', 'dfs'],
      },
      {
        key: 'rankConstraints',
        type: 'json',
        note: '{"min":["a"],"max":["z"],"same":[["b","c"]]}',
      },
      { key: 'componentSpacing', type: 'number', def: 40 },
      avoidOverlap(true),
      avoidOverlapPadding(0),
    ],
    force: [
      { key: 'edgeLength', type: 'json', note: 'px, or {"data":"weight"}' },
      { key: 'repulsion', type: 'number' },
      { key: 'stiffness', type: 'number' },
      { key: 'gravity', type: 'number' },
      { key: 'decay', type: 'number' },
      { key: 'iterations', type: 'number' },
      { key: 'threshold', type: 'number', note: 'the settle test, model px' },
      {
        key: 'randomize',
        type: 'boolean',
        note: 'fresh scatter (on) or relax the current positions',
      },
      { key: 'stepsPerFrame', type: 'number', note: 'under Live' },
      {
        key: 'executor',
        type: 'select',
        values: ['auto', 'cpu', 'gpu', 'workers'],
        note: 'where the sim runs (129.3): the GPU integrator, the worker, in-thread',
      },
      avoidOverlapPadding(10),
      { key: 'componentSpacing', type: 'number' },
      { key: 'init', type: 'select', values: ['spectral', 'scatter'] },
      { key: 'nestingFactor', type: 'number' },
      { key: 'gravityCompound', type: 'number' },
      {
        key: 'alignment',
        type: 'json',
        note: '{"horizontal":[["a","b"]],"vertical":[]}',
      },
      {
        key: 'relativePlacement',
        type: 'json',
        note: '[{"left":"a","right":"b","gap":50}]',
      },
    ],
    preset: [],
    random: [],
    pack: PACKING.slice(),
    spiral: [],
  };

  // the combo entry is force with a grouping and an order (121.1)
  SPECS['force-by-sign'] = SPECS.force;

  /**
   * Option keys the panel's existing controls own — spelled by the
   * checkboxes, the selects and the seed box (layout-config.js) — so
   * the generated panel leaves them out rather than offering two ways
   * to say one thing.
   */
  var OWNED = {
    animate: 'the Animate box',
    animateLive: 'the Live box',
    infinite: 'the Infinite box',
    seed: 'the Seed box (force, and random since 125.8)',
    avoidOverlap: 'the Avoid overlap box (force: the overlap-by select)',
    nodeDimensionsIncludeLabels: 'the "… including labels" box',
    packComponents: 'the Pack components box',
    tidyComponents: 'the Tidy small components box',
    spacingFactor: 'the Spacing slider',
    positions: 'Preset restores the load snapshot',
    componentGroup: 'the EM combo entry (force-by-sign)',
    componentOrder: 'the EM combo entry (force-by-sign)',
  };

  /** option keys no field can spell, with the reason */
  var EXCLUDED = {
    name: 'the select',
    eles: 'the scope; cy.layout is the whole graph',
    transform: 'a function of a node and its position',
    animateFilter: 'a function of a node',
    ready: 'a callback',
    stop: 'a callback',
    position: 'grid: a function of a node handle returning { row, col }',
    levelWidth: 'concentric: a function of the node set',
    counterclockwise: 'the v3 alias of clockwise',
    impl: 'the extension contract: the class itself',
  };

  // force's avoidOverlap is the overlap-by select, not a boolean field;
  // it is OWNED above, so the force list carries only the padding

  /** the specs for a layout: the layout's own, then the shared plumbing */
  function specsFor(name) {
    var own = SPECS[name] || [];

    return own.concat(SHARED);
  }

  // -- reading values ---------------------------------------------------

  /**
   * The value a field's raw text spells for its spec, or undefined for
   * an empty field (the library's default).  A json field that does not
   * parse throws, naming the option.
   */
  function parse(spec, raw) {
    if (raw == null) {
      return undefined;
    }

    if (spec.type === 'boolean') {
      return raw === true || raw === 'true';
    }

    var text = String(raw).trim();

    if (text === '') {
      return undefined;
    }

    if (spec.type === 'number') {
      var n = Number(text);

      if (!Number.isFinite(n)) {
        throw new TypeError(spec.key + ': not a number: ' + text);
      }

      return n;
    }

    if (spec.type === 'json') {
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new TypeError(spec.key + ': not JSON: ' + text);
      }
    }

    return text;
  }

  /** whether a parsed value is the spec's default (so it need not be sent) */
  function isDefault(spec, value) {
    if (value === undefined) {
      return true;
    }

    if (spec.def === undefined) {
      return false;
    }

    return JSON.stringify(value) === JSON.stringify(spec.def);
  }

  /**
   * The options a set of raw field values spells for a layout: only
   * the keys whose value differs from the spec's default, parsed.
   *
   * @param name the layout select's value
   * @param raw { key: rawValue } as the fields hold them
   */
  function read(name, raw) {
    var out = {};

    specsFor(name).forEach(function (spec) {
      var value = parse(spec, raw[spec.key]);

      if (!isDefault(spec, value)) {
        out[spec.key] = value;
      }
    });

    return out;
  }

  /** the `cy.layout({...})` call an options object spells, for the readout */
  function describe(options) {
    var copy = {};

    Object.keys(options).forEach(function (k) {
      var v = options[k];

      copy[k] = typeof v === 'function' ? '[function]' : v;
    });

    return (
      'cy.layout(' +
      JSON.stringify(copy, null, 1).replace(/\n\s*/g, ' ') +
      ').run()'
    );
  }

  // -- the DOM ----------------------------------------------------------

  /**
   * Build the panel's fields for a layout into `container`, one row per
   * spec, and return a reader over them.  Browser only.
   *
   * @param container the panel element
   * @param name the layout select's value
   * @param onChange called after any field changes
   */
  function render(container, name, onChange) {
    container.textContent = '';

    var fields = {};
    var specs = specsFor(name);

    if (specs.length === 0) {
      var none = document.createElement('small');

      none.textContent = 'no options beyond the boxes above';
      container.appendChild(none);
    }

    specs.forEach(function (spec) {
      var row = document.createElement('div');
      var label = document.createElement('label');
      var input;

      row.className = 'layout-option';
      label.textContent = spec.key + ' ';

      if (spec.type === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = spec.def === true;
        input.indeterminate = spec.def === undefined;
      } else if (spec.type === 'select') {
        input = document.createElement('select');

        var blank = document.createElement('option');

        blank.value = '';
        blank.textContent = spec.def === undefined ? '(default)' : '';
        input.appendChild(blank);
        spec.values.forEach(function (v) {
          var opt = document.createElement('option');

          opt.value = v;
          opt.textContent = v;
          input.appendChild(opt);
        });
        input.value = spec.def === undefined ? '' : spec.def;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.size = spec.type === 'json' ? 28 : 8;
        input.value = spec.def === undefined ? '' : String(spec.def);
        input.placeholder = spec.def === undefined ? '(default)' : '';
      }

      input.dataset.key = spec.key;
      input.title = spec.note || '';
      fields[spec.key] = { spec: spec, input: input };
      label.appendChild(input);
      row.appendChild(label);

      if (spec.note) {
        var note = document.createElement('small');

        note.textContent = ' ' + spec.note;
        row.appendChild(note);
      }

      container.appendChild(row);
      input.addEventListener(
        input.type === 'checkbox' || input.tagName === 'SELECT'
          ? 'change'
          : 'input',
        function () {
          if (input.type === 'checkbox') {
            input.indeterminate = false;
          }

          onChange();
        },
      );
    });

    return {
      /** the raw values as the fields hold them */
      raw: function () {
        var out = {};

        Object.keys(fields).forEach(function (k) {
          var input = fields[k].input;

          if (input.type === 'checkbox') {
            out[k] = input.indeterminate ? undefined : input.checked;
          } else {
            out[k] = input.value;
          }
        });

        return out;
      },
      /** the options the fields spell (read()) */
      read: function () {
        return read(name, this.raw());
      },
    };
  }

  return {
    SPECS: SPECS,
    SHARED: SHARED,
    PACKING: PACKING,
    OWNED: OWNED,
    EXCLUDED: EXCLUDED,
    specsFor: specsFor,
    parse: parse,
    isDefault: isDefault,
    read: read,
    describe: describe,
    render: render,
  };
})();

// see debug/fixtures.js — the module suite loads this as a script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = layoutOptionsPanel;
}
