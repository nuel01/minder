import { Outlet, NavLink, useNavigate } from 'react-router-dom'

const nav = [
  { to: '/dashboard',     label: 'Dashboard',     icon: '⬡' },
  { to: '/workers',       label: 'Workers',        icon: '◎' },
  { to: '/events',        label: 'Events',         icon: '◈' },
  { to: '/departments',   label: 'Departments',    icon: '▦' },
  { to: '/notifications', label: 'Notifications',  icon: '◬' },
]

export default function Layout() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-w)',
        background: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '.02em' }}>
            HARVESTERS
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Notification System
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {nav.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 8,
              marginBottom: 2,
              color: isActive ? '#fff' : 'rgba(255,255,255,.5)',
              background: isActive ? 'rgba(255,255,255,.1)' : 'transparent',
              fontSize: 13.5,
              fontWeight: isActive ? 500 : 400,
              transition: 'all .15s',
            })}>
              <span style={{ fontSize: 14, opacity: .8 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button onClick={logout} style={{
          margin: '0 10px 16px',
          padding: '9px 10px',
          borderRadius: 8,
          background: 'transparent',
          color: 'rgba(255,255,255,.35)',
          fontSize: 13,
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'color .15s',
        }}
          onMouseOver={e => e.currentTarget.style.color = 'rgba(255,255,255,.7)'}
          onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,.35)'}
        >
          <span>⊗</span> Sign out
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '32px 36px' }}>
        <Outlet />
      </main>
    </div>
  )
}
