// Streaming integrated loudness measurement per ITU-R BS.1770 / EBU R128.
// K-weighting filter state and the overlapping 400 ms energy window are kept
// across push() calls, so callers can measure arbitrarily long exports without
// retaining the complete PCM signal in memory.

interface Coef {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
}

const PRE: Coef = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585,
};

const RLB: Coef = {
  b0: 1,
  b1: -2,
  b2: 1,
  a1: -1.99004745483398,
  a2: 0.99007225036621,
};

class BiquadState {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(private readonly coef: Coef) {}

  push(input: number): number {
    const { b0, b1, b2, a1, a2 } = this.coef;
    const output = b0 * input + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;
    return output;
  }
}

export interface LoudnessResult {
  readonly integratedLufs: number;
  readonly peakDbfs: number;
}

const BLOCK_SECONDS = 0.4;
const OVERLAP = 0.75;
const ABSOLUTE_GATE = -70;
const RELATIVE_GATE = -10;
const loudnessOf = (meanSquare: number): number => -0.691 + 10 * Math.log10(meanSquare);

export class LoudnessMeter {
  private readonly blockLength: number;
  private readonly step: number;
  private readonly energyWindow: Float64Array;
  private readonly filters: readonly { pre: BiquadState; rlb: BiquadState }[];
  private readonly meanSquares: number[] = [];
  private windowIndex = 0;
  private windowSum = 0;
  private samplesSeen = 0;
  private peak = 0;

  constructor(
    private readonly sampleRate = 48_000,
    channelCount = 2,
  ) {
    this.blockLength = Math.max(1, Math.round(BLOCK_SECONDS * sampleRate));
    this.step = Math.max(1, Math.round(this.blockLength * (1 - OVERLAP)));
    this.energyWindow = new Float64Array(this.blockLength);
    this.filters = Array.from({ length: Math.max(1, channelCount) }, () => ({
      pre: new BiquadState(PRE),
      rlb: new BiquadState(RLB),
    }));
  }

  push(pcm: Float32Array | readonly Float32Array[]): void {
    const channels = pcm instanceof Float32Array ? [pcm] : pcm;
    if (channels.length === 0) return;
    const length = Math.min(...channels.map((channel) => channel.length));
    const count = Math.min(channels.length, this.filters.length);
    for (let i = 0; i < length; i++) {
      let energy = 0;
      for (let channel = 0; channel < count; channel++) {
        const sample = channels[channel]![i] ?? 0;
        this.peak = Math.max(this.peak, Math.abs(sample));
        const filter = this.filters[channel]!;
        const weighted = filter.rlb.push(filter.pre.push(sample));
        energy += weighted * weighted;
      }

      this.windowSum -= this.energyWindow[this.windowIndex] ?? 0;
      this.energyWindow[this.windowIndex] = energy;
      this.windowSum += energy;
      this.windowIndex = (this.windowIndex + 1) % this.blockLength;
      this.samplesSeen++;
      if (
        this.samplesSeen >= this.blockLength &&
        (this.samplesSeen - this.blockLength) % this.step === 0
      ) {
        this.meanSquares.push(this.windowSum / this.blockLength);
      }
    }
  }

  result(): LoudnessResult {
    const peakDbfs = this.peak > 0 ? 20 * Math.log10(this.peak) : Number.NEGATIVE_INFINITY;
    const absolute = this.meanSquares.filter(
      (meanSquare) => meanSquare > 0 && loudnessOf(meanSquare) >= ABSOLUTE_GATE,
    );
    if (absolute.length === 0) {
      return { integratedLufs: Number.NEGATIVE_INFINITY, peakDbfs };
    }
    const absoluteMean = absolute.reduce((sum, value) => sum + value, 0) / absolute.length;
    const relativeThreshold = loudnessOf(absoluteMean) + RELATIVE_GATE;
    const relative = absolute.filter((meanSquare) => loudnessOf(meanSquare) >= relativeThreshold);
    if (relative.length === 0) {
      return { integratedLufs: Number.NEGATIVE_INFINITY, peakDbfs };
    }
    const relativeMean = relative.reduce((sum, value) => sum + value, 0) / relative.length;
    return { integratedLufs: loudnessOf(relativeMean), peakDbfs };
  }
}

export const measureLoudness = (
  pcm: Float32Array | readonly Float32Array[],
  sampleRate = 48_000,
): LoudnessResult => {
  const channelCount = pcm instanceof Float32Array ? 1 : Math.max(1, pcm.length);
  const meter = new LoudnessMeter(sampleRate, channelCount);
  meter.push(pcm);
  return meter.result();
};
