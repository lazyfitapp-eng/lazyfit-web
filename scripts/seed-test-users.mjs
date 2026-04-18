import { randomUUID } from 'crypto'

const URL  = 'https://chkasmiqdgmpjgkbqfhe.supabase.co'
const SRK  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoa2FzbWlxZGdtcGpna2JxZmhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ2NDcxMiwiZXhwIjoyMDg3MDQwNzEyfQ.yYxfP8LM-BgLz57_IubfqDBozV1tys9XLS6R9GDBTgc'
const HDR  = { 'Content-Type': 'application/json', apikey: SRK, Authorization: `Bearer ${SRK}` }

async function rest(method, path, body) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method, headers: { ...HDR, Prefer: 'return=representation,resolution=merge-duplicates' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`REST ${method} ${path} → ${r.status}: ${txt}`)
  return txt ? JSON.parse(txt) : null
}

async function auth(method, path, body) {
  const r = await fetch(`${URL}/auth/v1/${path}`, {
    method, headers: HDR,
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`AUTH ${method} ${path} → ${r.status}: ${txt}`)
  return txt ? JSON.parse(txt) : null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Find an existing auth user by email (client-side filter, Supabase email= param unreliable)
async function findAuthUser(email) {
  const res = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: HDR })
  const data = await res.json()
  return (data?.users ?? []).find(u => u.email === email) ?? null
}

// Get existing user ID (updating password) or create fresh. Wipes all row data for that uid.
async function getOrCreateUser(email, password) {
  const existing = await findAuthUser(email)
  if (existing) {
    console.log(`  Found existing ${email} (${existing.id}) — reusing`)
    // Update password so login works
    await auth('PUT', `admin/users/${existing.id}`, { password, email_confirm: true })
    // Wipe previous data rows so we get a clean slate
    for (const table of ['workout_sets', 'workouts', 'food_logs', 'weight_entries', 'body_measurements', 'profiles']) {
      await fetch(`${URL}/rest/v1/${table}?user_id=eq.${existing.id}`, { method: 'DELETE', headers: HDR })
    }
    // profiles uses id not user_id
    await fetch(`${URL}/rest/v1/profiles?id=eq.${existing.id}`, { method: 'DELETE', headers: HDR })
    return existing.id
  }
  const d = await auth('POST', 'admin/users', { email, password, email_confirm: true })
  console.log(`  Created auth user: ${d.id}`)
  return d.id
}

// ─────────────────────────────────────────────────────────────────────────────
// USER 1 — Alex, new user
// ─────────────────────────────────────────────────────────────────────────────
async function seedUser1() {
  console.log('\n── User 1: Alex (new user) ──')
  const uid = await getOrCreateUser('newuser@lazyfit.test', 'testpass123')

  await rest('POST', 'profiles', [{
    id: uid,
    email: 'new.alex@lazyfit.test',   // parsed as "Alex" by name logic
    goal: 'recomp',
    current_weight: 75.0,
    target_calories: 2200,
    target_protein: 165,
    target_carbs: 240,
    target_fat: 65,
    current_streak: 0,
    age: 26,
    sex: 'male',
    height_cm: 178,
    experience_level: 'beginner',
    training_days_per_week: 3,
    diet_preference: 'standard',
    subscription_status: 'trial',
    trial_ends_at: '2026-05-17T00:00:00Z',
    preferred_units: 'metric',
    language: 'en',
    onboarding_completed: true,
  }])
  console.log(`  Profile created — no workouts, no data`)
  return uid
}

// ─────────────────────────────────────────────────────────────────────────────
// USER 2 — Maria, power user
// ─────────────────────────────────────────────────────────────────────────────

