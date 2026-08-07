import { expect } from 'chai';

import {
  parseProcCpuinfo,
  parseMemTotal,
  parseOsRelease,
  parseLspciMm,
  parseDrmUevent,
  parseSystemProfilerDisplays,
  parseAppleVram,
  parseWindowsCpu,
  parseWindowsGpu,
  describeMachine,
  machineLine,
  fingerprint,
  fmtBytes,
} from '../../scripts/machine-info.mjs';

/*
Round 46.5: `scripts/machine-info.mjs`, against fixtures.

Every fixture below is a **verbatim capture** from the i9-9900K box these
rounds have used, taken 2026-08-05 — not a hand-shaped approximation.  That
is round 36.1's lesson applied to a second tool: a fixture written in a shape
the parser never meets is a spec that can never fail, and this module's whole
job is parsing other programs' output.

The macOS and Windows fixtures are the only ones not from this box, and they
are the reason parsers are separated from probes at all: there is no other way
to exercise those paths from Linux.

Controls run while writing.  Each failed the spec named — and the first three
also failed the integration specs downstream of them, which is what you want:
a broken parser should not be visible in one place only.

  - `parseProcCpuinfo` made to report the `processor` record count as the
    physical count — fails 'separates physical cores from logical'.  This is
    the control that matters: on a fixture without a `cpu cores` field, or on
    a machine without SMT, the broken parser would agree with the correct one.
  - `parseLspciMm` made to return only the first match — fails 'finds every
    display device, not just the first'.
  - the VRAM join keyed on the raw `PCI_SLOT_NAME` (domain included) rather
    than the stripped form — fails 'joins VRAM onto the card it belongs to'.
  - `describeMachine`'s probe wrapper made to rethrow — fails 'never throws
    when every probe fails'.
*/

// -- verbatim captures, 2026-08-05, Fedora 43 / i9-9900K / RX 580 --

// All 16 `processor` records, verbatim except that fields no parser reads
// (flags, bugs, cache size, microcode) are dropped.  The record *count* is
// load-bearing — abridging it to three made this fixture say 3 logical cores,
// and the spec below caught exactly that.
const PROC_CPUINFO = `processor	: 0
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4782.866
physical id	: 0
cpu cores	: 8

processor	: 1
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4701.913
physical id	: 0
cpu cores	: 8

processor	: 2
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4696.136
physical id	: 0
cpu cores	: 8

processor	: 3
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4745.276
physical id	: 0
cpu cores	: 8

processor	: 4
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4768.066
physical id	: 0
cpu cores	: 8

processor	: 5
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4791.128
physical id	: 0
cpu cores	: 8

processor	: 6
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4776.733
physical id	: 0
cpu cores	: 8

processor	: 7
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4777.290
physical id	: 0
cpu cores	: 8

processor	: 8
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4722.219
physical id	: 0
cpu cores	: 8

processor	: 9
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4782.094
physical id	: 0
cpu cores	: 8

processor	: 10
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4700.019
physical id	: 0
cpu cores	: 8

processor	: 11
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4737.285
physical id	: 0
cpu cores	: 8

processor	: 12
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4767.677
physical id	: 0
cpu cores	: 8

processor	: 13
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4702.912
physical id	: 0
cpu cores	: 8

processor	: 14
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4795.641
physical id	: 0
cpu cores	: 8

processor	: 15
model name	: Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
cpu MHz		: 4795.689
physical id	: 0
cpu cores	: 8
`;

const PROC_MEMINFO = `MemTotal:       65686240 kB
MemFree:         2117964 kB
MemAvailable:   43229152 kB
Buffers:          760812 kB
`;

const OS_RELEASE = `NAME="Fedora Linux"
VERSION="43 (Workstation Edition)"
ID=fedora
VERSION_ID=43
PRETTY_NAME="Fedora Linux 43 (Workstation Edition)"
`;

