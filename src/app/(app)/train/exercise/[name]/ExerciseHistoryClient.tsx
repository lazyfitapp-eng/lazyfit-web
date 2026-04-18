'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExerciseProgressChart from './ExerciseProgressChart'

export interface SessionSet {
  setNumber: number
  weightKg: number
  repsCompleted: number
  setType: string | null
}

export interface Session {
  workoutId: string
  date: string
  sets: SessionSet[]
  bestEst1RM: number
  bestSet: { weightKg: number; reps: number }
  isPR: boolean
}

interface Props {
  exerciseName: string
  sessions: Session[]
  allTimePR: { est1RM: number; weightKg: number; reps: number; date: string } | null
  muscle: string
  muscleColor: string
  prWorkoutId: string | null
}

const FF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
const CIRC = 188.5

// ── Week streak ────────────────────────────────────────────────────────────────

function calcWeekStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0

  function getMonday(d: Date): string {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    date.setDate(diff)
    return date.toISOString().split('T')[0]
  }

  const weeks = new Set(sessions.map(s => getMonday(new Date(s.date))))
  const sorted = [...weeks].sort().reverse()

  const currentWeek = getMonday(new Date())
  const lastWeek = getMonday(new Date(Date.now() - 7 * 86400000))

  if (sorted[0] !== currentWeek && sorted[0] !== lastWeek) return 0

  let streak = 0
  let expected = sorted[0]
  for (const week of sorted) {
    if (week === expected) {
      streak++
      const d = new Date(expected)
      d.setDate(d.getDate() - 7)
      expected = d.toISOString().split('T')[0]
    } else break
  }
  return streak
}

// ── SessionCard ────────────────────────────────────────────────────────────────

