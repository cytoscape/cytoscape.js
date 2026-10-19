import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { createCollapsedAnimation } from '../src/collection/hierarchy.mjs';
import { NO_PARENT } from '../src/public-types.mjs';

const graph = () =>
  cytoscape({
    elements: [
      { data: { id: 'parent' } },
      { data: { id: 'child', parent: 'parent' } },
      { data: { id: 'leaf' } },
    ],
  });

const expectExactError = (call, message) => {
  let thrown;

  try {
    call();
  } catch (error) {
    thrown = error;
  }

  expect(thrown, `expected an error with message: ${message}`).to.be.instanceOf(
    Error,
  );
  expect(thrown.message).to.equal(message);
};

const columnar = (nodes) => ({ columnar: true, nodes });

describe('runtime graph guard errors', function () {
  it('attributes collapsed animation target and option conflicts precisely', function () {
    const cy = graph();
    const parent = cy.$id('parent');

    // The collection entry point selects this helper only when a target
    // exists; exercise the helper's own missing-target invariant directly.
    expectExactError(
      () => createCollapsedAnimation(parent, { duration: 1 }),
      'A collapsed animation requires a collapsed target',
    );

    // A normal animation target reaches the distinct conflict guard.
    expectExactError(
      () => parent.animation({ collapsed: true, position: { x: 1, y: 2 } }),
      'The collapsed target cannot be combined with other animation targets',
    );

    expect(parent.animation({ collapsed: true, duration: 1 })).to.be.an(
      'object',
    );
    cy.destroy();
  });

  it('checks serialized collapse state against a real parent relation', function () {
    expectExactError(
      () =>
        cytoscape({
          elements: columnar({
            count: 1,
            ids: ['leaf'],
            collapsed: new Uint8Array([1]),
          }),
        }),
      'Serialized collapsed node 0 is not a compound parent',
    );

    const cy = cytoscape({
      elements: columnar({
        count: 2,
        ids: ['parent', 'child'],
        parent: new Uint32Array([NO_PARENT, 0]),
        collapsed: new Uint8Array([1, 0]),
        appliedCollapseScale: new Float64Array([0, 1]),
      }),
    });

    expect(cy.$id('parent').collapsed()).to.equal(true);
    cy.destroy();
  });

  it('rejects a short parent column on public columnar add', function () {
    const cy = cytoscape();

    try {
      expectExactError(
        () =>
          cy.add(
            columnar({
              count: 2,
              ids: ['parent', 'child'],
              parent: new Uint32Array([NO_PARENT]),
            }),
          ),
        'Columnar node parent column must hold 2 entries; got 1',
      );
    } finally {
      cy.destroy();
    }

    const valid = cytoscape();

    valid.add(
      columnar({
        count: 2,
        ids: ['parent', 'child'],
        parent: new Uint32Array([NO_PARENT, 0]),
      }),
    );
    expect(valid.$id('child').data('parent')).to.equal('parent');
    valid.destroy();
  });

  it('validates custom layout implementation presence at cy.layout()', function () {
    const cy = graph();

    expectExactError(
      () => cy.layout({ impl: 1 }),
      'A custom layout needs an impl class or object',
    );
    expect(cy.layout({ impl: { run() {} } })).to.be.an('object');
    cy.destroy();
  });

  it('distinguishes definition-form miniature state type and scale guards', function () {
    const cy = graph();

    try {
      expectExactError(
        () => cy.patch([{ data: { id: 'leaf' }, collapsed: 'yes' }]),
        'Node 0 collapsed state must be a boolean',
      );
      expectExactError(
        () =>
          cy.patch([
            {
              data: { id: 'leaf' },
              collapsed: false,
              appliedCollapseScale: 0.5,
            },
          ]),
        'Node 0 has an applied collapse scale but is not collapsed',
      );
    } finally {
      cy.destroy();
    }
  });

  it('distinguishes columnar miniature value, scale, and expansion guards', function () {
    const cy = graph();
    const patchWithState = (collapsed, appliedCollapseScale) =>
      cy.patch(
        columnar({
          count: 1,
          ids: ['leaf'],
          collapsed: new Uint8Array([collapsed]),
          appliedCollapseScale: new Float64Array([appliedCollapseScale]),
        }),
      );

    try {
      expectExactError(
        () => patchWithState(2, 1),
        'Columnar node collapsed value at 0 must be 0 or 1',
      );
      expectExactError(
        () => patchWithState(1, 2),
        'Invalid applied collapse scale at node 0 (expected 0 for configured scale, or 0 < scale <= 1)',
      );
      expectExactError(
        () => patchWithState(0, 0),
        'Expanded node 0 must have applied collapse scale 1',
      );
    } finally {
      cy.destroy();
    }
  });

  it('does not allow a patch to collapse a leaf node', function () {
    const cy = graph();

    try {
      expectExactError(
        () =>
          cy.patch([
            {
              data: { id: 'leaf' },
              collapsed: true,
              appliedCollapseScale: 0.5,
            },
          ]),
        "Node 'leaf' can only be collapsed when it is a compound parent",
      );
    } finally {
      cy.destroy();
    }
  });
});
