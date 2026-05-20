/**
 * 1D One Euro Filter (Casiez et al.) — low lag when moving, strong smoothing at rest.
 * @see https://cristal.univ-lille.fr/~casiez/1euro/
 */

function smoothingFactor(cutoff, tE) {
  const te = Math.max(tE, 1e-9);
  const tau = 1.0 / (2 * Math.PI * cutoff);
  return 1.0 / (1.0 + tau / te);
}

export class OneEuroFilter1D {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  /**
   * @param {number} x measurement
   * @param {number} t time in seconds (monotonic)
   */
  filter(x, t) {
    if (!Number.isFinite(x) || !Number.isFinite(t)) {
      this.reset();
      return x;
    }

    if (this.tPrev === null) {
      this.tPrev = t;
      this.xPrev = x;
      return x;
    }

    const dt = Math.max(t - this.tPrev, 1e-6);
    const dx = (x - this.xPrev) / dt;
    const ad = smoothingFactor(this.dCutoff, dt);
    this.dxPrev = ad * dx + (1 - ad) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev);
    const ax = smoothingFactor(cutoff, dt);
    const xHat = ax * x + (1 - ax) * this.xPrev;
    this.xPrev = xHat;
    this.tPrev = t;
    return xHat;
  }
}
