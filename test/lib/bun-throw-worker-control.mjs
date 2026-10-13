import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { parseLayerShape } from '../../src/style/parse.mjs';

if (globalThis.Bun?.isMainThread !== true) {
  throw new Error('Bun throw worker control must run on Bun main thread');
}

const setupPath = fileURLToPath(
  new URL('./bun-throw-coverage-setup.mjs', import.meta.url),
);
const copiedFunctionSource = parseLayerShape.toString();

if (!copiedFunctionSource.includes('__cyThrowProbe')) {
  throw new Error('Bun did not preserve the probe in copied function source');
}

const source =
  `import { parentPort } from 'node:worker_threads';\n` +
  `const parseLayerShape = (${copiedFunctionSource});\n` +
  `try {\n` +
  `  parseLayerShape('control', 'not-a-shape');\n` +
  `  parentPort.postMessage({ threw: false });\n` +
  `} catch (error) {\n` +
  `  parentPort.postMessage({ threw: true, name: error.name, message: error.message });\n` +
  `}\n`;
const importedModuleUrl = new URL('../../src/style/parse.mjs', import.meta.url)
  .href;
const importedSource =
  `import { parentPort } from 'node:worker_threads';\n` +
  `import(${JSON.stringify(importedModuleUrl)}).then(({ parseLineCap }) => {\n` +
  `  try {\n` +
  `    parseLineCap('control-not-a-line-cap');\n` +
  `    parentPort.postMessage({ threw: false });\n` +
  `  } catch (error) {\n` +
  `    parentPort.postMessage({ threw: true, name: error.name, message: error.message });\n` +
  `  }\n` +
  `}).catch((error) => parentPort.postMessage({ loadError: error.message }));\n`;

const runWorker = async (source, label) => {
  const worker = new Worker(source, { eval: true, preload: setupPath });

  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Bun ${label} worker control timed out`)),
        5_000,
      );
      const finish = (handler, value) => {
        clearTimeout(timeout);
        handler(value);
      };

      worker.once('message', (result) => finish(resolve, result));
      worker.once('error', (error) => finish(reject, error));
      worker.once('exit', (code) => {
        if (code !== 0) {
          finish(reject, new Error(`Bun ${label} worker exited ${code}`));
        }
      });
    });
  } finally {
    await worker.terminate();
  }
};

const copiedFunction = await runWorker(source, 'copied-function');
const importedModule = await runWorker(importedSource, 'source-import');

if (
  copiedFunction?.threw !== true ||
  copiedFunction.name !== 'Error' ||
  !copiedFunction.message.startsWith("The control 'not-a-shape' is invalid;")
) {
  throw new Error(
    `Bun worker changed the copied-function guard result: ${JSON.stringify(copiedFunction)}`,
  );
}

if (
  importedModule?.threw !== true ||
  importedModule.name !== 'Error' ||
  !importedModule.message.startsWith(
    "The line-cap 'control-not-a-line-cap' is invalid;",
  )
) {
  throw new Error(
    `Bun worker changed the imported-module guard result: ${JSON.stringify(importedModule)}`,
  );
}

process.stdout.write(`${JSON.stringify({ copiedFunction, importedModule })}\n`);
