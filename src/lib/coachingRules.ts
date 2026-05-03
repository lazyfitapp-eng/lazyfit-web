// ── Coaching Rules ────────────────────────────────────────────────────────────
import { DELOAD_PERCENT_LABEL } from './progressionConfig'

// Config-driven, priority-sorted, condition-based coaching cards.
// Not hardcoded in the UI — rules live here and rotate based on user state.

export interface CoachingInput {
  userName: string
  goal: 'cut' | 'bulk' | 'recomp'
  totalSessions: number
  weeksActive: number
  currentStreakWeeks: number
  bestStreakWeeks: number
  /** PRs set in the last 30 days */
  recentPRCount: number
  /** Exercise with 3+ consecutive sessions declining — null if none */
  stalledExercise: string | null
  /** Average daily calories as % of target this week (0–1+) */
  weeklyAvgCalPct: number
  weeklyAvgProtPct: number
  /** Days since the last completed workout */
  daysSinceLastWorkout: number
}

export type CoachingBadge = 'ach' | 'enc' | 'act' | 'ori'

export interface CoachingCard {
  badge: CoachingBadge
  badgeLabel: string
  headline: string
  body: string
}

interface CoachingRule {
  id: string
  priority: number
  condition: (input: CoachingInput) => boolean
  card: (input: CoachingInput) => CoachingCard
}

const rules: CoachingRule[] = [
  // ── 1. Comeback — highest priority, user has gone dark ────────────────────
  {
    id: 'comeback',
    priority: 100,
    condition: (i) => i.daysSinceLastWorkout >= 10,
    card: (i) => ({
      badge: 'enc',
      badgeLabel: '💙 Encouragement',
      headline: `${i.userName}, every comeback starts with one session.`,
      body: `You haven't trained in <strong>${i.daysSinceLastWorkout} days</strong>. Life happens — that's not failure. Failure is letting the gap become permanent. One session today and the streak restarts. You don't need motivation. You need <em>the first rep</em>.`,
    }),
  },

  // ── 2. PR Streak — user is on fire ────────────────────────────────────────
  {
    id: 'pr_streak',
    priority: 90,
    condition: (i) => i.recentPRCount >= 2 && i.totalSessions >= 8,
    card: (i) => ({
      badge: 'ach',
      badgeLabel: '🏆 Achievement',
      headline: `${i.userName}, you're in a peak phase right now.`,
      body: `<strong>${i.recentPRCount} PRs in the last 30 days.</strong> This is what progressive overload looks like in practice — not motivation, not genetics. Consistent, intelligent work appearing on the bar.${i.stalledExercise ? `<br><br>Your ${i.stalledExercise} has stalled. That's not failure — that's your nervous system asking for a <em>strategic deload</em>. Drop to ${DELOAD_PERCENT_LABEL} next session, then come back and watch it break through.` : ''}`,
    }),
  },

  // ── 3. Deload — stalled exercise with no recent PRs ───────────────────────
  {
    id: 'deload',
    priority: 80,
    condition: (i) => i.stalledExercise !== null && i.totalSessions >= 8,
    card: (i) => ({
      badge: 'act',
      badgeLabel: '⚡ Action',
      headline: `${i.userName}, your ${i.stalledExercise} is asking for a break.`,
      body: `3 weeks at the same weight is a signal, not a failure. Your central nervous system is fatigued. <strong>Take one deload session</strong> — drop to ${DELOAD_PERCENT_LABEL} on ${i.stalledExercise}, full range of motion, controlled tempo. Come back the week after and <em>watch it break through</em>.`,
    }),
  },

  // ── 4. Recomp confirmation — goal + sufficient sessions ───────────────────
  {
    id: 'recomp',
    priority: 70,
    condition: (i) => i.goal === 'recomp' && i.totalSessions >= 12,
    card: (i) => ({
      badge: 'ach',
      badgeLabel: '🏆 Achievement',
      headline: `${i.userName}, recomposition is the hardest goal. You're doing it.`,
      body: `Gaining muscle while losing fat requires a precision most people never achieve. Your training consistency is the engine. <strong>Protein is the fuel.</strong> If your waist is trending down while the bar goes up, you're winning exactly the right battle. <em>Keep going.</em>`,
    }),
  },

  // ── 5. Streak milestone — personal best streak ────────────────────────────
  {
    id: 'streak_milestone',
    priority: 60,
    condition: (i) =>
      i.currentStreakWeeks > 0 &&
      i.currentStreakWeeks >= i.bestStreakWeeks &&
      i.currentStreakWeeks >= 4,
    card: (i) => ({
      badge: 'ach',
      badgeLabel: '🏆 Achievement',
      headline: `${i.currentStreakWeeks} weeks straight. Personal best, ${i.userName}.`,
      body: `You've never been this consistent. <strong>${i.currentStreakWeeks} consecutive weeks</strong> without missing a training block. This isn't streak-chasing — this is identity. You're becoming someone who simply <em>doesn't miss</em>.`,
    }),
  },

  // ── 6. Early — orientation for new users ──────────────────────────────────
  {
    id: 'early',
    priority: 50,
    condition: (i) => i.totalSessions < 8,
    card: (i) => ({
      badge: 'ori',
      badgeLabel: '⭐ Orientation',
      headline: `${i.userName}, here's your game plan for the next 4 weeks.`,
      body: `Right now your job is simple: <strong>show up 3 times a week and log everything</strong>. Don't chase PRs yet. Your nervous system is still learning the patterns.<br><br>From week 3, start pushing <em>Set 1 to your real limit</em>. That's your working set — the one that drives all your progress. Set 2 and 3 are just volume. Hit Set 1 hard and the numbers will follow.`,
    }),
  },

  // ── 7. Default — always matches ───────────────────────────────────────────
  {
    id: 'default',
    priority: 0,
    condition: () => true,
    card: (i) => ({
      badge: 'enc',
      badgeLabel: '💙 Encouragement',
      headline: `${i.userName}, consistency is the only strategy that works.`,
      body: `There's no magic program, no perfect split, no optimal rep range that overrides <strong>showing up week after week</strong>. The athletes with the best results aren't the most talented — they're the most reliable. <em>Be the person who shows up.</em>`,
    }),
  },
]

export function getCoachingCard(input: CoachingInput): CoachingCard {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  const matched = sorted.find((r) => r.condition(input))
  return (matched ?? rules[rules.length - 1]).card(input)
}
