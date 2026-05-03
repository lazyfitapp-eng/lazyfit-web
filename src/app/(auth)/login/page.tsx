import Link from 'next/link'
import MatrixRain from '@/components/MatrixRain'
import { googleLoginAction, loginAction, passwordResetAction } from '../actions'

function getParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; error?: string | string[]; sent?: string | string[] }>
}) {
  const params = await searchParams
  const resetMode = getParam(params.mode) === 'reset'
  const error = getParam(params.error)
  const resetSent = getParam(params.sent) === '1'

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      {/* Very subtle rain - texture, not distraction */}
      <MatrixRain opacity={0.12} />
      <div
        className="absolute inset-0 -z-10"
        style={{ background: 'rgba(0,0,0,0.78)', pointerEvents: 'none' }}
        aria-hidden="true"
      />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <h1
            className="text-4xl font-bold tracking-widest text-primary"
            style={{ fontFamily: 'var(--font-geist-mono)', textShadow: '0 0 20px #00FF41' }}
          >
            LAZYFIT
          </h1>
          <p className="mt-2 text-xs tracking-widest text-muted-foreground">
            ADAPTIVE FITNESS TRACKING
          </p>
        </div>

        {/* Google OAuth - primary for users who signed up via Google */}
        <form action={googleLoginAction}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 py-3 mb-6 bg-white text-black text-sm font-bold tracking-widest rounded hover:bg-gray-100 transition-all"
          >
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            CONTINUE WITH GOOGLE
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[#222]" />
          <span className="text-xs text-[#b8b8b8] tracking-widest">OR</span>
          <div className="flex-1 h-px bg-[#222]" />
        </div>

        {/* Email/password form */}
        <form action={resetMode ? passwordResetAction : loginAction} className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest text-muted-foreground mb-2">
              EMAIL
            </label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#b8b8b8] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
              placeholder="you@example.com"
            />
          </div>

          {!resetMode && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs tracking-widest text-muted-foreground">
                  PASSWORD
                </label>
                <Link
                  href="/login?mode=reset"
                  className="text-[10px] tracking-widest text-primary hover:underline"
                >
                  FORGOT?
                </Link>
              </div>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#b8b8b8] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
                placeholder="password"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-[#FF0040] py-2">{error}</p>
          )}

          {resetSent && (
            <p className="text-xs text-primary py-2">
              Reset link sent. Check your email.
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 mt-2 border border-primary text-primary text-sm font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all"
          >
            {resetMode ? 'SEND RESET LINK' : 'ENTER THE MATRIX'}
          </button>
        </form>

        {resetMode && (
          <Link
            href="/login"
            className="block w-full mt-4 text-center text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Back to login
          </Link>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
