import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav bar */}
      <header className="border-b border-[#222222] px-4 py-3 flex items-center justify-between sticky top-0 z-50 bg-black/95 backdrop-blur">
        <Link
          href="/app/dashboard"
          className="text-lg font-bold tracking-widest text-primary"
          style={{ textShadow: '0 0 10px #00FF41' }}
        >
          LAZYFIT
        </Link>
        <AppNav userEmail={user.email ?? ''} />
      </header>

      {/* Page content — pb-20 on mobile to clear bottom nav */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-20 sm:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