// `lspci -mm`, the two display lines verbatim.  Note the AMD card's
// *subsystem* name says 4GB while the driver reports 8 GiB — which is the
// reason `mem_info_vram_total` is authoritative and this string is used only
// for make and model.
const LSPCI_MM = `00:02.0 "Display controller" "Intel Corporation" "CoffeeLake-S GT2 [UHD Graphics 630]" -p00 "Gigabyte Technology Co., Ltd" "Device d000"
01:00.0 "VGA compatible controller" "Advanced Micro Devices, Inc. [AMD/ATI]" "Ellesmere [Radeon RX 470/480/570/570X/580/580X/590]" -re7 -p00 "Sapphire Technology Limited" "Radeon RX 570 Pulse 4GB"
`;

const UEVENT_INTEL = `DRIVER=i915
PCI_CLASS=38000
PCI_ID=8086:3E98
PCI_SLOT_NAME=0000:00:02.0
MODALIAS=pci:v00008086d00003E98sv00001458sd0000D000bc03sc80i00
`;

const UEVENT_AMD = `DRIVER=amdgpu
PCI_CLASS=30000
PCI_ID=1002:67DF
PCI_SLOT_NAME=0000:01:00.0
MODALIAS=pci:v00001002d000067DFsv00001DA2sd0000E387bc03sc00i00
`;

/** The Linux probe surface, as this box answers it. */
const linuxIo = (overrides = {}) => ({
  read: (path) => {
    if (path === '/proc/cpuinfo') {
      return PROC_CPUINFO;
    }
    if (path === '/proc/meminfo') {
      return PROC_MEMINFO;
    }
    if (path === '/etc/os-release') {
      return OS_RELEASE;
    }
    if (path === '/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq') {
      return '5000000\n';
    }
    if (path === '/sys/class/drm/card1/device/uevent') {
      return UEVENT_INTEL;
    }
    if (path === '/sys/class/drm/card2/device/uevent') {
      return UEVENT_AMD;
    }
    if (path === '/sys/class/drm/card2/device/mem_info_vram_total') {
      return '8589934592\n';
    }

    return null; // card1 has no mem_info_vram_total: integrated graphics
  },
  run: (cmd, args) => (cmd === 'lspci' && args[0] === '-mm' ? LSPCI_MM : null),
  drmCards: () => ['card1', 'card2'],
  ...overrides,
});

describe('machine-info: /proc parsers', () => {
  it('separates physical cores from logical', () => {
    const cpu = parseProcCpuinfo(PROC_CPUINFO);

    // 8 and 16 are different numbers on this fixture, which is the point: a
    // parser counting `processor` records would say 16 and pass any assertion
    // that only checked "some number was returned"
    expect(cpu.physicalCores).to.equal(8);
    expect(cpu.logicalCores).to.equal(16);
  });

  it('takes the base clock from the brand string, not from `cpu MHz`', () => {
    // every record in the fixture reads ~4700 MHz — the *current* frequency
    // at capture time, which drifts every read and is never the base clock
    expect(parseProcCpuinfo(PROC_CPUINFO).baseGHz).to.equal(3.6);
  });

  it('reads the model name', () => {
    expect(parseProcCpuinfo(PROC_CPUINFO).model).to.equal(
      'Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz',
    );
  });

  it('answers null for unreadable input rather than throwing', () => {
    expect(parseProcCpuinfo(null)).to.equal(null);
    expect(parseMemTotal(null)).to.equal(null);
    expect(parseOsRelease(null)).to.equal(null);
  });

  it('reads MemTotal as bytes', () => {
    expect(parseMemTotal(PROC_MEMINFO)).to.equal(65686240 * 1024);
  });

  it('reads the distro name and version', () => {
    expect(parseOsRelease(OS_RELEASE)).to.equal(
      'Fedora Linux 43 (Workstation Edition)',
    );
  });
});

describe('machine-info: lspci', () => {
  it('finds every display device, not just the first', () => {
    // this box has two, and a single-GPU return type is the defect this
    // catches — it would look correct on any single-GPU machine
    expect(parseLspciMm(LSPCI_MM)).to.have.lengthOf(2);
  });

  it('splits vendor from device on the quoting, not on free text', () => {
    const [intel, amd] = parseLspciMm(LSPCI_MM);

    expect(intel.vendor).to.equal('Intel Corporation');
    expect(intel.model).to.equal('CoffeeLake-S GT2 [UHD Graphics 630]');
    expect(amd.vendor).to.equal('Advanced Micro Devices, Inc. [AMD/ATI]');
    expect(amd.model).to.equal(
      'Ellesmere [Radeon RX 470/480/570/570X/580/580X/590]',
    );
  });

  it('keeps the PCI slot, which is the join key for VRAM', () => {
    expect(parseLspciMm(LSPCI_MM).map((g) => g.slot)).to.eql([
      '00:02.0',
      '01:00.0',
    ]);
  });

  it('ignores non-display devices and unparseable lines', () => {
    const text =
      '00:1f.3 "Audio device" "Intel Corporation" "Cannon Lake PCH cAVS"\ngarbage\n';

    expect(parseLspciMm(text)).to.eql([]);
    expect(parseLspciMm(null)).to.eql([]);
  });
});

