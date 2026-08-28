// `npm run gpu` — if/what GPU this box offers, answered at the level that
// matters: the WebGPU adapter a harness-flagged Chromium actually hands out.
//
// Why this exists: more than one session has looked at a SwiftShader adapter
// label, concluded "this environment has no GPU", and deferred hardware work
// on a box with a discrete card (round 93.2 was the second time).  The card
// being *present* (lspci) and the browser *reaching* it (adapter identity)
// are different facts, and only the second one licenses a benchmark number
// or justifies a deferral.  This script reports both, then prints a one-line
// verdict an agent can act on without interpreting driver names.
//
// Structure follows `machine-info.mjs`: the classifier and report renderer
// are pure and exported (spec'd in `test/modules/gpu-info.mjs`); the probes
// live behind the CLI, are time-boxed, and a failure is a reported fact, not
// a crash.  Exit 0 means the question was answered (either verdict); exit 1
// means the probe itself could not run, which is an environment problem to
// fix (usually `npm run test:playwright:install`), never proof of "no GPU".
import { describeMachine } from './machine-info.mjs';

/** Longest the whole browser probe may take before it is abandoned. */
const PROBE_TIMEOUT_MS = 30_000;

/** Adapter descriptions that mean a software rasterizer, not silicon. */
const SOFTWARE_RE = /swiftshader|software|llvmpipe|lavapipe|warp\b/i;

/**
 * Classify a WebGPU adapter as reported by `adapter.info`.
 *
 * Returns `'none'` (no adapter at all), `'software'` (a rasterizer on the
 * CPU — SwiftShader, llvmpipe, lavapipe, WARP, or a fallback adapter), or
 * `'hardware'` (real silicon; the only class that licenses GPU pricing).
 */
export function classifyAdapter(adapter) {
  if (adapter == null) {
    return 'none';
  }

  const label =
    `${adapter.vendor ?? ''} ${adapter.architecture ?? ''} ${adapter.description ?? ''}`.trim();

  if (adapter.isFallbackAdapter === true || SOFTWARE_RE.test(label)) {
    return 'software';
  }

  return 'hardware';
}

/**
 * Render the report `npm run gpu` prints.  Pure: takes the machine
 * inventory, the probed adapter (or `null`), a probe error (or `null`), and
 * whether `CI` is set (CI pins the Vulkan loader to SwiftShader for golden
 * determinism, so a CI adapter answer is by design not the hardware answer).
 */
export function renderGpuReport({ machine, adapter, probeError, ci }) {
  const lines = [];
  const inventory = (machine?.gpus ?? [])
    .map((g) => g.model)
    .filter((m) => m != null);

  lines.push(
    `system   ${inventory.length > 0 ? inventory.join(' + ') : 'no display adapter found (lspci/system probe)'}`,
  );

  if (probeError != null) {
    lines.push(`adapter  probe failed: ${probeError}`);
    lines.push(
      'verdict  UNKNOWN — the browser probe could not run; fix it (usually',
      '         `npm run test:playwright:install`) before concluding anything',
      '         about GPU availability.',
    );

    return { lines, verdict: 'unknown' };
  }

  const verdict = classifyAdapter(adapter);
  const label =
    adapter == null
      ? 'no WebGPU adapter'
      : `${adapter.vendor ?? '?'} · ${adapter.architecture || '?'} · ${adapter.description || '(no description)'}`;

  lines.push(`adapter  ${label}`);

  if (verdict === 'hardware') {
    lines.push(
      'verdict  HARDWARE — Chromium reaches a real GPU with the harness flags;',
      '         GPU benchmarks may be priced here.  (Goldens stay pinned to',
      '         SwiftShader; see playwright.config.js.)',
    );
  } else {
    lines.push(
      `verdict  SOFTWARE-ONLY — ${verdict === 'none' ? 'no adapter' : 'a CPU rasterizer'}; do not price GPU`,
      '         benchmarks here (`benchmark:renderer` and `:algorithms-gpu`',
      '         refuse this adapter by design).',
    );
  }

  if (ci) {
    lines.push(
      'note     CI pins the Vulkan loader to SwiftShader for golden',
      '         determinism — this answer describes CI, not the bare machine.',
    );
  }

  return { lines, verdict };
}

// -- CLI --
//
// The probe launches Chromium exactly as the Playwright harness does on this
// platform (same WebGPU/Vulkan flags), asks for the default adapter, and
// reports its identity.  That duplication of the flag list is deliberate and
// pinned: `test/modules/gpu-info.mjs` asserts these flags stay a subset of
// what `playwright.config.js` passes, so the probe cannot drift into
// answering for a browser nobody runs.
export const PROBE_ARGS = [
  '--enable-unsafe-webgpu',
  '--enable-unsafe-swiftshader',
  ...(process.platform === 'linux'
    ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan']
    : []),
];

async function probeAdapter() {
  const { chromium } = await import('@playwright/test');
  // navigator.gpu is unavailable on about:blank (see playwright.config.js),
  // so the probe serves one empty page over loopback http.
  const { createServer } = await import('node:http');
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>gpu probe</title>');
  });

  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

  const browser = await chromium.launch({
    channel: 'chromium',
    args: PROBE_ARGS,
    timeout: PROBE_TIMEOUT_MS,
  });

  try {
    const page = await browser.newPage();

    await page.goto(`http://127.0.0.1:${server.address().port}/`);

    return await page.evaluate(async () => {
      const a = await navigator.gpu?.requestAdapter();

      if (a == null) {
        return null;
      }

      return {
        vendor: a.info?.vendor ?? '',
        architecture: a.info?.architecture ?? '',
        description: a.info?.description ?? '',
        isFallbackAdapter: a.isFallbackAdapter === true,
      };
    });
  } finally {
    await browser.close();
    server.close();
  }
}

if (import.meta.filename === process.argv[1]) {
  const machine = describeMachine();
  let adapter = null;
  let probeError = null;

  try {
    adapter = await Promise.race([
      probeAdapter(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`probe exceeded ${PROBE_TIMEOUT_MS} ms`)),
          PROBE_TIMEOUT_MS,
        ).unref?.(),
      ),
    ]);
  } catch (err) {
    probeError = err?.message ?? String(err);
  }

  const report = renderGpuReport({
    machine,
    adapter,
    probeError,
    ci: process.env.CI != null,
  });

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify({ verdict: report.verdict, adapter, probeError }, null, 2),
    );
  } else {
    for (const line of report.lines) {
      console.log(line);
    }
  }

  process.exit(report.verdict === 'unknown' ? 1 : 0);
}
