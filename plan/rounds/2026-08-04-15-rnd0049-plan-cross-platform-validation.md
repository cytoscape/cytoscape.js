## Cross-platform validation

- The matrix, run and recorded: macOS/Metal (the goldens'
  cross-platform claim re-verified), Windows/D3D12, WebKit and
  Firefox WebGPU status with a soft-skip audit (a skip is recorded,
  never silent), real-device touch (Android Chrome — the round-20
  gestures on actual fingers).  Per-platform goldens remain the
  reserve escape hatch if CI disagrees.
- Standing rule applied: no "blocked, no adapter here" conclusion
  without probing from a served page — the mistake this file has
  corrected twice.
