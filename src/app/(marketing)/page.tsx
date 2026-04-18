import Link from 'next/link'
import MatrixRain from '@/components/MatrixRain'

const FEATURES = [
  {
    title: 'ADAPTIVE PROGRESSION',
    body: 'Every session, the app analyses your performance and calculates the exact weight and reps for next time. No guesswork.',
  },
  {
    title: 'MACRO TRACKING',
    body: 'Log food in seconds. Barcode scanner, photo AI, or search. Daily calorie and macro targets that match your goal.',
  },
  {
    title: 'SMART WEIGHT TRACKING',
    body: 'Exponential moving average smooths out daily fluctuations. See your real trend, not noise.',
  },
  {
    title: 'ZERO BLOAT',
    body: 'No gamification. No streaks guilt. No ads. Just the data you need to make progress.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-[#222222] px-6 py-4 flex items-center justify-between">
        <span
          className="text-xl font-bold tracking-widest text-primary"
          style={{ textShadow: '0 0 10px #00FF41' }}
        >
          LAZYFIT
        </span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs tracking-widest text-muted-foreground hover:text-white transition-colors">
            LOG IN
          </Link>
          <Link
            href="/signup"
            className="text-xs tracking-widest text-black bg-primary px-4 py-2 rounded font-bold hover:bg-[#00CC33] transition-colors"
          >
            GET STARTED
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        {/* Matrix rain canvas — absolute, behind hero content */}
        <MatrixRain />

        {/* Radial gradient overlay — darkest at center (text), rain visible at edges */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.10) 100%)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />

        <p className="text-xs tracking-widest text-primary mb-4">ADAPTIVE FITNESS TRACKING</p>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-none mb-6">
          Train smart.<br />
          <span className="text-primary" style={{ textShadow: '0 0 30px #00FF41' }}>
            Not hard.
          </span>
        </h1>
        <p className="max-w-md text-muted-foreground text-lg leading-relaxed mb-10">
          LazyFit learns from every workout and adjusts your program automatically.
          Real progression, no spreadsheets.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/signup"
            className="px-8 py-4 bg-primary text-black font-bold tracking-widest text-sm rounded hover:bg-[#00CC33] transition-colors"
          >
            START FOR FREE
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 border border-[#222222] text-white text-sm tracking-widest rounded hover:border-primary transition-colors"
          >
            LOG IN
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#222222] px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs tracking-widest text-primary mb-12 text-center">WHY LAZYFIT</p>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map(({ title, body }) => (
              <div
                key={title}
                className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-6 hover:border-primary transition-colors"
              >
                <h3 className="text-xs font-bold tracking-widest text-primary mb-3">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#222222] px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white mb-4">Ready to enter the matrix?</h2>
        <p className="text-muted-foreground mb-8">Free during beta. No credit card required.</p>
        <Link
          href="/signup"
          className="inline-block px-8 py-4 bg-primary text-black font-bold tracking-widest text-sm rounded hover:bg-[#00CC33] transition-colors"
        >
          CREATE FREE ACCOUNT
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#222222] px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground tracking-widest">
          LAZYFIT · ADAPTIVE FITNESS TRACKING · BETA
        </p>
      </footer>
    </div>
  )
}
