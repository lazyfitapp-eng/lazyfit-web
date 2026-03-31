'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/app/dashboard', label: 'HOME' },
  { href: '/app/train', label: 'TRAIN' },
  { href: '/app/food', label: 'FOOD' },
  { href: '/app/progress', label: 'PROGRESS' },
  { href: '/app/profile', label: 'PROFILE' },
]

export default function AppNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname === href || (href !== '/app/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`
              hidden sm:block px-3 py-1.5 text-xs tracking-widest rounded transition-all
              ${active
                ? 'text-primary border border-primary'
                : 'text-muted-foreground hover:text-white'
              }
            `}
          >
            {label}
          </Link>
        )
      })}
      <button
        onClick={handleLogout}
        className="ml-2 px-3 py-1.5 text-xs tracking-widest text-muted-foreground hover:text-[#FF0040] transition-colors"
      >
        OUT
      </button>
    </nav>
  )
}
