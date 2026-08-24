/**
 * Capture wrapper for tools that have no quiet mode (round 101).
 *
 * `node scripts/quiet-run.mjs [--] <command> [args...]` spawns the
 * command with both output streams captured and exits with the
 * child's code: on zero it prints nothing at all, on nonzero it
 * replays the captured stdout and stderr byte-for-byte on their own
 * streams.  The uniform quiet twin for rolldown, oxlint, tsc and the
 * other tools that own their output.
 *
 * Known cost, accepted at planning: a hung child shows nothing until
 * it is killed — the diagnosis for a hang is a rerun of the loud
 * twin, and this wrapper does not try to be a progress UI.
 */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

if (args.length === 0) {
  process.stderr.write('usage: quiet-run [--] <command> [args...]\n');
  process.exit(2);
}

const child = spawn(args[0], args.slice(1), {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

const stdoutChunks = [];
const stderrChunks = [];

child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  process.stderr.write(`quiet-run: ${error.message}\n`);
  process.exit(127);
});

child.on('close', (code, signal) => {
  const failed = code !== 0 || signal != null;

  if (failed) {
    process.stdout.write(Buffer.concat(stdoutChunks));
    process.stderr.write(Buffer.concat(stderrChunks));
  }

  process.exit(signal != null ? 1 : code);
});