describe('machine-info: drm uevent', () => {
  it("strips the PCI domain so the slot matches lspci's short form", () => {
    // PCI_SLOT_NAME is `0000:01:00.0`; lspci says `01:00.0`
    expect(parseDrmUevent(UEVENT_AMD)).to.eql({
      slot: '01:00.0',
      driver: 'amdgpu',
    });
  });

  it('reads the kernel driver', () => {
    expect(parseDrmUevent(UEVENT_INTEL).driver).to.equal('i915');
  });
});

describe('machine-info: describeMachine on Linux', () => {
  it('joins VRAM onto the card it belongs to', () => {
    const { gpus } = describeMachine({ platform: 'linux', io: linuxIo() });

    // the discrete card has 8 GiB and the integrated one has no
    // mem_info_vram_total at all; a join on the wrong key would put 8 GiB on
    // the Intel entry or on neither
    expect(gpus.find((g) => g.driver === 'amdgpu').vramBytes).to.equal(
      8589934592,
    );
    expect(gpus.find((g) => g.driver === 'i915').vramBytes).to.equal(null);
  });

  it('reports both cards, the cores, the RAM and the clocks', () => {
    const m = describeMachine({ platform: 'linux', io: linuxIo() });

    expect(m.gpus).to.have.lengthOf(2);
    expect(m.cpu.physicalCores).to.equal(8);
    expect(m.cpu.logicalCores).to.equal(16);
    expect(m.cpu.baseGHz).to.equal(3.6);
    expect(m.cpu.maxGHz).to.equal(5);
    expect(m.memory.totalBytes).to.equal(65686240 * 1024);
    expect(m.os.distro).to.equal('Fedora Linux 43 (Workstation Edition)');
    expect(m.probe.errors).to.eql([]);
  });

  it('never throws when every probe fails, and says which failed', () => {
    const io = {
      read: () => {
        throw new Error('EACCES');
      },
      run: () => {
        throw new Error('ENOENT');
      },
      drmCards: () => {
        throw new Error('ENOENT');
      },
    };

    const m = describeMachine({ platform: 'linux', io });

    // fully shaped, so every consumer can read it unguarded
    expect(m).to.have.nested.property('cpu.model');
    expect(m).to.have.nested.property('memory.totalBytes');
    expect(m.gpus).to.eql([]);
    expect(m.probe.errors).to.not.be.empty;
    expect(m.fingerprint).to.be.a('string');
  });

  it('records a probe failure rather than swallowing it', () => {
    const io = linuxIo({ run: () => null }); // lspci absent
    const m = describeMachine({ platform: 'linux', io });

    expect(m.gpus).to.eql([]);
    expect(m.probe.errors.join(' ')).to.match(/lspci/);
  });

  it('falls back to os.cpus() on a platform with no probe', () => {
    const m = describeMachine({ platform: 'sunos', io: linuxIo() });

    // never worse than nothing: the logical count and the model still come
    // through, and the missing probe is named
    expect(m.cpu.logicalCores).to.be.a('number');
    expect(m.probe.errors.join(' ')).to.match(/sunos/);
  });
});

