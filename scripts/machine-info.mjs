// Round 46.5: what machine produced a measurement.
//
// A benchmark number without the box it came from is not comparable to
// anything, and this repo publishes premiums.  `meta.cpu` has carried a single
// string since the renderer benchmarks landed (`os.cpus()[0].model` plus a
// WebGPU adapter label); this module is the structured superset — cores,
// clock, RAM, OS, and a GPU *inventory* with VRAM.
//
// Two structural rules make it testable and safe:
//
//   1. **Parsers are pure and exported; probes are separate.**  Every `parseX`
//      takes the text a command or a sysfs file produced and returns data.
//      That is the only way to test the macOS and Windows paths from Linux,
//      and the fixtures in `test/modules/machine-info.mjs` are verbatim
//      captures rather than hand-shaped approximations.
//   2. **Nothing here throws, and nothing here blocks.**  Every probe is
//      wrapped, every spawn is time-boxed, and a failure yields `null` for
//      that field plus an entry in `probe.errors` — a benchmark run must not
//      die because `lspci` is missing, but a silently absent GPU would be
//      worse than a recorded failure.
//
// Deliberately absent: a `primary` flag on the GPU list.  Which adapter
// actually rendered is a question only WebGPU can answer, and
// `benchmark/render-bench.mjs` answers it separately as `meta.adapter`.  A
// heuristic here would be a guess presented as a fact.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';

/** Longest a single probe may take before it is abandoned as unavailable. */
const PROBE_TIMEOUT_MS = 3000;

// -- probe primitives --

