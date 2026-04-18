'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3ecf8e' : '#f0f0f0'} strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/food',
    label: 'Food',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3ecf8e' : '#f0f0f0'} strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
]

const NAV_ITEMS_RIGHT = [
  {
    href: '/train',
    label: 'Train',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3ecf8e' : '#f0f0f0'} strokeWidth="1.5">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
  },
  {
    href: '/progress',
    label: 'Progress',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3ecf8e' : '#f0f0f0'} strokeWidth="1.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
]

function NavItem({ href, label, icon }: { href: string; label: string; icon: (active: boolean) => React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        flex: 1,
        padding: '2px 0',
        textDecoration: 'none',
        opacity: active ? 1 : 0.4,
      }}
    >
      {icon(active)}
      <span style={{ fontSize: 10, color: active ? '#3ecf8e' : '#f0f0f0', fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </Link>
  )
}

function FABButton() {
  const pathname = usePathname()
  const router = useRouter()
  const isFood = pathname === '/food'
  const isTraining = pathname.startsWith('/train')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: -20 }}>
      <button
        onClick={() => {
          if (isFood) {
            window.dispatchEvent(new CustomEvent('lazyfit:open-food-modal'))
            return
          }
          router.push(isTraining ? '/train' : '/dashboard')
        }}
        aria-label={isFood ? 'Log food' : isTraining ? 'Start workout' : 'Log activity'}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#3ecf8e',
          border: '3px solid #090909',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#090909" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname.startsWith('/train/')) return null

  return (
    <>
      <div style={{ height: 80 }} />
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: '#090909',
        borderTop: '1px solid #1a1a1a',
        padding: '8px 0 20px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
      }}>
        {NAV_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
        <FABButton />
        {NAV_ITEMS_RIGHT.map(item => <NavItem key={item.href} {...item} />)}
      </nav>
    </>
  )
}
