import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';

const manifestPath = process.env.CY_THROW_SITE_MANIFEST;
const probePath = process.env.CY_THROW_PROBE_LOG;

if (manifestPath == null || probePath == null) {
  throw new Error('Bun throw coverage hook needs its site manifest and log');
}

export const expectedSites = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (
  !Array.isArray(expectedSites) ||
  expectedSites.some((site) => typeof site !== 'string') ||
  new Set(expectedSites).size !== expectedSites.length
) {
  throw new Error('Bun throw coverage site manifest is malformed');
}

const expected = new Set(expectedSites);
const logFd = openSync(probePath, 'a');
const realm = globalThis.Bun?.isMainThread === false ? 'worker' : 'main';

const writeRecord = (record) => {
  const row = Buffer.from(`${JSON.stringify(record)}\n`);
  const written = writeSync(logFd, row, 0, row.byteLength);

  if (written !== row.byteLength) {
    throw new Error('Bun throw probe wrote a partial record');
  }
};

export const recordThrowProbe = (kind, site) => {
  if (!expected.has(site)) {
    throw new Error(`Bun throw probe received stale source site ${site}`);
  }

  writeRecord({ kind, site, realm });
};

writeRecord({ kind: 'ready', site: null, realm });
globalThis.__cyThrowProbe = (site) => recordThrowProbe('hit', site);

process.once('exit', () => closeSync(logFd));
