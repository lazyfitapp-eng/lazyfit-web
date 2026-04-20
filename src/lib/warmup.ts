// ── Warm-up set generator ─────────────────────────────────────────────────────
// Generates exactly 3 warm-up sets for a given working weight.
// Protocol: 50% × 8 / 70% × 5 / 85% × 3
// W1 minimum: 20kg (empty barbell floor)
// Rest: 60s / 90s / 150s — last set always 150s (PAP window before first working set)
//
// The CALLER is responsible for only invoking this on PRIMARY_COMPOUNDS exercises
// (see progressionConfig.ts). This function has no exercise-name awareness.
//
// Returns [] if workingWeight is 0 or falsy (handles first-session / no-target case).

export type WarmupSet = {
  weight: number       // kg, rounded to nearest 2.5
  reps: number         // prescriptive target (not a range)
  restSeconds: number  // rest after THIS set before the next
}

function round2p5(w: number): number {
  return Math.round(w / 2.5) * 2.5
}

export function computeWarmupSets(workingWeight: number): WarmupSet[] {
  if (!workingWeight || workingWeight <= 0) return []

  return [
    { weight: Math.max(20, round2p5(workingWeight * 0.50)), reps: 8, restSeconds: 60  },
    { weight: round2p5(workingWeight * 0.70),                reps: 5, restSeconds: 90  },
    { weight: round2p5(workingWeight * 0.85),                reps: 3, restSeconds: 150 },
  ]
}
