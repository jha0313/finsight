export function interpolate(from: number, to: number, progress: number): number {
  const clamped = clamp01(progress);

  return from + (to - from) * clamped;
}

export function easeOutCubic(t: number): number {
  const clamped = clamp01(t);

  return 1 - (1 - clamped) ** 3;
}

export function nextCarouselIndex(current: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  if (!Number.isInteger(current) || current < 0 || current >= length) {
    return 0;
  }

  return (current + 1) % length;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}
