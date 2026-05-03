import Link from 'next/link'
import { googleLoginAction, signupAction } from '../actions'

function getParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; sent?: string | string[] }>
}) {
  const params = await searchParams
  const error = getParam(params.error)
  const done = getParam(params.sent) === '1'

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-6 text-primary">✓</div>
          <h2 className="text-xl font-bold tracking-widest text-primary mb-3">CHECK YOUR EMAIL</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a confirmation link. Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="inline-block mt-8 text-xs text-primary tracking-widest hover:underline"
          >
            BACK TO LOGIN
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
            START YOUR JOURNEY
          </p>
        </div>

        {/* Google OAuth */}
        <form action={googleLoginAction}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 py-3 mb-6 bg-white text-black text-sm font-bold tracking-widest rounded hover:bg-gray-100 transition-all"
          >
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

        <form action={signupAction} className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest text-muted-foreground mb-2">EMAIL</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#b8b8b8] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs tracking-widest text-muted-foreground mb-2">PASSWORD</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#b8b8b8] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
              placeholder="min. 6 characters"
            />
          </div>

          {error && <p className="text-xs text-[#FF0040] py-2">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 mt-2 border border-primary text-primary text-sm font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all"
          >
            CREATE ACCOUNT
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