// 60 workout dates — 3×/week with realistic missed weeks
const WORKOUT_DATES = [
  '2025-10-20','2025-10-22','2025-10-24',
  '2025-10-27','2025-10-29','2025-10-31',
  '2025-11-03','2025-11-05','2025-11-07',
  '2025-11-10','2025-11-12','2025-11-14',
  // Week 5 missed
  '2025-11-24','2025-11-26',
  '2025-12-01','2025-12-03','2025-12-05',
  '2025-12-08','2025-12-10','2025-12-12',
  '2025-12-15','2025-12-17',
  // Weeks 10+11 missed (Christmas/New Year)
  '2026-01-05','2026-01-07','2026-01-09',
  '2026-01-12','2026-01-14','2026-01-16',
  '2026-01-19','2026-01-21','2026-01-23',
  '2026-01-26','2026-01-28','2026-01-30',
  '2026-02-02','2026-02-04','2026-02-06',
  '2026-02-09','2026-02-11','2026-02-13',
  // Week 18 missed (travel)
  '2026-02-23','2026-02-25','2026-02-27',
  '2026-03-02','2026-03-04','2026-03-06',
  '2026-03-09','2026-03-11','2026-03-13',
  '2026-03-16','2026-03-18','2026-03-20',
  // Week 23 missed — breaks streak before 3-week run
  '2026-03-31','2026-04-02','2026-04-04',
  '2026-04-07','2026-04-09','2026-04-11',
  '2026-04-14','2026-04-16',
]
// 60 workouts total

// Bench Press — all 60 workouts, rising to PR on Apr 16
const BENCH = [
  60,60,62.5, 62.5,65,65, 67.5,67.5,70, 70,72.5,72.5,  // 0-11
  75,75,                                                   // 12-13
  77.5,77.5,80, 80,80,82.5, 82.5,82.5,                   // 14-21
  82.5,85,85, 85,85,85, 85,85,85, 85,85,87.5,            // 22-33
  87.5,87.5,87.5, 87.5,87.5,87.5,                        // 34-39
  85,85,87.5, 87.5,87.5,87.5, 87.5,87.5,87.5,            // 40-48
  87.5,87.5,87.5, 87.5,87.5,87.5, 87.5,87.5,             // 49-56
  87.5, 90, 92.5,                                         // 57-59 ← PRs Apr 11,14,16
]
// All 5 reps. Last 3: 87.5→90→92.5 → 1RM 102.1→105→107.9 → Rising ✓, PR Apr 16 ✓

// OHP — even-indexed workouts (indices 0,2,4,...,58) → 30 sessions
// Holding: last 3 all 62.5@5 → 1RM 72.9, diffs [0,0]
const OHP = [
  45,47.5,47.5,50,50,52.5,52.5,55,55,55,
  57.5,57.5,60,60,60,62.5,62.5,62.5,62.5,62.5,
  62.5,62.5,62.5,62.5,62.5,62.5,62.5,62.5,62.5,62.5,
]

// Row — even-indexed workouts → 30 sessions
// Needs Attention: last 3 = 95→90→85 → 1RM 110.8→105→99.2, diffs [-5.8,-5.8]
// PR (97.5) at position 23 = workout index 46 = Mar 9 (39 days ago)
const ROW = [
  70,72.5,72.5,75,77.5,80,82.5,85,87.5,87.5,
  90,90,92.5,92.5,95,95,95,95,95,92.5,
  90,92.5,95,97.5,95,92.5,90,95,90,85,
]

// Chin-up — odd-indexed workouts (indices 1,3,5,...,59) → 30 sessions
// Rising: last 3 = 22.5@5 → 25@5 → 27.5@4 → 1RM 26.25→29.17→31.17
// PR (31.17) at Apr 16 (position 29) ✓
const CHIN_WEIGHTS = [
  5,7.5,7.5,10,10,10,12.5,12.5,15,15,
  15,17.5,17.5,17.5,20,20,20,20,20,22.5,
  22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,25,27.5,
]
const CHIN_REPS = [
  5,5,5,5,5,5,5,5,5,5,
  5,5,5,5,5,5,5,5,5,5,
  5,5,5,5,5,5,5,5,5,4,  // last session 4 reps (heavier weight)
]

// Incline DB — subset of odd-indexed workouts → 15 sessions
// Odd workout indices: 1,3,5,...,59. Incline at every other odd position (positions 0,2,4,...,28)
// = odd workout indices 1,5,9,13,17,21,25,29,33,37,41,45,49,53,57
const INCLINE_ODD_POSITIONS = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28]
const INCLINE_WEIGHTS = [
  22.5,22.5,24,24,24,26,26,26,28,28,28,30,30,32,32,
]

