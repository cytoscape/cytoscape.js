import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import {
  collectManualCoverage,
  manifestMatches,
  validateRestoreLimitation,
} from '../../scripts/demo-coverage.mjs';
import { goldenNames } from '../../scripts/golden-coverage.mjs';
import { goldenTitles } from '../../scripts/status/goldens-page.mjs';
import featureScenes from '../../debug/feature-scenes.js';

describe('manual demo coverage ledger', function () {
  let report;
  let manifest;

  before(async () => {
    report = await collectManualCoverage();
    manifest = JSON.parse(
      readFileSync(new URL('../../docs/demo-coverage.json', import.meta.url)),
    );
  });

  it('covers readable properties and accounts for every recursive keyword', () => {
    expect(report.counts.properties).to.equal(220);
    expect(report.counts.keywords).to.equal(326);
    expect(report.counts.propertiesCovered).to.equal(220);
    expect(report.counts.keywordsCovered).to.equal(325);
    expect(report.counts.keywordSemanticExceptions).to.equal(1);
    expect(report.counts.keywordsAccounted).to.equal(326);
    expect(report.counts.restorationLimitations).to.equal(1);
    expect(report.restorationLimitations[0]).to.include({
      golden: 'feature-labels-nodes',
      group: 'nodes',
      property: 'font-style',
      target: 'label-left',
      value: 'normal',
      alternate: 'italic',
      observedResiduePixels: 178,
    });
    expect(report.restorationLimitations[0].moved).to.be.greaterThan(0);
    expect(report.restorationLimitations[0].residuePixels).to.be.at.most(256);
    expect(report.restorationLimitations[0].kind).to.be.oneOf([
      'exact restore in current capture',
      'measured font atlas restore residue',
    ]);
    expect(report.properties.filter((row) => row.manual == null)).to.deep.equal(
      [],
    );
    expect(
      report.keywords.filter(
        (row) => row.manual == null && row.semanticException == null,
      ),
    ).to.deep.equal([]);

    const unsupported = report.keywords.find(
      (row) =>
        row.group === 'nodes' &&
        row.property === 'text-rotation' &&
        row.keyword === 'autorotate',
    );
    expect(unsupported.manual).to.equal(null);
    expect(unsupported.semanticException).to.include({
      kind: 'unsupported group-value exception',
      keyword: 'autorotate',
      property: 'text-rotation',
      group: 'nodes',
    });
    expect(unsupported.semanticException.sourceRefs).to.include(
      'src/style/apply-prop.mts:832-840',
    );
    expect(unsupported.semanticException.rejectionTest).to.include(
      'test/modules/feature-scenes.test.mjs',
    );
    expect(unsupported.semanticException.validRoutes).to.have.length(2);
    expect(report.counts.keywordKinds).to.have.property(
      'unsupported group-value exception',
      1,
    );
    expect(report.counts.keywordKinds).not.to.have.property('missing');
  });

  it('keeps intentional readbacks separate from default-only observations', () => {
    for (const row of [...report.properties, ...report.keywords]) {
      if (row.manual != null) {
        expect(row.manual.route, `${row.group}/${row.property}`)
          .to.be.a('string')
          .and.not.equal('');
        expect(row.manual.kind, `${row.group}/${row.property}`).not.to.equal(
          'incidental default readback',
        );
        if (
          row.manual.kind?.includes('workflow') ||
          row.manual.kind === 'behavioral keyword evidence'
        ) {
          expect(row.manual.widget).to.be.a('string').and.not.equal('');
          expect(row.manual.behaviorSpec).to.be.a('string').and.not.equal('');
        }
        if (row.manual.kind === 'behavioral exception') {
          expect(row.manual.reason).to.be.a('string').and.not.equal('');
        }
      }
    }

    expect(
      report.properties.every((row) => row.defaultReadback == null),
    ).to.equal(false);
    expect(
      report.classifications.inertGroupProperties.nodes.length +
        report.classifications.inertGroupProperties.edges.length,
    ).to.equal(47);
    expect(report.classifications.keywordAliases).to.have.property('shape');
    expect(report.classifications.noStaticPixelProperties).to.have.property(
      'events',
    );
  });

  it('lists unique runnable URLs and explicit automated-only routes', () => {
    expect(new Set(report.runnableRoutes).size).to.equal(
      report.runnableRoutes.length,
    );
    expect(report.runnableRoutes).not.to.include('');
    expect(
      report.sourceRoutes
        .filter((row) => row.route == null)
        .every((row) => row.manualRouteReason != null && row.evidence != null),
    ).to.equal(true);
  });

  it('matches the checked-in ledger and detects a stale entry (control)', () => {
    expect(manifestMatches(report, manifest)).to.equal(true);

    const sabotaged = structuredClone(manifest);
    const row = sabotaged.properties.find((entry) => entry.manual != null);
    row.manual.value = '__stale_manifest_value__';

    expect(manifestMatches(report, sabotaged)).to.equal(false);
  });

  it('links every listed golden back to a checked-in PNG', () => {
    const names = new Set(goldenNames());

    for (const row of [...report.properties, ...report.keywords]) {
      for (const evidence of row.goldens) {
        expect(names.has(evidence.golden), evidence.golden).to.equal(true);
      }
    }
  });

  it('accepts only the measured font-style restore residue', () => {
    const limitation = {
      group: 'nodes',
      property: 'font-style',
      target: 'label-left',
      value: 'normal',
      alternate: 'italic',
      observedResiduePixels: 178,
      route: '?network=features&scene=labels&view=nodes',
      sourceRefs: [
        'debug/fonts/*.woff2 (four pinned Open Sans faces loaded and fonts.ready)',
      ],
      reason:
        'A controlled font-style normal→italic probe moved 17390 pixels and restored readback normal, but the settled image retained 178 differing pixels after all four pinned faces loaded; mechanism is unlocalized.',
    };
    const capture = {
      golden: 'feature-labels-nodes',
      featureCoverage: {
        keywords: [
          {
            group: 'nodes',
            property: 'font-style',
            target: 'label-left',
            value: 'normal',
            alternate: 'italic',
          },
        ],
      },
    };
    const degrade = {
      keywords: [
        {
          group: 'nodes',
          property: 'font-style',
          target: 'label-left',
          value: 'normal',
          alternate: 'italic',
          matched: 1,
          changed: 1,
          moved: 17390,
          restoreMoved: 178,
          residue: 178,
        },
      ],
    };

    expect(validateRestoreLimitation(limitation, capture, degrade)).to.include({
      golden: 'feature-labels-nodes',
      moved: 17390,
      observedResiduePixels: 178,
      residuePixels: 178,
      kind: 'measured font atlas restore residue',
    });

    const exactRestore = validateRestoreLimitation(limitation, capture, {
      ...degrade,
      keywords: [
        { ...degrade.keywords[0], restoreMoved: 0, residue: undefined },
      ],
    });
    expect(exactRestore).to.include({
      residuePixels: 0,
      kind: 'exact restore in current capture',
    });

    const rejected = [
      { ...degrade, keywords: [{ ...degrade.keywords[0], moved: 0 }] },
      { ...degrade, keywords: [{ ...degrade.keywords[0], residue: 177 }] },
      { ...degrade, keywords: [{ ...degrade.keywords[0], restoreMoved: 257 }] },
      {
        ...degrade,
        keywords: [{ ...degrade.keywords[0], lost: ['label-left'] }],
      },
      { ...degrade, stopped: 'nodes/font-style: restore lost one value' },
    ];
    for (const invalid of rejected) {
      expect(() =>
        validateRestoreLimitation(limitation, capture, invalid),
      ).to.throw('font-style restore limitation control');
    }

    expect(() =>
      validateRestoreLimitation(
        { ...limitation, target: 'label-center' },
        capture,
        degrade,
      ),
    ).to.throw('unsupported restore limitation target');
  });

  it('keeps parameterized golden titles in sync with canonical cases', () => {
    const spec = readFileSync(
      new URL('../../playwright-tests/visual.spec.js', import.meta.url),
      'utf8',
    );
    const titles = goldenTitles(spec, featureScenes.goldenCases);

    for (const sceneCase of featureScenes.goldenCases) {
      if (sceneCase.goldenOmissionReason) {
        expect(titles.has(sceneCase.name), sceneCase.name).to.equal(false);
      } else {
        expect(titles.get(sceneCase.name), sceneCase.name).to.equal(
          `golden: feature ${sceneCase.familyId} / ${sceneCase.stateId ?? sceneCase.viewId}`,
        );
      }
    }

    const casesWithParams = featureScenes.goldenCases.filter(
      (sceneCase) => Object.keys(sceneCase.params).length > 0,
    );
    expect(casesWithParams.length).to.be.greaterThan(0);
    for (const sceneCase of casesWithParams) {
      const route = report.sourceRoutes.find(
        (row) => row.id === sceneCase.name,
      );
      expect(route?.route, sceneCase.name).to.include(
        `${Object.keys(sceneCase.params)[0]}=`,
      );
    }
  });
});
