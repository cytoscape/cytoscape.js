// The Node throw probe's recorder as source text, so it can be installed
// in a realm without an import: the setup evaluates it, and prepends it to
// every `eval` worker — Node runs `--import` preloads in file workers but
// not in eval ones, and the algorithm pool sends its kernels that way, as
// copied function source.  Idempotent; the first install in a realm logs
// `ready`.
export const PROBE_PRELUDE =
  'globalThis.__cyThrowProbe ??= (() => {' +
  "const fs = process.getBuiltinModule('node:fs');" +
  "const realm = process.getBuiltinModule('node:worker_threads').isMainThread ? 'main' : 'worker';" +
  'const log = process.env.CY_THROW_PROBE_LOG;' +
  "const write = (kind, site) => fs.appendFileSync(log, JSON.stringify({ kind, site, realm }) + '\\n');" +
  "write('ready', null);" +
  "return (site) => write('hit', site);" +
  '})();';
