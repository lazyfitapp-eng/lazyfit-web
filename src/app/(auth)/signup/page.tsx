'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app/dashboard` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-6 text-primary">✓</div>
          <h2 className="text-xl font-bold tracking-widest text-primary mb-3">CHECK YOUR EMAIL</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a confirmation link to <span className="text-white">{email}</span>.
            Click it to activate your account.
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

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest text-muted-foreground mb-2">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs tracking-widest text-muted-foreground mb-2">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
              placeholder="min. 6 characters"
            />
          </div>

          {error && (
            <p className="text-xs text-[#FF0040] py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 border border-primary text-primary text-sm font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