async function seedUser2() {
  console.log('\n── User 2: Maria (power user) ──')
  const uid = await getOrCreateUser('poweruser@lazyfit.test', 'testpass123')

  await rest('POST', 'profiles', [{
    id: uid,
    email: 'power.maria@lazyfit.test',   // parsed as "Maria"
    goal: 'bulk',
    current_weight: 77.5,
    target_calories: 2800,
    target_protein: 180,
    target_carbs: 320,
    target_fat: 80,
    current_streak: 3,
    age: 28,
    sex: 'female',
    height_cm: 168,
    experience_level: 'intermediate',
    training_days_per_week: 3,
    diet_preference: 'high_protein',
    subscription_status: 'active',
    trial_ends_at: null,
    preferred_units: 'metric',
    language: 'en',
    onboarding_completed: true,
  }])
  console.log(`  Profile created`)

  // ── Build all workout IDs upfront ─────────────────────────────────────────
  const workoutIds = WORKOUT_DATES.map(() => randomUUID())

  // ── Bulk insert workouts ──────────────────────────────────────────────────
  const workoutRows = WORKOUT_DATES.map((date, i) => ({
    id: workoutIds[i],
    user_id: uid,
    started_at: `${date}T11:00:00Z`,
    completed_at: `${date}T12:00:00Z`,
  }))
  await rest('POST', 'workouts', workoutRows)
  console.log(`  Inserted ${workoutRows.length} workouts`)

  // ── Build workout sets ────────────────────────────────────────────────────
  const sets = []

  // Helper: push a set with auto set_number per workout+exercise
  const setNums = {}  // key: `${wid}:${exercise_name}` → count
  function pushSet(wid, exercise_name, weight_kg, reps_completed, set_type) {
    const k = `${wid}:${exercise_name}`
    setNums[k] = (setNums[k] ?? 0) + 1
    sets.push({ workout_id: wid, exercise_name, weight_kg, reps_completed, set_type, set_number: setNums[k] })
  }

  // Track exercise session indices
  let ohpIdx = 0, rowIdx = 0, chinIdx = 0, inclineIdx = 0
  const inclineOddSet = new Set(INCLINE_ODD_POSITIONS)

  for (let i = 0; i < WORKOUT_DATES.length; i++) {
    const wid = workoutIds[i]

    // Bench Press — every workout
    pushSet(wid, 'Barbell Bench Press', Math.round(BENCH[i] * 0.6 * 2) / 2, 5, 'warmup')
    pushSet(wid, 'Barbell Bench Press', BENCH[i], 5, null)

    if (i % 2 === 0) {
      // Even workout: OHP + Row
      const ohpW = OHP[ohpIdx]
      pushSet(wid, 'Overhead Press', Math.round(ohpW * 0.6 * 2) / 2, 5, 'warmup')
      pushSet(wid, 'Overhead Press', ohpW, 5, null)

      const rowW = ROW[rowIdx]
      pushSet(wid, 'Barbell Row', Math.round(rowW * 0.6 * 2) / 2, 5, 'warmup')
      pushSet(wid, 'Barbell Row', rowW, 5, null)

      ohpIdx++; rowIdx++
    } else {
      // Odd workout: Chin-up + maybe Incline DB
      const oddPos = Math.floor(i / 2)
      const chinW = CHIN_WEIGHTS[chinIdx]
      const chinR = CHIN_REPS[chinIdx]
      pushSet(wid, 'Weighted Chin-up', Math.max(1, Math.round(chinW * 0.5 * 2) / 2), 5, 'warmup')
      pushSet(wid, 'Weighted Chin-up', chinW, chinR, null)
      chinIdx++

      if (inclineOddSet.has(oddPos)) {
        const incW = INCLINE_WEIGHTS[inclineIdx]
        pushSet(wid, 'Incline DB Press', Math.round(incW * 0.6 * 2) / 2, 8, 'warmup')
        pushSet(wid, 'Incline DB Press', incW, 8, null)
        inclineIdx++
      }
    }
  }

  // Batch insert sets in chunks of 200
  for (let i = 0; i < sets.length; i += 200) {
    await rest('POST', 'workout_sets', sets.slice(i, i + 200))
  }
  console.log(`  Inserted ${sets.length} workout sets`)

  // ── Weight entries ────────────────────────────────────────────────────────
  const weightEntries = [
    { date: '2025-10-20', weight: 74.0, trend_weight: 74.0 },
    { date: '2025-10-27', weight: 74.3, trend_weight: 74.1 },
    { date: '2025-11-03', weight: 74.1, trend_weight: 74.2 },
    { date: '2025-11-10', weight: 74.5, trend_weight: 74.3 },
    { date: '2025-11-24', weight: 74.8, trend_weight: 74.6 },
    { date: '2025-12-01', weight: 75.1, trend_weight: 74.8 },
    { date: '2025-12-08', weight: 74.9, trend_weight: 74.9 },
    { date: '2025-12-15', weight: 75.3, trend_weight: 75.1 },
    { date: '2026-01-05', weight: 75.6, trend_weight: 75.4 },
    { date: '2026-01-12', weight: 75.8, trend_weight: 75.6 },
    { date: '2026-01-19', weight: 75.7, trend_weight: 75.7 },
    { date: '2026-01-26', weight: 76.1, trend_weight: 75.9 },
    { date: '2026-02-02', weight: 76.0, trend_weight: 76.0 },
    { date: '2026-02-09', weight: 76.3, trend_weight: 76.1 },
    { date: '2026-02-23', weight: 76.5, trend_weight: 76.3 },
    { date: '2026-03-02', weight: 76.4, trend_weight: 76.4 },
    { date: '2026-03-09', weight: 76.7, trend_weight: 76.5 },
    { date: '2026-03-16', weight: 76.9, trend_weight: 76.7 },
    { date: '2026-03-31', weight: 77.1, trend_weight: 76.9 },
    { date: '2026-04-07', weight: 77.3, trend_weight: 77.1 },
    { date: '2026-04-14', weight: 77.5, trend_weight: 77.3 },
  ].map(e => ({ ...e, user_id: uid }))

  await rest('POST', 'weight_entries', weightEntries)
  console.log(`  Inserted ${weightEntries.length} weight entries`)

  // ── Body measurements (waist, monthly) ───────────────────────────────────
  const waist = [
    { date: '2025-10-20', value_cm: 81.0, category: 'waist' },
    { date: '2025-11-17', value_cm: 80.5, category: 'waist' },
    { date: '2025-12-15', value_cm: 80.0, category: 'waist' },
    { date: '2026-01-12', value_cm: 79.5, category: 'waist' },
    { date: '2026-02-09', value_cm: 79.5, category: 'waist' },
    { date: '2026-03-09', value_cm: 79.0, category: 'waist' },
    { date: '2026-04-07', value_cm: 79.0, category: 'waist' },
  ].map(e => ({ ...e, user_id: uid }))

  try {
    await rest('POST', 'body_measurements', waist)
    console.log(`  Inserted ${waist.length} waist measurements`)
  } catch (e) {
    console.log(`  Skipped waist measurements (table schema mismatch: ${e.message})`)
  }

  return uid
}

// ── Run ───────────────────────────────────────────────────────────────────────
const uid1 = await seedUser1()
const uid2 = await seedUser2()

console.log('\n══════════════════════════════════════════')
console.log('Test users created successfully.\n')
console.log('USER 1 — Alex (new user)')
console.log(`  Login:   newuser@lazyfit.test / testpass123`)
console.log(`  User ID: ${uid1}`)
console.log('\nUSER 2 — Maria (power user)')
console.log(`  Login:   poweruser@lazyfit.test / testpass123`)
console.log(`  User ID: ${uid2}`)
console.log('\nTo test: open http://localhost:3000 in a')
console.log('private/incognito window, sign in as each user,')
console.log('then navigate to /progress.')
console.log('══════════════════════════════════════════')
