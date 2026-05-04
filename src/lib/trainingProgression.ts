import {
  DELOAD_FACTOR,
  DELOAD_PERCENT_LABEL,
  EXERCISE_TYPE,
  WEIGHT_INCREMENT,
  isBodyweightExercise,
} from './progressionConfig'

export type ExerciseTarget = {
  weight: number
  repsMin: number
  repsMax: number
  consecutiveMax: number
  consecutiveFail: number
}

export type SessionSet = {
  weight: number
  reps: number
}

export type WorkingSetInput = {
  weight: string | number
  reps: string | number
}

export type ProgressionDecision = {
  currentWeight: number
  nextWeight: number
  consecutiveMax: number
  consecutiveFail: number
  allHitMax: boolean
  set1FailedMin: boolean
  outcome: 'same' | 'level_up' | 'deload'
}

export type CoachStateKind =
  | 'first_session'
  | 'building'
  | 'confirm'
  | 'level_up'
  | 'deload'

export type ActiveWorkoutCoachState = {
  kind: CoachStateKind
  badgeLabel: string
  tone: 'green' | 'amber' | 'red'
  todayTarget: string
  successRule: string
  why: string
  nextOutcome: string
  canRepeatPreviousLoad: boolean
  partialContext: boolean
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

export function formatExerciseLoad(exerciseName: string, weight: number): string {
  if (isBodyweightExercise(exerciseName)) {
    if (weight === 0) return 'bodyweight'
    if (weight > 0) return `+${formatNumber(weight)} kg added`
  }

  return `${formatNumber(weight)} kg`
}

export function buildProgressionSetWeights(topWeight: number, totalSets: number): number[] {
  return Array.from({ length: totalSets }, (_, i) => {
    if (i === 0) return topWeight
    if (i === 1) return Math.round(topWeight * 0.90 / 2.5) * 2.5
    return Math.round(topWeight * 0.80 / 2.5) * 2.5
  })
}

export function deriveExerciseProgressionDecision({
  exerciseName,
  repsMin,
  repsMax,
  workingSets,
  previousConsecutiveMax = 0,
  previousConsecutiveFail = 0,
}: {
  exerciseName: string
  repsMin: number
  repsMax: number
  workingSets: WorkingSetInput[]
  previousConsecutiveMax?: number
  previousConsecutiveFail?: number
}): ProgressionDecision | null {
  const currentWeight = Number(workingSets[0]?.weight)
  if (!Number.isFinite(currentWeight)) return null
  if (!isBodyweightExercise(exerciseName) && currentWeight <= 0) return null
  if (isBodyweightExercise(exerciseName) && currentWeight < 0) return null

  let consecutiveMax = previousConsecutiveMax
  let consecutiveFail = previousConsecutiveFail

  const allHitMax = workingSets.every(set => Number(set.reps) >= repsMax)
  const set1FailedMin = Number(workingSets[0]?.reps) < repsMin

  if (allHitMax) {
    consecutiveMax += 1
    consecutiveFail = 0
  } else if (set1FailedMin) {
    consecutiveFail += 1
    consecutiveMax = 0
  }

  let nextWeight = currentWeight
  let outcome: ProgressionDecision['outcome'] = 'same'

  if (consecutiveFail >= 3) {
    nextWeight = Math.round(currentWeight * DELOAD_FACTOR / 2.5) * 2.5
    consecutiveFail = 0
    consecutiveMax = 0
    outcome = 'deload'
  } else if (consecutiveMax >= 2) {
    const increment = WEIGHT_INCREMENT[EXERCISE_TYPE[exerciseName] ?? 'isolation']
    nextWeight = currentWeight + increment
    consecutiveMax = 0
    outcome = 'level_up'
  }

  return {
    currentWeight,
    nextWeight,
    consecutiveMax,
    consecutiveFail,
    allHitMax,
    set1FailedMin,
    outcome,
  }
}

function formatTargetList(
  exerciseName: string,
  targets: Record<number, Pick<ExerciseTarget, 'weight'>> | undefined,
  setsTarget: number
): string {
  const loads: string[] = []
  for (let setNumber = 1; setNumber <= Math.min(setsTarget, 3); setNumber += 1) {
    const target = targets?.[setNumber]
    if (!target) continue
    loads.push(formatExerciseLoad(exerciseName, target.weight))
  }

  if (loads.length === 0) return 'choose a controlled load'

  const suffix = setsTarget > loads.length ? ` +${setsTarget - loads.length} more` : ''
  return `${loads.join(' / ')}${suffix}`
}

export function deriveActiveWorkoutCoachState({
  exerciseName,
  setsTarget,
  repsMin,
  repsMax,
  targets,
  lastCompleteSession,
  hasPartialContext = false,
}: {
  exerciseName: string
  setsTarget: number
  repsMin: number
  repsMax: number
  targets?: Record<number, ExerciseTarget>
  lastCompleteSession?: Record<number, SessionSet>
  hasPartialContext?: boolean
}): ActiveWorkoutCoachState {
  const set1Target = targets?.[1]
  const lastSet1 = lastCompleteSession?.[1]
  const consecutiveMax = set1Target?.consecutiveMax ?? 0
  const consecutiveFail = set1Target?.consecutiveFail ?? 0
  const hasTarget = Boolean(set1Target)
  const targetWeight = set1Target?.weight
  const lastWeight = lastSet1?.weight
  const increment = WEIGHT_INCREMENT[EXERCISE_TYPE[exerciseName] ?? 'isolation']
  const nextIncreaseTarget = targetWeight !== undefined
    ? formatExerciseLoad(exerciseName, targetWeight + increment)
    : null

  let kind: CoachStateKind = 'building'

  if (!hasTarget) {
    kind = 'first_session'
  } else if (
    targetWeight !== undefined &&
    lastWeight !== undefined &&
    targetWeight < lastWeight - 0.01
  ) {
    kind = 'deload'
  } else if (
    targetWeight !== undefined &&
    lastWeight !== undefined &&
    targetWeight > lastWeight + 0.01
  ) {
    kind = 'level_up'
  } else if (consecutiveMax >= 1) {
    kind = 'confirm'
  }

  const todayTarget = `${formatTargetList(exerciseName, targets, setsTarget)} x ${repsMin}-${repsMax} reps`
  const successRule = `Complete all ${setsTarget} planned working sets. Two complete top-range sessions increase load; three fail sessions reset; partial sessions do not count.`

  if (kind === 'first_session') {
    return {
      kind,
      badgeLabel: 'First session',
      tone: 'amber',
      todayTarget,
      successRule,
      why: 'No complete program session exists for this lift yet.',
      nextOutcome: 'A complete session creates the baseline; top-range work can bank 1/2.',
      canRepeatPreviousLoad: false,
      partialContext: hasPartialContext,
    }
  }

  if (kind === 'level_up') {
    return {
      kind,
      badgeLabel: 'Level up',
      tone: 'green',
      todayTarget,
      successRule,
      why: 'The last complete sessions satisfied the 2/2 top-range rule.',
      nextOutcome: 'Complete this new target to start the next 2-session count.',
      canRepeatPreviousLoad: Boolean(lastCompleteSession && Object.keys(lastCompleteSession).length > 0),
      partialContext: hasPartialContext,
    }
  }

  if (kind === 'deload') {
    return {
      kind,
      badgeLabel: 'Reset',
      tone: 'red',
      todayTarget,
      successRule,
      why: `Three fail sessions triggered the ${DELOAD_PERCENT_LABEL} reset.`,
      nextOutcome: 'Complete the reset target to rebuild with clean reps.',
      canRepeatPreviousLoad: false,
      partialContext: hasPartialContext,
    }
  }

  if (kind === 'confirm') {
    return {
      kind,
      badgeLabel: 'Confirm',
      tone: 'amber',
      todayTarget,
      successRule,
      why: `${consecutiveMax}/2 complete top-range sessions are banked at this target.`,
      nextOutcome: nextIncreaseTarget
        ? `Hit the top range again today and next target becomes ${nextIncreaseTarget}.`
        : 'Hit the top range again today and the next target increases.',
      canRepeatPreviousLoad: false,
      partialContext: hasPartialContext,
    }
  }

  return {
    kind,
    badgeLabel: 'Lock in',
    tone: 'amber',
    todayTarget,
    successRule,
    why: consecutiveFail > 0
      ? `${consecutiveFail}/3 fail sessions are recorded; own this target before it resets.`
      : 'Stay here until complete sessions prove the top of the rep range.',
    nextOutcome: consecutiveFail >= 2
      ? `Miss Set 1 under ${repsMin} reps again and the next target resets.`
      : 'Top-range completion banks 1/2; partial sessions leave targets unchanged.',
    canRepeatPreviousLoad: false,
    partialContext: hasPartialContext,
  }
}
