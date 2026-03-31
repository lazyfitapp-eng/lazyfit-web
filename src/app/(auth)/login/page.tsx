'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/app/dashboard')
    router.refresh()
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
            ADAPTIVE FITNESS TRACKING
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
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
              autoComplete="current-password"
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
              placeholder="••••••••"
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
            {loading ? 'ENTERING...' : 'ENTER THE MATRIX'}
          </button>
        </form>

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
