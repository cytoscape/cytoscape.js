import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

const expectMessage = (run, message) => {
  let error;

  try {
    run();
  } catch (caught) {
    error = caught;
  }

  expect(error, message).to.be.instanceOf(Error);
  expect(error.message).to.equal(message);
};

const columnar = (nodes, edges) => ({
  columnar: true,
  nodes: { count: 1, ...nodes },
  edges: edges ?? {
    count: 0,
    sources: new Uint32Array(0),
    targets: new Uint32Array(0),
  },
});

describe('public wire and columnar guards', function () {
  it('validates miniature state while converting definitions', function () {
    const converted = cytoscape.toColumnarElements({
      nodes: [
        {
          data: { id: 'parent' },
          collapsed: true,
          appliedCollapseScale: 0.25,
        },
      ],
    });

    expect(Array.from(converted.nodes.collapsed)).to.deep.equal([1]);
    expect(Array.from(converted.nodes.appliedCollapseScale)).to.deep.equal([
      0.25,
    ]);

    expectMessage(
      () =>
        cytoscape.toColumnarElements({
          nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
          edges: [
            {
              data: { id: 'ab', source: 'a', target: 'b' },
              collapsed: true,
            },
          ],
        }),
      'Miniature state is supported on nodes only',
    );

    expectMessage(
      () =>
        cytoscape.toColumnarElements([{ data: { id: 'n' }, collapsed: 'yes' }]),
      'Node 0 collapsed state must be a boolean',
    );

    expectMessage(
      () =>
        cytoscape.toColumnarElements([
          {
            data: { id: 'n' },
            collapsed: false,
            appliedCollapseScale: 0.5,
          },
        ]),
      'Node 0 has an applied collapse scale but is not collapsed',
    );

    expectMessage(
      () =>
        cytoscape.toColumnarElements([
          {
            data: { id: 'n' },
            collapsed: true,
            appliedCollapseScale: 0,
          },
        ]),
      "Invalid applied collapse scale '0' (expected a representable value with 0 < scale <= 1)",
    );
  });

  it('validates miniature columns when serializing columnar payloads', function () {
    const good = columnar({
      parent: new Uint32Array([0xffffffff]),
      collapsed: new Uint8Array([1]),
      appliedCollapseScale: new Float64Array([0]),
    });
    const roundTrip = cytoscape.deserializeElements(
      cytoscape.serializeElements(good),
    );

    expect(roundTrip.nodes.collapsed[0]).to.equal(1);
    expect(roundTrip.nodes.appliedCollapseScale[0]).to.equal(0);

    expectMessage(
      () =>
        cytoscape.serializeElements(columnar({ parent: new Uint32Array(0) })),
      'Columnar node parent column must hold 1 entries',
    );

    expectMessage(
      () =>
        cytoscape.serializeElements(columnar({ collapsed: new Uint8Array(0) })),
      'Columnar node collapsed column must hold 1 entries',
    );

    expectMessage(
      () =>
        cytoscape.serializeElements(
          columnar({ appliedCollapseScale: new Float64Array(0) }),
        ),
      'Columnar node applied collapse scale column must hold 1 entries',
    );

    expectMessage(
      () =>
        cytoscape.serializeElements(
          columnar({ collapsed: new Uint8Array([2]) }),
        ),
      'Columnar node collapsed value at 0 must be 0 or 1',
    );

    expectMessage(
      () =>
        cytoscape.serializeElements(
          columnar({
            collapsed: new Uint8Array([1]),
            appliedCollapseScale: new Float64Array([1.5]),
          }),
        ),
      'Invalid applied collapse scale at node 0 (expected 0 for configured scale, or 0 < scale <= 1 when collapsed; expanded nodes use 1)',
    );
  });

  it('validates short numeric and dictionary data columns while serializing', function () {
    const good = columnar({
      data: {
        label: { dict: ['node'], indices: new Uint32Array([1]) },
        weight: new Float64Array([2.5]),
      },
    });
    const decoded = cytoscape.deserializeElements(
      cytoscape.serializeElements(good),
    );

    expect(Array.from(decoded.nodes.data.label.indices)).to.deep.equal([1]);
    expect(Array.from(decoded.nodes.data.weight)).to.deep.equal([2.5]);

    expectMessage(
      () =>
        cytoscape.serializeElements(
          columnar({
            data: {
              label: { dict: ['node'], indices: new Uint32Array(0) },
            },
          }),
        ),
      "Columnar data column 'label' must have 1 entries",
    );

    expectMessage(
      () =>
        cytoscape.serializeElements(
          columnar({ data: { weight: new Float64Array(0) } }),
        ),
      "Columnar data column 'weight' must have 1 entries",
    );
  });

  it('rejects corrupt serialized miniature state and accepts its valid control', function () {
    const buffer = cytoscape.serializeElements(
      columnar({
        collapsed: new Uint8Array([1]),
        appliedCollapseScale: new Float64Array([0.5]),
      }),
    );

    expect(
      Array.from(cytoscape.deserializeElements(buffer).nodes.collapsed),
    ).to.deep.equal([1]);

    // This fixture has only the miniature flag section: its u8 collapsed
    // column begins immediately after the 24-byte header.
    new DataView(buffer).setUint8(24, 2);

    expectMessage(
      () => cytoscape.deserializeElements(buffer),
      'Serialized node miniature state at 0 is corrupt',
    );
  });
});
