# Round 131: Cloudflare's own runtime serving the headless build.
#
# `test/runtimes/workerd.mjs` starts `workerd serve` on this config (the
# socket address is given on the command line) and fetches the worker:
# its fetch handler (`workerd-main.mjs`) runs the cross-runtime smoke's
# checks against `build/cytoscape-headless.esm.min.mjs` — the artifact an
# edge deployment ships — and answers the assertion count, or a 500 with
# the failure.  Build first (`npm run test:runtimes:workerd` does).

using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ (name = "smoke", worker = .smokeWorker) ],
  sockets = [ (name = "http", http = (), service = "smoke") ],
);

const smokeWorker :Workerd.Worker = (
  modules = [
    (name = "main.mjs", esModule = embed "workerd-main.mjs"),
    (name = "smoke-checks.mjs", esModule = embed "smoke-checks.mjs"),
    (
      name = "cytoscape-headless.esm.min.mjs",
      esModule = embed "../../build/cytoscape-headless.esm.min.mjs"
    ),
  ],
  compatibilityDate = "2026-09-01",
);
