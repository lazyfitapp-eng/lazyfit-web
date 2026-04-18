// Science-backed warm-up set generator
// Based on: Kraemer & Ratamess (2004), Dr. Mike Israetel / RP Strength guidelines,
//           Robbins (2005) PAP research, Tillin & Bishop (2009)
//
// Principles:
// 1. Graded loading from ~40% to ~80-85% of working weight
// 2. High reps at low % (blood flow, motor pattern grooming)
// 3. Very low reps (1-2) close to working weight (PAP, no fatigue)
// 4. Final warm-up rest = 2.5 min (full CNS recovery before working set)
// 5. No warm-ups needed below 30kg — the weight itself IS the warm-up load

export type WarmupSet = {
  weight: number       // kg, rounded to nearest 2.5
  reps: number         // target reps (not a range — warm-ups are prescriptive)
  restSeconds: number  // rest after THIS set before the next
}

function round2p5(w: number): number {
  return Math.max(2.5, Math.round(w / 2.5) * 2.5)
}

/**
 * Compute warm-up sets for a given working weight.
 * Returns an empty array if the working weight is too light to need warming up.
 * The last set in the returned array always has restSeconds = 150 (2.5 min)
 * to allow full CNS recovery before the first working set.
 */
export function computeWarmupSets(workingWeight: number): WarmupSet[] {
  if (workingWeight < 30) return []

  if (workingWeight < 60) {
    // 2 warm-ups: 50% × 8, 70% × 3
    return [
      { weight: round2p5(workingWeight * 0.50), reps: 8, restSeconds: 45 },
      { weight: round2p5(workingWeight * 0.70), reps: 3, restSeconds: 150 },
    ]
  }

  if (workingWeight < 100) {
    // 3 warm-ups: 40% × 8, 60% × 5, 80% × 2
    return [
      { weight: round2p5(workingWeight * 0.40), reps: 8, restSeconds: 60 },
      { weight: round2p5(workingWeight * 0.60), reps: 5, restSeconds: 60 },
      { weight: round2p5(workingWeight * 0.80), reps: 2, restSeconds: 150 },
    ]
  }

  if (workingWeight < 140) {
    // 3 warm-ups: 40% × 6, 60% × 4, 80% × 2
    return [
      { weight: round2p5(workingWeight * 0.40), reps: 6, restSeconds: 60 },
      { weight: round2p5(workingWeight * 0.60), reps: 4, restSeconds: 60 },
      { weight: round2p5(workingWeight * 0.80), reps: 2, restSeconds: 150 },
    ]
  }

  // 4 warm-ups for very heavy lifts: 35% × 6, 50% × 4, 70% × 3, 85% × 1
  return [
    { weight: round2p5(workingWeight * 0.35), reps: 6, restSeconds: 60 },
    { weight: round2p5(workingWeight * 0.50), reps: 4, restSeconds: 60 },
    { weight: round2p5(workingWeight * 0.70), reps: 3, restSeconds: 60 },
    { weight: round2p5(workingWeight * 0.85), reps: 1, restSeconds: 150 },
  ]
}