/** Run a command, returning its stdout or `null` for any failure at all. */
export function runProbe(cmd, args, timeout = PROBE_TIMEOUT_MS) {
  try {
    const r = spawnSync(cmd, args, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return r.status === 0 && typeof r.stdout === 'string' ? r.stdout : null;
  } catch {
    return null;
  }
}

/** Read a file, returning its text or `null`. */
export function readProbe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// -- Linux parsers --

/**
 * `/proc/cpuinfo` — model, and the physical/logical split.
 *
 * The physical count is `cpu cores` times the number of distinct `physical id`
 * values (sockets), not the record count: this box reports 16 `processor`
 * records, `cpu cores : 8` and one socket, so 8/16.  A parser that reported
 * the record count as physical would read 16/16 here and be wrong in exactly
 * the way that matters for a per-core number.
 */
export function parseProcCpuinfo(text) {
  if (text == null) {
    return null;
  }

  const field = (name) => {
    const m = text.match(new RegExp(`^${name}\\s*:\\s*(.+)$`, 'm'));

    return m != null ? m[1].trim() : null;
  };

  const model = field('model name');
  const logical = (text.match(/^processor\s*:/gm) ?? []).length || null;
  const sockets = new Set(text.match(/^physical id\s*:\s*(\d+)$/gm) ?? []).size;
  const perSocket = Number(field('cpu cores')) || null;
  const physical = perSocket != null ? perSocket * Math.max(sockets, 1) : null;

  // the base clock is in the brand string ('... CPU @ 3.60GHz'); /proc's own
  // 'cpu MHz' is the *current* frequency and drifts every read
  const brandGHz = model != null ? model.match(/@\s*([\d.]+)\s*GHz/i) : null;

  return {
    model,
    physicalCores: physical,
    logicalCores: logical,
    baseGHz: brandGHz != null ? Number(brandGHz[1]) : null,
  };
}

/** `/proc/meminfo` — `MemTotal` is in kB. */
export function parseMemTotal(text) {
  const m = text != null ? text.match(/^MemTotal:\s*(\d+)\s*kB$/m) : null;

  return m != null ? Number(m[1]) * 1024 : null;
}

/** `/etc/os-release` — the human distro name. */
export function parseOsRelease(text) {
  if (text == null) {
    return null;
  }

  const field = (name) => {
    const m = text.match(new RegExp(`^${name}="?([^"\n]+)"?$`, 'm'));

    return m != null ? m[1] : null;
  };

  const name = field('NAME');
  const version = field('VERSION');

  return name != null
    ? [name, version].filter((v) => v != null).join(' ')
    : null;
}

/**
 * `lspci -mm`, filtered to display devices.
 *
 * `-mm` and not bare `lspci`: it quote-delimits its fields, so vendor and
 * device split without a regex over free text.  A line reads
 *
 *   01:00.0 "VGA compatible controller" "Advanced Micro..." "Ellesmere [...]" -re7 -p00 "Sapphire..." "Radeon RX 570 Pulse 4GB"
 *
 * Note the subsystem name on the real card here says 4GB while the driver
 * reports 8 GiB, which is why `mem_info_vram_total` is authoritative for VRAM
 * and this is used only for make and model.
 */
export function parseLspciMm(text) {
  if (text == null) {
    return [];
  }

  const gpus = [];

  for (const line of text.split('\n')) {
    const quoted = [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);

    if (quoted.length < 3) {
      continue;
    }

    const [deviceClass, vendor, model] = quoted;

    if (
      !/VGA compatible controller|3D controller|Display controller/i.test(
        deviceClass,
      )
    ) {
      continue;
    }

    const slot = line.slice(0, line.indexOf('"')).trim();

    gpus.push({ slot, vendor: vendor || null, model: model || null });
  }

  return gpus;
}

/**
 * A `/sys/class/drm/cardN/device/uevent` — the PCI slot and kernel driver.
 *
 * `PCI_SLOT_NAME` carries the domain (`0000:01:00.0`) while `lspci` omits it
 * (`01:00.0`), so the domain is stripped here and the two sides join on the
 * short form.
 */
export function parseDrmUevent(text) {
  if (text == null) {
    return null;
  }

  const slot = text.match(/^PCI_SLOT_NAME=(.+)$/m);
  const driver = text.match(/^DRIVER=(.+)$/m);

  return {
    slot: slot != null ? slot[1].trim().replace(/^0000:/, '') : null,
    driver: driver != null ? driver[1].trim() : null,
  };
}

/** macOS `system_profiler SPDisplaysDataType -json`. */
export function parseSystemProfilerDisplays(text) {
  if (text == null) {
    return [];
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const cards = parsed?.SPDisplaysDataType ?? [];

  return cards.map((c) => ({
    slot: null,
    vendor: c.spdisplays_vendor ?? null,
    model: c.sppci_model ?? c._name ?? null,
    driver: null,
    // dedicated first, then the shared figure Apple Silicon reports
    vramBytes: parseAppleVram(
      c.spdisplays_vram ?? c._spdisplays_vram ?? c.spdisplays_vram_shared,
    ),
  }));
}

/** Apple reports VRAM as a human string ('8 GB', '1536 MB'). */
export function parseAppleVram(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const m = value.match(/([\d.]+)\s*(GB|MB)/i);

  if (m == null) {
    return null;
  }

  const scale = m[2].toUpperCase() === 'GB' ? 1024 ** 3 : 1024 ** 2;

  return Math.round(Number(m[1]) * scale);
}

/** Windows `Get-CimInstance Win32_VideoController | ConvertTo-Json`. */
export function parseWindowsGpu(text) {
  if (text == null) {
    return [];
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const cards = Array.isArray(parsed) ? parsed : [parsed];

  return cards.map((c) => ({
    slot: null,
    vendor: c.AdapterCompatibility ?? null,
    model: c.Name ?? null,
    driver: c.DriverVersion ?? null,
    // AdapterRAM is a signed 32-bit field, so it saturates and misreports any
    // card with >= 4 GiB.  Reporting it as unknown beats reporting 4 GiB for
    // a 24 GiB card; the flag says which happened.
    vramBytes:
      c.AdapterRAM > 0 && c.AdapterRAM < 0xffffffff ? c.AdapterRAM : null,
    vramUnreliable: c.AdapterRAM == null || c.AdapterRAM >= 0xffffffff,
  }));
}

/** Windows `Get-CimInstance Win32_Processor | ConvertTo-Json`. */
export function parseWindowsCpu(text) {
  if (text == null) {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const cpus = Array.isArray(parsed) ? parsed : [parsed];

  if (cpus.length === 0) {
    return null;
  }

  const sum = (key) =>
    cpus.reduce((n, c) => n + (Number(c[key]) || 0), 0) || null;

  return {
    model: cpus[0].Name?.trim() ?? null,
    physicalCores: sum('NumberOfCores'),
    logicalCores: sum('NumberOfLogicalProcessors'),
    baseGHz:
      cpus[0].MaxClockSpeed != null
        ? Math.round(Number(cpus[0].MaxClockSpeed) / 10) / 100
        : null,
  };
}

// -- the platform probes --

function linuxProbe(io, errors) {
  const cpu = parseProcCpuinfo(io.read('/proc/cpuinfo')) ?? {};
  const maxKHz = Number(
    io.read('/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq'),
  );

  if (cpu.model == null) {
    errors.push('/proc/cpuinfo unreadable');
  }

  const gpus = parseLspciMm(io.run('lspci', ['-mm']));

  if (gpus.length === 0) {
    errors.push('lspci reported no display device');
  }

  // join the driver's VRAM figure onto the PCI inventory by slot
  for (const card of io.drmCards()) {
    const uevent = parseDrmUevent(
      io.read(`/sys/class/drm/${card}/device/uevent`),
    );

    if (uevent?.slot == null) {
      continue;
    }

    const gpu = gpus.find((g) => g.slot === uevent.slot);

    if (gpu == null) {
      continue;
    }

    gpu.driver = uevent.driver;

    const vram = Number(
      io.read(`/sys/class/drm/${card}/device/mem_info_vram_total`),
    );

    gpu.vramBytes = Number.isFinite(vram) && vram > 0 ? vram : null;
  }

  return {
    cpu: {
      model: cpu.model ?? null,
      physicalCores: cpu.physicalCores ?? null,
      logicalCores: cpu.logicalCores ?? null,
      baseGHz: cpu.baseGHz ?? null,
      maxGHz:
        Number.isFinite(maxKHz) && maxKHz > 0
          ? Math.round(maxKHz / 1000) / 1000
          : null,
    },
    memory: { totalBytes: parseMemTotal(io.read('/proc/meminfo')) },
    distro: parseOsRelease(io.read('/etc/os-release')),
    gpus: gpus.map((g) => ({ vramBytes: null, driver: null, ...g })),
  };
}

function darwinProbe(io, errors) {
  const sysctl = (key) => {
    const out = io.run('sysctl', ['-n', key]);

    return out != null ? out.trim() : null;
  };

  const model = sysctl('machdep.cpu.brand_string');

  if (model == null) {
    errors.push('sysctl machdep.cpu.brand_string unavailable');
  }

  // hw.cpufrequency is empty on Apple Silicon; leave it null rather than
  // inventing a number
  const hz = Number(sysctl('hw.cpufrequency'));
  const brandGHz = model != null ? model.match(/@\s*([\d.]+)\s*GHz/i) : null;

  const displays = io.run('system_profiler', ['SPDisplaysDataType', '-json']);

  if (displays == null) {
    errors.push('system_profiler SPDisplaysDataType unavailable');
  }

  return {
    cpu: {
      model,
      physicalCores: Number(sysctl('hw.physicalcpu')) || null,
      logicalCores: Number(sysctl('hw.logicalcpu')) || null,
      baseGHz:
        brandGHz != null
          ? Number(brandGHz[1])
          : Number.isFinite(hz) && hz > 0
            ? Math.round(hz / 1e7) / 100
            : null,
      maxGHz: null,
    },
    memory: { totalBytes: Number(sysctl('hw.memsize')) || null },
    distro: (() => {
      const v = io.run('sw_vers', ['-productVersion']);

      return v != null ? `macOS ${v.trim()}` : null;
    })(),
    gpus: parseSystemProfilerDisplays(displays),
  };
}

function win32Probe(io, errors) {
  const ps = (query) =>
    io.run('powershell', [
      '-NoProfile',
      '-Command',
      `Get-CimInstance ${query} | ConvertTo-Json`,
    ]);

  const cpu = parseWindowsCpu(ps('Win32_Processor'));

  if (cpu == null) {
    errors.push('Win32_Processor unavailable');
  }

  const memory = io.run('powershell', [
    '-NoProfile',
    '-Command',
    '(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory',
  ]);

  return {
    cpu: {
      maxGHz: null,
      ...(cpu ?? {
        model: null,
        physicalCores: null,
        logicalCores: null,
        baseGHz: null,
      }),
    },
    memory: { totalBytes: Number(memory) || null },
    distro: (() => {
      const v = io.run('powershell', [
        '-NoProfile',
        '-Command',
        '(Get-CimInstance Win32_OperatingSystem).Caption',
      ]);

      return v != null ? v.trim() : null;
    })(),
    gpus: parseWindowsGpu(ps('Win32_VideoController')),
  };
}

/** The default IO surface; injectable so a spec can drive any platform path. */
export function defaultIo() {
  return {
    run: runProbe,
    read: readProbe,
    drmCards: () => {
      try {
        return readdirSync('/sys/class/drm').filter((n) => /^card\d+$/.test(n));
      } catch {
        return [];
      }
    },
  };
}

/**
 * Describe the machine this process is running on.
 *
 * Never throws.  Any field that could not be determined is `null`, and
 * `probe.errors` names the probe that failed rather than swallowing it — an
 * absent GPU section that says nothing about why is worse than no section.
 *
 * @param platform — override for testing; defaults to `process.platform`
 * @param io — override the probe surface for testing
 */
export function describeMachine({
  platform = process.platform,
  io = defaultIo(),
} = {}) {
  const errors = [];
  let probed;

  try {
    probed =
      platform === 'linux'
        ? linuxProbe(io, errors)
        : platform === 'darwin'
          ? darwinProbe(io, errors)
          : platform === 'win32'
            ? win32Probe(io, errors)
            : null;
  } catch (err) {
    errors.push(`probe threw: ${err?.message ?? err}`);
    probed = null;
  }

  if (probed == null) {
    errors.push(`no probe for platform ${platform}`);
  }

  // os.cpus()/os.totalmem() are the floor: they work everywhere and are never
  // worse than nothing, so a platform with no probe still reports something
  let fallbackCpu = null;
  let fallbackMem = null;

  try {
    fallbackCpu = os.cpus();
    fallbackMem = os.totalmem();
  } catch {
    /* os is not expected to fail; if it does, null is the answer */
  }

  const machine = {
    cpu: {
      model: probed?.cpu.model ?? fallbackCpu?.[0]?.model ?? null,
      physicalCores: probed?.cpu.physicalCores ?? null,
      logicalCores: probed?.cpu.logicalCores ?? fallbackCpu?.length ?? null,
      baseGHz: probed?.cpu.baseGHz ?? null,
      maxGHz: probed?.cpu.maxGHz ?? null,
    },
    memory: { totalBytes: probed?.memory.totalBytes ?? fallbackMem ?? null },
    os: {
      platform,
      distro: probed?.distro ?? null,
      kernel: safe(() => os.release()),
      arch: safe(() => os.arch()),
    },
    node: { version: process.version, v8: process.versions?.v8 ?? null },
    gpus: probed?.gpus ?? [],
    probe: { errors },
  };

  machine.fingerprint = fingerprint(machine);

  return machine;
}

function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/**
 * A stable id for "the same box", so a benchmark trend can refuse to compare
 * runs across machines.  Deliberately excludes anything that drifts on the
 * same hardware — kernel version, node version, free memory.
 */
export function fingerprint(machine) {
  const parts = [
    machine.cpu.model,
    machine.cpu.physicalCores,
    machine.cpu.logicalCores,
    machine.memory.totalBytes,
    machine.os.platform,
    machine.os.arch,
    machine.gpus.map((g) => `${g.model}:${g.vramBytes ?? '?'}`).join(','),
  ];

  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8);
}

/** Bytes as the nearest binary unit, for a report header. */
export function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let v = n;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }

  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/**
 * The one-line form, for a report meta line or a publish manifest:
 * `i9-9900K 8c/16t · 62.7 GiB · Radeon RX 570 (8 GiB)`.
 *
 * Returns `''` for a null machine so a caller can interpolate it unguarded.
 */
export function machineLine(machine) {
  if (machine == null) {
    return '';
  }

  const cpu =
    machine.cpu.model != null
      ? machine.cpu.model
          .replace(/\(R\)|\(TM\)|CPU|Processor|@.*$/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : null;
  const cores =
    machine.cpu.physicalCores != null && machine.cpu.logicalCores != null
      ? `${machine.cpu.physicalCores}c/${machine.cpu.logicalCores}t`
      : null;
  const gpus = machine.gpus
    .map((g) => {
      const vram = fmtBytes(g.vramBytes);

      return g.model != null
        ? `${g.model}${vram != null ? ` (${vram})` : ''}`
        : null;
    })
    .filter((v) => v != null);

  return [
    [cpu, cores].filter((v) => v != null).join(' ') || null,
    fmtBytes(machine.memory.totalBytes),
    gpus.length > 0 ? gpus.join(' + ') : null,
  ]
    .filter((v) => v != null && v !== '')
    .join(' · ');
}

// -- CLI --
//
// `npm run machine` — so a maintainer can paste this into an issue, and so the
// module is exercised by hand as well as by its fixtures.
if (import.meta.filename === process.argv[1]) {
  const machine = describeMachine();

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(machine, null, 2));
  } else {
    console.log(machineLine(machine));
    console.log(
      `  os      ${machine.os.distro ?? machine.os.platform} · ${machine.os.kernel} · ${machine.os.arch}`,
    );
    console.log(`  node    ${machine.node.version} (v8 ${machine.node.v8})`);
    console.log(`  id      ${machine.fingerprint}`);

    for (const err of machine.probe.errors) {
      console.log(`  probe   ${err}`);
    }
  }
}
