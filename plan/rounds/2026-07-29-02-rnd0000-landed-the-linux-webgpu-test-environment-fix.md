## The Linux WebGPU test environment fix

Root-caused and fixed the "adapter acquires but renders blank" failure
that kept the `webgpu`/`visual` Playwright projects from
validating on Linux (round 11's open verification debt).  Probing the
Playwright-launched Chromium (1.61.1, `channel: 'chromium'` new
headless) with the failure split into stages showed:

- **Dawn rendering was never broken.**  With the repo's flags, the
  adapter acquires and an offscreen render → `copyTextureToBuffer` →
  map readback produces correct pixels on *both* the SwiftShader
  adapter and the hardware one (RX 580, RADV, Mesa 25.3.6 — Vulkan 1.4
  is healthy on this box).
- **Canvas *presentation* was the failure.**  Under the default Linux
  GL compositor, `ctx.configure()`/`getCurrentTexture()` on a WebGPU
  canvas killed the instance ("A valid external Instance reference no
  longer exists"); under `--use-angle=vulkan` alone the canvas
  configured but composited transparent.  Composited (screenshot)
  pixels — what the specs assert — stayed blank either way, which is
  exactly the round-11 symptom.
- **The fix**: `--use-gl=angle --use-angle=vulkan
  --enable-features=Vulkan` routes Chromium's compositor through
  ANGLE-on-Vulkan, and the shared-image canvas path presents
  correctly for both the hardware and the SwiftShader-pinned WebGPU
  adapter.  Added to the `webgpu` and `visual` projects in
  `playwright.config.js`, gated on `process.platform === 'linux'` —
  `--use-angle=vulkan` does not exist on macOS (Metal), so the
  known-good macOS configuration is untouched.
- **Determinism and CI are unaffected.**  The SwiftShader pin still
  applies to the *WebGPU* adapter (only compositing uses the AMD
  device), and the goldens generated on macOS pass here unchanged —
  confirming cross-platform golden stability.  Simulating a
  no-Vulkan-driver machine (a CI runner) yields a null adapter → the
  specs soft-skip exactly as before, so CI behaviour is unchanged.
- One quirk noted, no action needed: `drawImage()` from a live WebGPU
  canvas into a 2D canvas still reads transparent under these flags —
  no spec uses that path (they decode `page.screenshot()` or use
  `cy.png()` readback, both working).

**Verification**: 39/39 `webgpu` + 12/12 `visual` specs green
on this machine (all 10 golden diffs within tolerance against the
checked-in macOS-generated PNGs, both v3-parity diffs within their 2%
bound) — round 11's "re-run on a machine with a working adapter"
caveat is cleared, and this Linux machine can run the visual projects
going forward.
