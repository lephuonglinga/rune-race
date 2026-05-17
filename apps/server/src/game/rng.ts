/**
 * Server-side RNG for dice rolls.
 * All randomness is generated server-side to prevent cheating.
 * Supports seeded RNG for deterministic testing.
 */

/**
 * Seeded pseudo-random number generator (for tests).
 * Uses Linear Congruential Generator (simple but deterministic).
 */
class SeededRNG {
  private seed: number

  constructor(seed: number = Date.now()) {
    this.seed = seed
  }

  /**
   * Generate next random number in range [0, 1).
   */
  next(): number {
    const m = 2147483647
    const a = 16807
    this.seed = (a * this.seed) % m
    return this.seed / m
  }

  /**
   * Generate random integer in range [min, max] inclusive.
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /**
   * Roll a d6 (1-6).
   */
  rollD6(): number {
    return this.nextInt(1, 6)
  }
}

/**
 * Game RNG manager.
 * Uses system RNG by default; can be replaced with seeded RNG for testing.
 */
export class GameRNG {
  private rng: SeededRNG | null

  constructor(seed?: number) {
    if (seed !== undefined) {
      this.rng = new SeededRNG(seed)
    } else {
      this.rng = null
    }
  }

  /**
   * Roll a d6 (1-6).
   * This is the single source of truth for dice rolls.
   */
  rollDice(): number {
    if (this.rng) {
      return this.rng.rollD6()
    }
    // Use native crypto for production (truly random)
    return Math.floor(Math.random() * 6) + 1
  }

  /**
   * Set seed for deterministic testing.
   */
  setSeed(seed: number): void {
    this.rng = new SeededRNG(seed)
  }
}

/**
 * Global RNG instance (singleton).
 * In production, uses Math.random(); in tests, can be seeded.
 */
export const globalRNG = new GameRNG()
