export type PlannedWorkoutExercise = {
  exercise_name: string
  sets_target: number | null
}

export type LoggedWorkoutSet = {
  exercise_name: string
  set_type?: string | null
}

export type WorkoutCompletionStatus = {
  loggedWorkingSets: number
  plannedWorkingSets: number
  isPlannedWorkout: boolean
  isComplete: boolean
  isPartial: boolean
}

export function isWorkingSet(set: LoggedWorkoutSet): boolean {
  return set.set_type !== 'warmup'
}

export function getWorkoutCompletionStatus(
  plannedExercises: PlannedWorkoutExercise[],
  loggedSets: LoggedWorkoutSet[]
): WorkoutCompletionStatus {
  const plannedWorkingSets = plannedExercises.reduce(
    (sum, exercise) => sum + Math.max(0, exercise.sets_target ?? 0),
    0
  )
  const loggedWorkingSets = loggedSets.filter(isWorkingSet).length
  const isPlannedWorkout = plannedWorkingSets > 0

  if (!isPlannedWorkout) {
    return {
      loggedWorkingSets,
      plannedWorkingSets,
      isPlannedWorkout,
      isComplete: loggedWorkingSets > 0,
      isPartial: false,
    }
  }

  const loggedByExercise = new Map<string, number>()
  for (const set of loggedSets) {
    if (!isWorkingSet(set)) continue
    loggedByExercise.set(set.exercise_name, (loggedByExercise.get(set.exercise_name) ?? 0) + 1)
  }

  const missingPlannedWork = plannedExercises.some(exercise =>
    (loggedByExercise.get(exercise.exercise_name) ?? 0) < Math.max(0, exercise.sets_target ?? 0)
  )

  return {
    loggedWorkingSets,
    plannedWorkingSets,
    isPlannedWorkout,
    isComplete: !missingPlannedWork,
    isPartial: missingPlannedWork,
  }
}
