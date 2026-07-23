/*
Adaptive render-scale controller: moves the renderer's resolution between
a configured [min, max] pixel-ratio band (quarter steps) based on measured
GPU frame cost.

- While drawing continuously, frame times are collected into ~400 ms
  windows.  A window whose median GPU time exceeds the drop threshold (or
  whose backpressure-stall ratio is high, the fallback signal when
  'timestamp-query' is unavailable) steps the scale down.
- Raising is prediction-based: the scale only steps up when the median
  cost *projected* to the higher step (cost scales ~scale²) fits under a
  headroom threshold — so a raise that would immediately trigger a drop
  never happens (no pumping), plus a raise cooldown.
- Windows with too few frames make no decision: sparse render-on-dirty
  activity (an idle graph redrawing occasionally) never flaps the scale.
- `settleToMax()` is the idle path: shortly after drawing stops, the
  renderer re-renders one frame at max scale so still images are always
  full-resolution.

Pure and clock-injected, so it unit-tests in Node.
*/

const EVAL_WINDOW_MS = 400;
const RAISE_COOLDOWN_MS = 800;
/** a window needs at least this many ticks (drawn + stalled) to decide */
const MIN_TICKS = 5;
const MIN_GPU_SAMPLES = 3;
/** median GPU ms above this steps the scale down */
const DROP_MS = 14;
/** projected GPU ms at the higher step must be below this to step up */
const RAISE_HEADROOM_MS = 10;
/** stall fallback: this fraction of ticks skipped by backpressure steps down */
const STALL_DROP_RATIO = 0.25;
/** stall fallback: consecutive clean windows required to step up */
const CLEAN_WINDOWS_TO_RAISE = 2;
const SCALE_STEP = 0.25;

export class ScaleController {
  readonly min: number;
  readonly max: number;
  /** descending scale steps, max first */
  readonly steps: number[];

  private idx: number; // current index into steps (0 = max)
  private windowStart: number;
  private drawn: number;
  private stalls: number;
  private samples: number[];
  private cleanWindows: number;
  private lastRaiseAt: number;

  constructor( min: number = 0.5, max: number = 1 ){
    const lo = Math.min( 1, Math.max( 0.25, Math.min( min, max ) ) );
    const hi = Math.min( 1, Math.max( lo, Math.max( min, max ) ) );

    this.min = lo;
    this.max = hi;
    this.steps = [];

    for( let s = hi; s > lo + 1e-9; s -= SCALE_STEP ){
      this.steps.push( Math.round( s * 100 ) / 100 );
    }

    this.steps.push( lo );

    this.idx = 0;
    this.windowStart = 0;
    this.drawn = 0;
    this.stalls = 0;
    this.samples = [];
    this.cleanWindows = 0;
    this.lastRaiseAt = -Infinity;
  }

  get scale(): number {
    return this.steps[ this.idx ];
  }

  /** A frame was drawn; gpuMs is 0 when GPU timing is unavailable.
   * Returns the new scale when this tick changed it, else null. */
  frameDrawn( now: number, gpuMs: number ): number | null {
    this.tick( now );
    this.drawn++;

    if( gpuMs > 0 ){ this.samples.push( gpuMs ); }

    return this.evaluate( now );
  }

  /** The render loop skipped encoding because the GPU was behind. */
  frameStalled( now: number ): number | null {
    this.tick( now );
    this.stalls++;

    return this.evaluate( now );
  }

  /** Idle path: jump straight to max for a full-resolution still frame.
   * Returns the new scale, or null when already at max. */
  settleToMax(): number | null {
    if( this.idx === 0 ){ return null; }

    this.idx = 0;
    this.resetWindow( this.windowStart );

    return this.scale;
  }

  private tick( now: number ): void {
    if( this.drawn + this.stalls === 0 ){
      this.windowStart = now;
    }
  }

  private evaluate( now: number ): number | null {
    if( now - this.windowStart < EVAL_WINDOW_MS ){ return null; }

    const ticks = this.drawn + this.stalls;
    const stallRatio = this.stalls / ticks;
    const haveGpu = this.samples.length >= MIN_GPU_SAMPLES;
    const med = median( this.samples );
    let next: number | null = null;

    if( ticks >= MIN_TICKS ){
      if( ( haveGpu && med > DROP_MS ) || stallRatio > STALL_DROP_RATIO ){
        if( this.idx < this.steps.length - 1 ){
          this.idx++;
          next = this.scale;
        }

        this.cleanWindows = 0;
      } else if( this.idx > 0 && now - this.lastRaiseAt >= RAISE_COOLDOWN_MS ){
        if( haveGpu ){
          const up = this.steps[ this.idx - 1 ];
          const projected = med * ( up / this.scale ) * ( up / this.scale );

          if( projected < RAISE_HEADROOM_MS ){
            this.idx--;
            next = this.scale;
            this.lastRaiseAt = now;
          }
        } else if( stallRatio === 0 ){
          this.cleanWindows++;

          if( this.cleanWindows >= CLEAN_WINDOWS_TO_RAISE ){
            this.idx--;
            next = this.scale;
            this.lastRaiseAt = now;
            this.cleanWindows = 0;
          }
        }
      }
    }

    this.resetWindow( now );

    return next;
  }

  private resetWindow( now: number ): void {
    this.windowStart = now;
    this.drawn = 0;
    this.stalls = 0;
    this.samples = [];
  }
}

function median( values: number[] ): number {
  if( values.length === 0 ){ return 0; }

  const sorted = values.slice().sort( ( a, b ) => a - b );

  return sorted[ Math.floor( sorted.length / 2 ) ];
}
