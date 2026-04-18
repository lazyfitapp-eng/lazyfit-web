'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LEFT_NAV = [
  {
    href: '/dashboard',
    label: 'HOME',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#00FF41' : 'none'} stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/food',
    label: 'FOOD',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
        <path d="M12 2a10 10 0 0 1 10 10" />
        <line x1="12" y1="12" x2="12" y2="2" />
      </svg>
    ),
  },
]

const RIGHT_NAV = [
  {
    href: '/train',
    label: 'TRAIN',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M2 9.5l2 2.5-2 2.5M22 9.5l-2 2.5 2 2.5" />
      </svg>
    ),
  },
  {
    href: '/progress',
    label: 'PROGRESS',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00FF41' : '#555'} strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
]

function NavItem({ href, label, icon }: { href: string; label: string; icon: (active: boolean) => React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} className="flex flex-col items-center gap-1 flex-1 py-2">
      {icon(active)}
      <span className={`text-[9px] tracking-widest ${active ? 'text-primary' : 'text-[#555]'}`}>
        {label}
      </span>
    </Link>
  )
}

function FABButton() {
  const pathname = usePathname()
  const router = useRouter()
  const isTraining = pathname.startsWith('/train')

  const isFood = pathname === '/food'

  return (
    <div className="flex flex-col items-center justify-center flex-shrink-0 -mt-5">
      <button
        onClick={() => {
          if (isFood) {
            window.dispatchEvent(new CustomEvent('lazyfit:open-food-modal'))
            return
          }
          router.push(isTraining ? '/train' : '/dashboard')
        }}
        className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg transition-transform active:scale-95"
        aria-label={isTraining ? 'Start workout' : isFood ? 'Log food' : 'Log activity'}
      >
        {isTraining ? (
          // Play triangle
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#000">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        ) : (
          // Plus
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>
      <span className="text-[9px] tracking-widest text-[#555] mt-1">
        {isTraining ? 'START' : 'LOG'}
      </span>
    </div>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  // Hide on any /train/ subroute (active workout, exercise history, summary)
  if (pathname.startsWith('/train/')) return null

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed nav */}
      <div style={{ height: 80 }} />
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1a1a1a] bg-black/95 backdrop-blur-sm pb-safe">
        <div className="flex items-end justify-around px-2 pt-2 pb-3">
          {LEFT_NAV.map(item => <NavItem key={item.href} {...item} />)}
          <FABButton />
          {RIGHT_NAV.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      </nav>
    </>
  )
}
