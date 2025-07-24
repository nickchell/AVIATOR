// Auto-generated realistic multiplier list

let lastMultiplier: number | null = null;

function getRandom(): number {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
  }
  return Math.random();
}

/**
 * Generates a crash multiplier following an exponential distribution with:
 * - Most values between 1.01x and 2x
 * - Rare huge multipliers (100x-500x, 0.1% chance)
 * - 10% house edge
 * - Clamped between 1.01x and 500x
 * - No consecutive repeats
 * - Unpredictable RNG
 */
export function generateCrashMultiplier(): number {
  const HOUSE_EDGE = 0.1;
  const MIN_MULTIPLIER = 1.01;
  const MAX_MULTIPLIER = 500;
  const HUGE_MULTIPLIER_CHANCE = 0.001; // 0.1%

  let multiplier: number;

  do {
    const rng = getRandom();

    // Rare huge multiplier
    if (rng < HUGE_MULTIPLIER_CHANCE) {
      multiplier = 100 + getRandom() * (MAX_MULTIPLIER - 100);
    } else {
      // Exponential-like distribution with house edge
      const payout = (1 - HOUSE_EDGE) / (1 - getRandom());
      multiplier = Math.max(MIN_MULTIPLIER, Math.min(payout, MAX_MULTIPLIER));
    }

    // Round to 2 decimals
    multiplier = Math.round(multiplier * 100) / 100;
  } while (multiplier === lastMultiplier);

  lastMultiplier = multiplier;
  return multiplier;
}
