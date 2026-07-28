const DEFAULT_WINDOW_SIZE = 60;

function normalizedValue(value) {
  let number = Number(value);

  if ( !Number.isFinite(number) || number < 0 ) {
    return 0;
  }

  return number;
}

export default class RollingRms {
  constructor(windowSize=DEFAULT_WINDOW_SIZE) {
    this.windowSize = Math.max(1, Number(windowSize) || DEFAULT_WINDOW_SIZE);
    this.samples = [];
    this.sumSquares = 0;
  }

  push(value) {
    let sample = normalizedValue(value);

    this.samples.push(sample);
    this.sumSquares += sample * sample;

    if ( this.samples.length > this.windowSize ) {
      let removed = this.samples.shift();

      this.sumSquares -= removed * removed;
    }

    // Floating point subtraction can leave a very small negative remainder.
    if ( this.sumSquares < 0 && this.sumSquares > -1e-9 ) {
      this.sumSquares = 0;
    }

    return this.rms;
  }

  get rms() {
    if ( !this.samples.length ) {
      return 0;
    }

    return Math.sqrt(this.sumSquares / this.samples.length);
  }

  toArray(padToWindow=false) {
    let output = this.samples.slice();

    if ( padToWindow && output.length < this.windowSize ) {
      output = new Array(this.windowSize - output.length).fill(0).concat(output);
    }

    return output;
  }
}

export { DEFAULT_WINDOW_SIZE };