function SessionCard({
  session,
  isOpen,
  isToday,
  dateLabel,
  prWorkoutId,
  onToggle,
}: {
  session: Session
  isOpen: boolean
  isToday: boolean
  dateLabel: string
  prWorkoutId: string | null
  onToggle: () => void
}) {
  const firstWorkingIdx = session.sets.findIndex(s => s.setType !== 'warmup')
  const isPR = session.workoutId === prWorkoutId

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        background: isPR
          ? 'linear-gradient(145deg, #0c1a11 0%, #0a1510 40%, #090f0c 100%)'
          : '#0e0e0e',
        border: `1px solid ${isPR ? 'rgba(62,207,142,0.22)' : '#1a1a1a'}`,
      }}
    >
      {/* PR top shimmer line */}
      {isPR && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(62,207,142,0.4) 50%, transparent 100%)',
            zIndex: 1,
          }}
        />
      )}

      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flexShrink: 0,
            background: isPR ? '#3ecf8e' : '#2a2a2a',
            border: isPR ? '1px solid #3ecf8e' : '1px solid #333',
            boxShadow: isPR ? '0 0 8px rgba(62,207,142,0.5)' : 'none',
          }}
        />

        {/* Date + badges + best set */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isPR ? '#e8e8e8' : '#d0d0d0',
                letterSpacing: '-0.3px',
              }}
            >
              {dateLabel}
            </span>
            {isPR && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  color: '#3ecf8e',
                  background: 'rgba(62,207,142,0.1)',
                  border: '1px solid rgba(62,207,142,0.22)',
                  borderRadius: 5,
                  padding: '2px 6px',
                  textTransform: 'uppercase',
                }}
              >
                🏆 PR
              </span>
            )}
            {isToday && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  color: '#555555',
                  background: '#1a1a1a',
                  borderRadius: 5,
                  padding: '2px 6px',
                  textTransform: 'uppercase',
                }}
              >
                Today
              </span>
            )}
          </div>
          {session.bestSet.weightKg > 0 && (
            <span
              style={{
                fontSize: 11,
                color: isPR ? 'rgba(62,207,142,0.55)' : '#444444',
                letterSpacing: '-0.1px',
              }}
            >
              Best set: {session.bestSet.weightKg} kg × {session.bestSet.reps} reps
            </span>
          )}
        </div>

        {/* 1RM value + est 1RM label + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isPR ? '#3ecf8e' : '#f0f0f0',
                  letterSpacing: '-0.7px',
                  lineHeight: 1,
                }}
              >
                {session.bestEst1RM.toFixed(1)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: isPR ? 'rgba(62,207,142,0.5)' : '#555555',
                }}
              >
                kg
              </span>
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#383838',
                marginTop: 2,
              }}
            >
              est 1RM
            </div>
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isPR ? 'rgba(62,207,142,0.4)' : '#383838'}
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Expanded sets */}
      {isOpen && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${isPR ? 'rgba(62,207,142,0.1)' : '#161616'}` }}>
          <div style={{ display: 'flex', gap: 0, marginTop: 10, marginBottom: 4 }}>
            {['Set', 'Weight', 'Reps', 'Vol'].map(h => (
              <div
                key={h}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#333333',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                  width: h === 'Set' ? 40 : undefined,
                  flex: h === 'Set' ? undefined : 1,
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {session.sets.map((s, i) => {
            const isWarmup = s.setType === 'warmup'
            const isFirstWorking = i === firstWorkingIdx
            const vol = (s.weightKg * s.repsCompleted).toFixed(0)
            const textColor = isWarmup ? '#333' : isFirstWorking ? '#f0f0f0' : '#848484'
            const setLabelColor = isWarmup ? '#333' : isFirstWorking ? '#3ecf8e' : '#555'

            return (
              <div key={i} style={{ display: 'flex', gap: 0, padding: '5px 0' }}>
                <div
                  style={{
                    width: 40,
                    fontSize: 12,
                    fontWeight: isFirstWorking ? 700 : 400,
                    color: setLabelColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {isFirstWorking && (
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: '#3ecf8e',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {isWarmup ? `W${s.setNumber}` : s.setNumber}
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: isFirstWorking ? 700 : 400, color: textColor }}>
                  {s.weightKg} kg
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: isFirstWorking ? 700 : 400, color: textColor }}>
                  {s.repsCompleted}
                </div>
                <div style={{ flex: 1, fontSize: 12, color: isWarmup ? '#2a2a2a' : '#3a3a3a' }}>
                  {vol}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

function EmptyState({ exerciseName }: { exerciseName: string }) {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-1.5px', marginBottom: 12, lineHeight: 1.1 }}>
        {exerciseName}
      </div>
      <div style={{ fontSize: 15, color: '#555555' }}>No sessions logged yet.</div>
      <div style={{ fontSize: 13, color: '#3a3a3a', marginTop: 6 }}>
        Complete a workout that includes this exercise to see your progress here.
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExerciseHistoryClient({
  exerciseName,
  sessions,
  allTimePR,
  muscle,
  muscleColor,
  prWorkoutId,
}: Props) {
  const router = useRouter()
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set())
  const [sortDesc, setSortDesc] = useState(true)
  const [visibleCount, setVisibleCount] = useState(6)

  // ── Computed values ──
  const firstSession = sessions[0]
  const latestSession = sessions[sessions.length - 1]
  const currentEst1RM = latestSession?.bestEst1RM ?? 0
  const allTimePRVal = allTimePR?.est1RM ?? 0

  const daysTraining = firstSession
    ? (Date.now() - new Date(firstSession.date).getTime()) / 86400000
    : 0
  const weeksTraining = firstSession ? Math.max(1, Math.round(daysTraining / 7)) : 0
  const isEarlyPhase = daysTraining < 28

  // kgGained: compare first session to PR (not first to latest)
  // If user hit PR on day 1, use difference between current and PR instead
  const firstEst1RM = firstSession?.bestEst1RM ?? allTimePRVal
  const kgGained = allTimePRVal - firstEst1RM

  // For display purposes — how much has the user improved overall
  // If first session IS the PR, show 0 gracefully
  const hasProgression = kgGained >= 0.5
  const weeklyRate = hasProgression && weeksTraining > 0 ? kgGained / weeksTraining : 0

  const nextMilestone = Math.ceil((allTimePRVal + 0.001) / 5) * 5
  const prevMilestone = nextMilestone - 5
  const ringPct =
    sessions.length > 0
      ? Math.round(Math.min(99, Math.max(1, ((allTimePRVal - prevMilestone) / 5) * 100)))
      : 0
  const milestonePct = ringPct
  const weekStreak = calcWeekStreak(sessions)
  const ringOffset = Math.round(CIRC - (ringPct / 100) * CIRC)

  const trainingSince = firstSession
    ? new Date(firstSession.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  // Chart points — cumulative running max so line never goes down
  let runningMax = 0
  const chartPoints = sessions.map(s => {
    runningMax = Math.max(runningMax, s.bestEst1RM)
    return { date: new Date(s.date), est1RM: runningMax, isPR: s.isPR }
  })

  const { visibleSessions, hiddenCount, sessionLabels } = useMemo(() => {
    const sorted = sortDesc ? [...sessions].reverse() : [...sessions]
    const visible = sorted.slice(0, visibleCount)

    const dateCounts: Record<string, number> = {}
    visible.forEach(s => {
      const d = new Date(s.date).toDateString()
      dateCounts[d] = (dateCounts[d] ?? 0) + 1
    })

    const dateIndexes: Record<string, number> = {}
    const labels: Record<string, string> = {}
    visible.forEach(s => {
      const dateKey = new Date(s.date).toDateString()
      const count = dateCounts[dateKey] ?? 1
      dateIndexes[dateKey] = (dateIndexes[dateKey] ?? 0) + 1
      const formattedDate = new Date(s.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      labels[s.workoutId] =
        count > 1 ? `${formattedDate} (${dateIndexes[dateKey]} of ${count})` : formattedDate
    })

    return {
      visibleSessions: visible,
      hiddenCount: sorted.length - visible.length,
      sessionLabels: labels,
    }
  }, [sessions, sortDesc, visibleCount])

  // ── Dynamic CSS ──
  const animationCSS = `
    @keyframes rise { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
    @keyframes crown-glow {
      0%,100%{filter:drop-shadow(0 0 0px rgba(62,207,142,0))}
      50%{filter:drop-shadow(0 0 8px rgba(62,207,142,0.7))}
    }
    @keyframes ring-fill { to { stroke-dashoffset: ${ringOffset}; } }
    @keyframes bar-grow  { to { width: ${milestonePct}%; } }
    .lfe-a0 { animation: rise 0.6s ease 0.05s both }
    .lfe-a1 { animation: rise 0.6s ease 0.10s both }
    .lfe-a2 { animation: rise 0.6s ease 0.15s both }
    .lfe-a3 { animation: rise 0.6s ease 0.20s both }
    .lfe-a4 { animation: rise 0.6s ease 0.25s both }
    .lfe-a5 { animation: rise 0.6s ease 0.30s both }
    .lfe-a6 { animation: rise 0.6s ease 0.35s both }
    .lfe-shimmer { animation: shimmer 3.5s ease-in-out 1.2s infinite }
    .lfe-crown   { animation: crown-glow 2.5s ease-in-out 1s infinite }
    .lfe-ring-fill {
      stroke-dasharray: ${CIRC};
      stroke-dashoffset: ${CIRC};
      animation: ring-fill 1.4s cubic-bezier(0.4,0,0.2,1) 0.8s forwards;
    }
    .lfe-bar-fill { animation: bar-grow 1.2s cubic-bezier(0.4,0,0.2,1) 0.9s forwards; }
  `

  return (
    <div
      className="max-w-[430px] mx-auto"
      style={{
        fontFamily: FF,
        background: '#090909',
        minHeight: '100vh',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: animationCSS }} />

      {/* ── NAV ── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'rgba(9,9,9,0.92)',
          backdropFilter: 'blur(28px)',
          borderBottom: '1px solid #161616',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#141414', border: '1px solid #1e1e1e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#555555' }}>Your Progress</span>
        <div
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#141414', border: '1px solid #1e1e1e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="4" viewBox="0 0 16 4" fill="#555">
            <circle cx="2" cy="2" r="2" />
            <circle cx="8" cy="2" r="2" />
            <circle cx="14" cy="2" r="2" />
          </svg>
        </div>
      </nav>

      {sessions.length === 0 ? (
        <EmptyState exerciseName={exerciseName} />
      ) : (
        <>
          {/* ── IDENTITY HERO ── */}
          <div style={{ position: 'relative', padding: '30px 20px 0', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute', top: -60, left: -40,
                width: 320, height: 320,
                background: `radial-gradient(circle, ${muscleColor}28 0%, ${muscleColor}08 50%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
            <div
              className="lfe-a0"
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '2px',
                textTransform: 'uppercase', color: '#3ecf8e', marginBottom: 12,
              }}
            >
              {muscle} · Compound · RPT
            </div>
            <div
              className="lfe-a1"
              style={{
                fontSize: 42, fontWeight: 800, letterSpacing: '-2px',
                lineHeight: 0.95, color: '#f0f0f0', marginBottom: 10,
              }}
            >
              {exerciseName.split(' ').map((w, i) => (
                <span key={i} style={{ display: 'block' }}>{w}</span>
              ))}
            </div>
            <div className="lfe-a1" style={{ fontSize: 13, color: '#555555', marginBottom: 28 }}>
              {isEarlyPhase ? (
                <>
                  <em style={{ color: '#848484', fontStyle: 'normal', fontWeight: 500 }}>
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''} logged
                  </em>
                  {' · Started '}
                  <em style={{ color: '#848484', fontStyle: 'normal', fontWeight: 500 }}>
                    {trainingSince}
                  </em>
                </>
              ) : (
                <>
                  Training since{' '}
                  <em style={{ color: '#848484', fontStyle: 'normal', fontWeight: 500 }}>
                    {trainingSince}
                  </em>
                  {' · '}
                  <em style={{ color: '#848484', fontStyle: 'normal', fontWeight: 500 }}>
                    {sessions.length} sessions logged
                  </em>
                </>
              )}
            </div>
          </div>

          {/* ── PR CARD ── */}
          <div style={{ padding: '0 20px' }} className="lfe-a2">
            {allTimePR && (
              <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg, #0a1f14 0%, #071610 40%, #050f0a 100%)' }} />
                <div style={{ position: 'absolute', top: -40, right: -20, width: 260, height: 260, background: 'radial-gradient(circle, rgba(62,207,142,0.18) 0%, rgba(62,207,142,0.06) 45%, transparent 70%)', pointerEvents: 'none' }} />
                <div className="lfe-shimmer" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 30%, rgba(62,207,142,0.04) 50%, transparent 70%)' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 24, border: '1px solid rgba(62,207,142,0.2)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', padding: '22px 22px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="lfe-crown" style={{ fontSize: 16 }}>🏆</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(62,207,142,0.6)' }}>
                        Personal Record
                      </span>
                    </div>
                    <div style={{ fontSize: 64, fontWeight: 800, color: '#3ecf8e', letterSpacing: '-3px', lineHeight: 1 }}>
                      {allTimePR.est1RM.toFixed(1)}
                      <span style={{ fontSize: 28, fontWeight: 500, color: 'rgba(62,207,142,0.5)', letterSpacing: '-1px' }}>kg</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(62,207,142,0.45)', marginBottom: 16 }}>
                      Estimated one-rep max
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.18)', borderRadius: 8, padding: '6px 10px' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3ecf8e' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(62,207,142,0.75)' }}>
                        {allTimePR.weightKg} kg × {allTimePR.reps} reps ·{' '}
                        {new Date(allTimePR.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, paddingTop: 4 }}>
                    <div style={{ position: 'relative', width: 72, height: 72 }}>
                      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(62,207,142,0.1)" strokeWidth="3" />
                        <circle cx="36" cy="36" r="30" fill="none" stroke="#3ecf8e" strokeWidth="3" strokeLinecap="round" className="lfe-ring-fill" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#3ecf8e', letterSpacing: '-0.5px', lineHeight: 1 }}>{ringPct}%</div>
                        <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(62,207,142,0.45)', letterSpacing: '0.3px', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>
                          to<br />{nextMilestone}kg
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(62,207,142,0.5)', background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.15)', borderRadius: 7, padding: '4px 9px' }}>
                      Set {new Date(allTimePR.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── META ROW ── */}
          <div style={{ padding: '12px 20px 0' }} className="lfe-a3">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
              {[
                { label: 'Week Streak', display: `🔥 ${weekStreak}`, green: false },
                hasProgression
                  ? { label: 'kg gained', display: `+${kgGained.toFixed(1)}`, green: true }
                  : { label: 'Best Ever', display: `${allTimePRVal.toFixed(1)}`, green: true },
                { label: 'Weeks', display: String(weeksTraining), green: false },
              ].map((t, i) => (
                <div
                  key={i}
                  style={{
                    background: '#111111', border: '1px solid #1a1a1a',
                    borderRadius: 16, padding: '14px 0 13px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                >
                  <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.6px', color: t.green ? '#3ecf8e' : '#f0f0f0' }}>
                    {t.display}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3a3a3a' }}>
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CHART SECTION ── */}
          <div style={{ padding: '0 20px 24px' }} className="lfe-a4">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#555555', marginBottom: 2 }}>Current est. 1RM</div>
                <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.8px', lineHeight: 1, color: '#f0f0f0' }}>
                  {currentEst1RM.toFixed(1)}
                  <span style={{ fontSize: 20, fontWeight: 400, color: '#555555', letterSpacing: '-0.5px' }}> kg</span>
                </div>
              </div>
              {hasProgression ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#091510', border: '1px solid #1d3d28', borderRadius: 10, padding: '6px 11px' }}>
                    <span style={{ fontSize: 13, color: '#3ecf8e', fontWeight: 700 }}>↑</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#3ecf8e', letterSpacing: '-0.4px' }}>+{kgGained.toFixed(1)} kg</span>
                    <span style={{ fontSize: 11, color: 'rgba(62,207,142,0.4)' }}> {weeksTraining} wks</span>
                  </div>
                  {weeklyRate > 0 && (
                    <div style={{ fontSize: 11, color: '#3a3a3a' }}>{weeklyRate.toFixed(2)} kg / week avg</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#444444', paddingBottom: 6 }}>
                  PR: {allTimePRVal.toFixed(1)} kg · Current: {currentEst1RM.toFixed(1)} kg
                </div>
              )}
            </div>
            <div style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 22, overflow: 'hidden' }}>
              <div style={{ padding: '20px 18px 12px' }}>
                <ExerciseProgressChart points={chartPoints} accentColor="#3ecf8e" cardBg="#0e0e0e" />
              </div>
            </div>
          </div>

          {/* ── COACH BLOCK ── */}
          <div style={{ padding: '0 20px 24px' }} className="lfe-a5">
            <div style={{ background: '#0c1c12', border: '1px solid rgba(62,207,142,0.12)', borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(62,207,142,0.3) 50%, transparent 100%)' }} />
              <span style={{ fontSize: 48, lineHeight: 0.6, color: 'rgba(62,207,142,0.12)', fontFamily: 'Georgia, serif', marginBottom: 10, display: 'block' }}>"</span>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#c8c8c8', lineHeight: 1.6, letterSpacing: '-0.3px', marginBottom: 16 }}>
                {!hasProgression ? (
                  <>
                    You've logged{' '}
                    <strong style={{ color: '#f0f0f0' }}>
                      {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                    </strong>{' '}
                    in your first{' '}
                    <strong style={{ color: '#f0f0f0' }}>
                      {weeksTraining} {weeksTraining === 1 ? 'week' : 'weeks'}
                    </strong>
                    . You're building the habit that 90% of people never stick to. Keep showing up — the numbers will follow.
                  </>
                ) : (
                  <>
                    In{' '}
                    <strong style={{ color: '#f0f0f0' }}>
                      {weeksTraining} {weeksTraining === 1 ? 'week' : 'weeks'}
                    </strong>
                    , you've added{' '}
                    <span style={{ color: '#3ecf8e', fontWeight: 700 }}>+{kgGained.toFixed(1)} kg</span>{' '}
                    to your estimated max. That's{' '}
                    <strong style={{ color: '#f0f0f0' }}>{sessions.length} sessions of showing up</strong>.
                    {weeklyRate > 0 && (
                      <> You're progressing at{' '}
                        <span style={{ color: '#3ecf8e', fontWeight: 700 }}>{weeklyRate.toFixed(2)} kg/week</span>.
                        {' '}Keep Set 1 heavy and don't leave weight on the bar.
                      </>
                    )}
                  </>
                )}
              </div>
              <div style={{ background: 'rgba(9,21,16,0.7)', border: '1px solid rgba(62,207,142,0.1)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(62,207,142,0.7)' }}>
                    Next milestone: {nextMilestone} kg est. 1RM
                  </span>
                  {weeklyRate > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(62,207,142,0.4)' }}>
                      ~{Math.ceil((nextMilestone - allTimePRVal) / weeklyRate)} weeks away
                    </span>
                  )}
                </div>
                <div style={{ height: 5, background: 'rgba(62,207,142,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div className="lfe-bar-fill" style={{ height: '100%', width: 0, background: 'linear-gradient(90deg, #2aaa74, #3ecf8e, #5df5aa)', borderRadius: 3 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#3ecf8e' }}>{allTimePRVal.toFixed(1)} kg now</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(62,207,142,0.35)' }}>{nextMilestone} kg target</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(62,207,142,0.08)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #1d3d28, #0c1c12)', border: '1px solid rgba(62,207,142,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>⚡</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(62,207,142,0.5)', letterSpacing: '0.2px' }}>LazyFit Adaptive Coach</span>
              </div>
            </div>
          </div>

          {/* ── SESSION CHRONICLE ── */}
          <div style={{ padding: '0 20px' }} className="lfe-a6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#555555' }}>Session Chronicle</span>
              <button
                onClick={() => setSortDesc(d => !d)}
                style={{ fontSize: 12, fontWeight: 500, color: '#3ecf8e', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {sortDesc ? 'Newest First ↓' : 'Oldest First ↑'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleSessions.map(session => {
                const isOpen = openSessions.has(session.workoutId)
                const isToday = new Date(session.date).toDateString() === new Date().toDateString()
                return (
                  <SessionCard
                    key={session.workoutId}
                    session={session}
                    isOpen={isOpen}
                    isToday={isToday}
                    dateLabel={sessionLabels[session.workoutId]}
                    prWorkoutId={prWorkoutId}
                    onToggle={() =>
                      setOpenSessions(prev => {
                        const next = new Set(prev)
                        if (next.has(session.workoutId)) next.delete(session.workoutId)
                        else next.add(session.workoutId)
                        return next
                      })
                    }
                  />
                )
              })}
            </div>
            {hiddenCount > 0 && (
              <button
                onClick={() => setVisibleCount(n => n + 10)}
                style={{ marginTop: 10, width: '100%', height: 48, background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: '#383838', cursor: 'pointer', gap: 7 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#383838" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Show {hiddenCount} earlier session{hiddenCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div style={{ height: 32 }} />
        </>
      )}
    </div>
  )
}