describe('machine-info: macOS parsers', () => {
  // shaped as `system_profiler SPDisplaysDataType -json` emits it
  const DISPLAYS = JSON.stringify({
    SPDisplaysDataType: [
      {
        _name: 'Apple M2 Pro',
        spdisplays_vendor: 'sppci_vendor_Apple',
        sppci_model: 'Apple M2 Pro',
        spdisplays_vram_shared: '16 GB',
      },
    ],
  });

  it('reads the model and the shared VRAM figure', () => {
    const [gpu] = parseSystemProfilerDisplays(DISPLAYS);

    expect(gpu.model).to.equal('Apple M2 Pro');
    expect(gpu.vramBytes).to.equal(16 * 1024 ** 3);
  });

  it('parses both GB and MB forms and rejects anything else', () => {
    expect(parseAppleVram('1536 MB')).to.equal(1536 * 1024 ** 2);
    expect(parseAppleVram('8 GB')).to.equal(8 * 1024 ** 3);
    expect(parseAppleVram(undefined)).to.equal(null);
    expect(parseAppleVram('lots')).to.equal(null);
  });

  it('answers empty for malformed JSON rather than throwing', () => {
    expect(parseSystemProfilerDisplays('not json')).to.eql([]);
  });
});

describe('machine-info: Windows parsers', () => {
  it('sums cores across sockets', () => {
    const cpu = parseWindowsCpu(
      JSON.stringify([
        {
          Name: 'Intel Xeon Gold 6248R',
          NumberOfCores: 24,
          NumberOfLogicalProcessors: 48,
          MaxClockSpeed: 3000,
        },
        {
          Name: 'Intel Xeon Gold 6248R',
          NumberOfCores: 24,
          NumberOfLogicalProcessors: 48,
          MaxClockSpeed: 3000,
        },
      ]),
    );

    expect(cpu.physicalCores).to.equal(48);
    expect(cpu.logicalCores).to.equal(96);
    expect(cpu.baseGHz).to.equal(3);
  });

  it('handles the single-CPU case, which CIM emits as an object not an array', () => {
    const cpu = parseWindowsCpu(
      JSON.stringify({
        Name: 'AMD Ryzen 9 5950X',
        NumberOfCores: 16,
        NumberOfLogicalProcessors: 32,
      }),
    );

    expect(cpu.physicalCores).to.equal(16);
  });

  it('refuses AdapterRAM when it has saturated its signed 32-bit field', () => {
    // a 24 GiB card reports 4294967295; taking that at face value would
    // publish "4 GiB" for every modern GPU on Windows
    const [big] = parseWindowsGpu(
      JSON.stringify({ Name: 'NVIDIA RTX 4090', AdapterRAM: 4294967295 }),
    );

    expect(big.vramBytes).to.equal(null);
    expect(big.vramUnreliable).to.equal(true);

    const [small] = parseWindowsGpu(
      JSON.stringify({ Name: 'Intel UHD 630', AdapterRAM: 1073741824 }),
    );

    expect(small.vramBytes).to.equal(1073741824);
    expect(small.vramUnreliable).to.equal(false);
  });
});

describe('machine-info: presentation', () => {
  it('renders bytes as the nearest binary unit', () => {
    expect(fmtBytes(8589934592)).to.equal('8.0 GiB');
    expect(fmtBytes(0)).to.equal(null);
    expect(fmtBytes(null)).to.equal(null);
  });

  it('summarizes a machine in one line', () => {
    const line = machineLine(
      describeMachine({ platform: 'linux', io: linuxIo() }),
    );

    expect(line).to.match(/i9-9900K/);
    expect(line).to.match(/8c\/16t/);
    expect(line).to.match(/8\.0 GiB/); // the discrete card's VRAM
  });

  it('answers the empty string for a null machine, so a caller can interpolate unguarded', () => {
    expect(machineLine(null)).to.equal('');
  });
});

describe('machine-info: fingerprint', () => {
  const base = () => describeMachine({ platform: 'linux', io: linuxIo() });

  it('is stable across two describes of the same box', () => {
    expect(base().fingerprint).to.equal(base().fingerprint);
  });

  it('changes when the hardware does', () => {
    const other = base();

    other.gpus = [];

    expect(fingerprint(other)).to.not.equal(base().fingerprint);
  });

  it('ignores what drifts on one box', () => {
    // a kernel upgrade or a node upgrade must not split a benchmark trend in
    // two, which is the whole reason this is not a hash of the whole object
    const a = base();
    const b = base();

    b.os.kernel = '7.0.0-rc1';
    b.node.version = 'v26.0.0';

    expect(fingerprint(b)).to.equal(fingerprint(a));
  });
});
