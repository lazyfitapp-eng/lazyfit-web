'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/app/dashboard',
    label: 'HOME',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#00FF41' : 'none'} stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/app/train',
    label: 'TRAIN',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M2 9.5l2 2.5-2 2.5M22 9.5l-2 2.5 2 2.5" />
      </svg>
    ),
  },
  {
    href: '/app/food',
    label: 'FOOD',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
        <path d="M12 2a10 10 0 0 1 10 10" />
        <line x1="12" y1="12" x2="12" y2="2" />
      </svg>
    ),
  },
  {
    href: '/app/progress',
    label: 'PROGRESS',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/app/profile',
    label: 'PROFILE',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#222] bg-black/95 backdrop-blur sm:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/app/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              {icon(active)}
              <span className={`text-[9px] tracking-widest ${active ? 'text-primary' : 'text-[#555]'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
