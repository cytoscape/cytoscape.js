## Ledger item 51: the worker host's images and fonts

Ledger item 51 (round 86's worker-host deferrals), taken as a round.
There was no plan file: the spec is the item's text in `PLAN.md`
(through its "Call taken" line) and its line in the eleventh sitting's
note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`).

The item logged three capabilities the worker host
(`renderer: { worker: true }`) shipped without, each correct by falling
back: background images (the proxy zeroed the image count and emitted
one error event), GPU tweens and `startForce` across the boundary (the
force half closed by round 129.2), and page `@font-face` labels (a
worker's FontFaceSet does not inherit the document's).  Its 2026-09-18
measurement recommended images in the plan's shape — decode in the
worker, the registry's lifecycle mirrored per frame — and fonts
"bytes-sourced faces from an app-provided list (`renderer: { worker:
true, fonts: [url] }`), with the WebKit half to-verify before the option
is documented as cross-engine".

**Call taken (2026-09-28, the eleventh sitting): images and fonts both
before alpha** — images decoded in the worker, fonts from an
app-provided list registered from bytes, WebKit verified before the
option is documented as cross-engine.

### The round, as carried out (2026-09-29)

| # | Commit | What landed |
| --- | --- | --- |
| 141.1 | `26ffa498` | background images decode in the worker: the registry journal and its mirror, the batch's lifecycle ops, the worker decoder, SVG rastered main-side |
| 141.2 | `dc7216c3` | `renderer.fonts`: the option, the schema, the worker registration from bytes, the atlas's font epoch; the mechanics spec that runs on WebKit |
| 141.3 | `8dce7ba6` | `benchmark/worker-host-deferrals.mjs --image-hosts`: what the decodes moved off the main thread |
| 141.4 | this commit | the close: this record, item 51 closed, item 85 logged, the docs and the summary |

#### 1. Images, decoded in the worker

The canonical `ImageRegistry` stays on the main thread — style
application acquires and releases there — and, while a worker host
mirrors it, **journals** each entry's creation and freeing
(`setJournal` / `takeJournal`; `snapshotOps` is the full transfer).  A
create freed before the next take is cancelled in place, so a
short-lived entry never crosses; a free followed by a create at the
recycled id crosses in that order.  The batch carries the ops
(`StoreBatch.images`, `reset` on the init transfer), and the worker's
registry **replays them by id** (`adopt` / `drop`): only the canonical
side allocates ids, so the image records' entry ids mean the same thing
on both sides with no remap.  The worker's registry owns the decoder
and runs it there — `fetch` + `createImageBitmap`, the scratch canvas an
OffscreenCanvas — and `RemoteModelView.nodeImagesAt` decodes the
mirrored records (`decodeNodeImages`, shared with the store), so the
vector promotion meter runs in the worker as it does same-thread.  The
proxy's zeroed count and its one-time error are gone.

**SVG is the exception, by measurement**: a worker has no `<img>`, and
`createImageBitmap` refuses an SVG blob in a worker in Chromium 149 and
WebKit 26.5 alike ("The source image could not be decoded" /
"Cannot decode the data").  So the worker fetches the source, sees an
SVG, and sends the blob to the main thread (`raster`), which rasters it
through the page's path (`rasterVectorInPage`, the old code factored
out) and transfers the raster back (`rasterresult`).  Raster sources —
the decode cost that matters — never touch the main thread.

**Parity**: worker-vs-main exports of raster and SVG images, `auto`
and `sdf-icon`, through a restyle that frees one entry, shares another
and recycles a third's id: **exact-zero**, with the main registry left
all-pending (it has no decoder under the worker host — the proof the
decodes ran in the worker).  Control: a null worker decoder fails both
specs.

#### 2. Fonts, from an app-provided list, registered from bytes

`renderer.fonts: WorkerFontFace[]` — `{ family, source: url | ArrayBuffer
| view, style?, weight?, stretch?, unicodeRange? }`, the `FontFace`
constructor's three arguments with a url fetched rather than passed as
a `url()` source.  The proxy checks the list before anything is created
(a `TypeError` naming the entry), resolves urls against the document
(the worker's own base is a blob: url) and sends it in the init message;
the worker fetches each face in parallel, builds the `FontFace` from its
bytes, loads it, adds it to `self.fonts` and tells the engine
(`src/render/worker-fonts.mts`).  A face that fails emits one `error`
event and its family keeps the fallback; a worker with no FontFaceSet
fails the list loudly.  Ignored without `worker: true` (the same-thread
renderer has the page's faces).

**Round 75's semantics**: labels draw as soon as the renderer is ready
— in the fallback for a family whose face is still loading — and a
landed face re-rasters them only when the atlas font names it
(`facesLanded`, the `loadingdone` filter's rule).  No first-frame hold.

**The spike re-probed, and what its "url dead end" was.**  Round 141's
first probe got the opposite of the 2026-09-18 result in Chromium
(bytes failing, a url face applying) and a third got both working.  The
variable was *order*: in a Chromium worker, **a font description
resolved on any canvas before its face is registered keeps resolving to
the fallback, on every canvas in that worker, after `load()`, after
`fonts.ready`, after a task yield**.  Measured (Chromium 149, Open Sans,
advance of "Hello World" at 32 px; fallback 158.28 or 164.80, the face
174.81): after poisoning `32px "F", serif` — the same description reads
the fallback, and so do whitespace variants (`32px  "F", serif`, a
trailing space, no space after the comma); `31px`, `bold`, a
lower-cased or unquoted family, or a different family list
(`… , sans-serif`, `… , "cy-font-epoch-1"`) re-resolve to the face.
WebKit 26.5 re-resolves every form.  A url face added while in flight is
one way to poison the description (it is measured before it loads); a
control measured before registering is another — most likely what the
spike's control did.  A url face nobody measured early applies in both
engines.

Two calls followed:

- **Bytes stay the design**, although the url form is not a dead end: a
  bytes face is loaded before it is added, so nothing can resolve it in
  flight, and a failed fetch is an error the app reads rather than a
  silent fallback.
- **The atlas re-rasters a late face on a fresh description.**  The
  labels usually raster before a slow face lands, which is exactly the
  poisoning order.  `GlyphAtlas.reraster(true)` bumps a font epoch whose
  inert, never-registered family ends the raster font list — glyphs
  never reach it (the list's generic answers first), and the description
  is new to the worker.  Load-bearing: with the bump disabled, the late
  face's spec reads **1,443 px** off the same-thread render.

**Parity**: with the same face registered on the page for the
same-thread host, the worker host's labels — a face listed and landed
before the labels, and a *late* face held back by a route until the
labels have drawn in the fallback — diff **exact-zero** (control: the
fallback reads >100 px off, and so does the late run before release).

#### 3. WebKit

Playwright's WebKit (26.5) launches on this Fedora box with the
config's `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` (the item's
2026-09-18 note that it could not is out of date), but it has **no
WebGPU** — `navigator.gpu` is absent on the page and in workers — so
every worker-host spec soft-skips there, as before.  What WebKit
verifies is every worker mechanism the host relies on short of the GPU,
in a spec that needs no adapter (`the worker mechanics the host relies
on`, both projects):

| | Chromium 149 | WebKit 26.5 |
| --- | --: | --: |
| bytes face, fresh description (page = 174.81) | 174.81 | 174.81 |
| the description resolved before registering | 164.80 (stale) | 174.81 |
| the epoch description | 174.81 | 174.81 |
| raster blob → `createImageBitmap` in a worker | 16 × 16 | 16 × 16 |
| SVG blob → `createImageBitmap` in a worker | refused | refused |

So the option is documented as **verified end to end in Chromium, its
worker mechanics verified in WebKit, WebKit's worker-side WebGPU not** —
not as cross-engine.  The end-to-end WebKit run waits for a WebKit with
WebGPU on this box's Playwright (macOS has one); the spec is already in
the `renderer-webkit` project and will run where an adapter exists.

#### 4. What the image decodes moved off the main thread

`node benchmark/worker-host-deferrals.mjs --image-hosts` (RX 580,
Chromium 149, the built UMD; two runs, each host after a warm-up pass):

| | same-thread | worker host |
| --- | --: | --: |
| style apply acquiring 1,000 distinct 64 px rasters | 124–142 ms (one long task) | 4.8–5.5 ms (none) |
| settled (no frame for 750 ms) | 514–551 ms | 383–409 ms |
| rAF ticks over the settle / worst gap | 59–61 / 101 ms | 64–65 / 88–91 ms |
| batch posts / ms | — | 1 / 2.8–3.1 ms (1,000 create ops) |
| fresh-url churn, per restyle | 1.82–1.85 ms | 1.45–1.50 ms |

The long task is the decode's own main-thread cost: issuing 1,000
`fetch`es is ~44 ms and 1,000 `createImageBitmap` calls ~52 ms
(measured directly in the page), plus their continuations and the
uploads — all in the worker now.

**The spike's argument was mis-attributed.**  It priced a fresh url at
"~6.5 ms of `fetch` + `createImageBitmap`" of main thread; the churn
row costs the same on both hosts, and headless with no renderer at all a
data write to a key `background-image` maps costs **0.19 / 2.4 / 33 ms
at 250 / 1,000 / 4,000 distinct urls** (a colour mapper over distinct
strings: 0.27 / 0.83 / 4.1 ms; one shared url: 0.04 ms) — superlinear in
the distinct values, the style engine's, not the decoder's.  The
build-out stands on the load row above; the write cost is logged as
**item 85**.

#### 5. The calls taken in-round

1. **Fetch fonts in the worker, not main-side** — the worker is where
   the bytes are needed; only the url is resolved main-side.
2. **No first-frame hold for fonts** — round 75's swap semantics, and a
   slow face never delays geometry; the epoch makes the swap work in
   Chromium.
3. **SVG rasters on the main thread** — the engines refuse it in a
   worker (§1); raster sources decode in the worker.
4. **One `error` event per failing face**, not a console warning — the
   list is explicit configuration, and the app can read the event.
5. **`WorkerFontFace` flattens the descriptors** (`style`, `weight`,
   `stretch`, `unicodeRange`) so the schema states them; bytes are in
   the type but not the schema (JSON cannot carry them, and the
   schema's description says so).
6. **Tweens stay as they are** — item 51's own measurement priced the
   CPU path's span traffic at 0.013–0.052 ms per post, 1/20th–1/50th of
   the 1 ms trigger; the GPU sink's frame-starving is item 68's.  With
   images and fonts built, item 51 is closed.

#### 6. Also

- `playwright-tests/worker-renderer.spec.js` passed `testInfo` to
  `writeDiffArtifacts`, which takes a directory, so a failing parity
  spec threw instead of writing its diff (fixed in 141.1, found by the
  controls).
- `src/render/image-decoder.mts` was factored (a scratch canvas that is
  an OffscreenCanvas without a document; `rasterVectorInPage`); the
  same-thread path is unchanged — the image and label goldens (visual
  project, 24) and renderer specs (26) green.
- `docs/agents/rendering.md` carries the worker-canvas lesson.

**Checks.**  Round 79's schema gate green with `workerFontFace`;
`test:types:run` (new `renderer.fonts` positives and two negatives),
`test:types:surface:run` (`WorkerFontFace` listed), `test:throws:quiet`,
the doc gates (`plan-record`, `agent-docs`, `feature-inventory`,
`status-features`, `migration-guide`) green; the worker spec on
Chromium 20 passed and 1 skipped (the unsupported-platform test), on
WebKit the mechanics test passed and the other 20 soft-skipped (no
adapter); `npm run -s test:node:quiet` green (zero output).
