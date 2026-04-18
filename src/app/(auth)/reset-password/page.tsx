'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MatrixRain from '@/components/MatrixRain'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <MatrixRain opacity={0.12} />
      <div
        className="absolute inset-0 -z-10"
        style={{ background: 'rgba(0,0,0,0.78)', pointerEvents: 'none' }}
        aria-hidden="true"
      />

      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1
            className="text-4xl font-bold tracking-widest text-primary"
            style={{ fontFamily: 'var(--font-geist-mono)', textShadow: '0 0 20px #00FF41' }}
          >
            LAZYFIT
          </h1>
          <p className="mt-2 text-xs tracking-widest text-muted-foreground">
            SET NEW PASSWORD
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest text-muted-foreground mb-2">
              NEW PASSWORD
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

          <div>
            <label className="block text-xs tracking-widest text-muted-foreground mb-2">
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_#00FF41] transition-all"
              placeholder="repeat password"
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
            {loading ? 'SAVING...' : 'SET PASSWORD'}
          </button>
        </form>
      </div>
    </div>
  )
}
