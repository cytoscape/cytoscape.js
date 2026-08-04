// @ts-check
import { defineConfig, devices, chromium } from '@playwright/test';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const parallelism = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;

/* See the renderer project comment: Linux needs ANGLE-on-Vulkan compositing
 * for WebGPU canvases to present; macOS (Metal) must not get these flags. */
const linuxVulkanCompositingArgs = process.platform === 'linux'
  ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan']
  : [];

/* GPU_DEBUG=1: dump the GPU process log to stderr for CI diagnosis. */
const gpuDebugArgs = process.env.GPU_DEBUG
  ? ['--enable-logging=stderr', '--v=1']
  : [];

/*
 * On GPU-less Linux CI, the ANGLE-on-Vulkan path above lands on whatever
 * system Vulkan driver the runner image ships (Mesa lavapipe), which does
 * not composite WebGPU canvases (blank presentation) and has crashed the
 * GPU process outright on some image versions.  Pin the Vulkan loader to
 * the SwiftShader ICD bundled with Chrome for Testing instead: rendering,
 * presentation and readback all work on it, and it is the same software
 * rasterizer the visual goldens are pinned to — deterministic and
 * independent of runner-image Mesa churn.  CI-gated so local runs keep
 * using the real GPU.
 */
if( process.platform === 'linux' && process.env.CI ){
  try {
    const icd = path.join( path.dirname( chromium.executablePath() ), 'vk_swiftshader_icd.json' );

    if( fs.existsSync( icd ) ){
      process.env.VK_ICD_FILENAMES = icd; // legacy loader var
      process.env.VK_DRIVER_FILES = icd;
    }
  } catch {
    // no chromium install (e.g. listing tests); leave the env alone
  }
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './playwright-tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Use all available system threads locally and on CI. */
  workers: parallelism,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  projects: [
    /*
     * The v4 renderer.  channel 'chromium' is the new headless mode with
     * real GPU adapters (Metal on macOS); the swiftshader flag gives a
     * deterministic software fallback on CI.  Specs soft-skip when no
     * adapter is available.  Pages must load via http://127.0.0.1:3333 —
     * navigator.gpu is unavailable on about:blank.
     *
     * On Linux, WebGPU canvas *presentation* only composites when the GL
     * stack runs ANGLE-on-Vulkan (Dawn renders fine either way, but the
     * default GL compositor drops the shared-image canvas — adapters
     * acquire, pixels stay blank).  The vulkan flags select that path;
     * they are Linux-only because --use-angle=vulkan does not exist on
     * macOS (Metal) and would break the known-good default there.
     */
    {
      name: 'renderer',
      testMatch: /renderer\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader',
            ...linuxVulkanCompositingArgs, ...gpuDebugArgs],
        },
      },
    },

    /*
     * The same specs on WebKit (Safari's engine, WebGPU on Metal).  Specs
     * soft-skip when the build exposes no adapter, so this project is safe
     * wherever WebKit lacks WebGPU.
     */
    {
      name: 'renderer-webkit',
      testMatch: /renderer\.spec\.js/,
      use: { ...devices['Desktop Safari'] },
    },

    /*
     * Visual regression specs: golden diffs plus the live v3-vs-v4 parity
     * diffs.  Pinned to the SwiftShader software adapter so the
     * rasterization — and therefore the checked-in goldens — is
     * deterministic across machines (a hardware adapter would produce
     * per-GPU AA differences).  Regenerate goldens with UPDATE_GOLDENS=1.
     *
     * The parity half additionally needs v3's UMD bundle, built from the
     * v3/ subproject: `cd v3 && npm install && npm run build:umd`.  The
     * specs fail with that instruction rather than skipping, so a missing
     * baseline cannot read as a pass.
     */
    {
      name: 'visual',
      testMatch: /visual\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--enable-unsafe-swiftshader',
            ...linuxVulkanCompositingArgs, ...gpuDebugArgs,
            '--use-webgpu-adapter=swiftshader',
          ],
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run test:playwright:setup',
    url: 'http://127.0.0.1:3333',
    reuseExistingServer: !process.env.CI,
  },
});
