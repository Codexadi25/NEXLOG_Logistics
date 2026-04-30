import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import DashboardHome from './DashboardHome';
import OrdersPage from '../orders/OrdersPage';
import ShipmentsPage from '../shipments/ShipmentsPage';
import TrackingPage from '../tracking/TrackingPage';
import DispatchPage from './DispatchPage';
import AccountsPage from './AccountsPage';
import ProfileModal from '../common/ProfileModal';
import LifelinePage from '../../pages/LifelinePage';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'orders', label: 'Orders', icon: '◈' },
  { id: 'shipments', label: 'Shipments', icon: '◎' },
  { id: 'dispatch', label: 'Dispatch & Fleet', icon: '⛟', role: ['admin', 'manager'] },
  { id: 'tracking', label: 'Live Tracking', icon: '◉' },
  { id: 'lifeline', label: 'Support Lifeline', icon: '⊕', role: ['admin', 'manager', 'agent'] },
  { id: 'accounts', label: 'Team & Accounts', icon: '⊞', role: ['admin', 'manager'] },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const { connected } = useWebSocket();

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardHome />;
      case 'orders': return <OrdersPage />;
      case 'shipments': return <ShipmentsPage />;
      case 'dispatch': return <DispatchPage />;
      case 'tracking': return <TrackingPage />;
      case 'lifeline': return <LifelinePage />;
      case 'accounts': return <AccountsPage />;
      default: return <DashboardHome />;
    }
  };

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, ...(sidebarOpen ? {} : styles.sidebarCollapsed) }}>
        {/* Logo */}
        <div style={styles.sidebarHeader}>
          <svg viewBox="0 0 40 40" width="32" height="32">
            <polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="none" stroke="#00d4ff" strokeWidth="2"/>
            <circle cx="20" cy="20" r="5" fill="#00d4ff"/>
          </svg>
          {sidebarOpen && (
            <div>
              <div style={styles.logoText}>NEXLOG</div>
              <div style={styles.logoSub}>LOGISTICS</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          {NAV_ITEMS.filter(item => !item.role || item.role.includes(user?.role)).map((item) => (
            <button
              key={item.id}
              style={{ ...styles.navItem, ...(page === item.id ? styles.navItemActive : {}) }}
              onClick={() => setPage(item.id)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {sidebarOpen && <span style={styles.navLabel}>{item.label}</span>}
              {page === item.id && <div style={styles.navIndicator} />}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={styles.sidebarFooter}>
          <div style={styles.wsStatus}>
            <div style={{ ...styles.wsDot, background: connected ? 'var(--success)' : 'var(--danger)', boxShadow: connected ? '0 0 6px var(--success)' : 'none' }} />
            {sidebarOpen && <span style={styles.wsLabel}>{connected ? 'Live' : 'Offline'}</span>}
          </div>
          {sidebarOpen && (
            <div style={styles.userInfo}>
              <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
              <div style={styles.userDetails}>
                <div style={styles.userName}>{user?.name}</div>
                <div style={styles.userRole}>{user?.role?.toUpperCase()}</div>
              </div>
              <button style={styles.logoutBtn} onClick={logout} title="Logout">⏻</button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <button style={styles.menuBtn} onClick={() => setSidebarOpen(v => !v)}>
              <div style={styles.menuLine} />
              <div style={{ ...styles.menuLine, width: '20px' }} />
              <div style={styles.menuLine} />
            </button>
            <div style={styles.breadcrumb}>
              <span style={styles.breadcrumbItem}>NEXLOG</span>
              <span style={styles.breadcrumbSep}>/</span>
              <span style={styles.breadcrumbActive}>
                {NAV_ITEMS.find(n => n.id === page)?.label}
              </span>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.headerTime}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <button
              onClick={() => setShowProfile(true)}
              style={{ ...styles.headerRole, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 10, transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              title="Edit Profile"
            >
              <div style={{ ...styles.headerAvatar, overflow: 'hidden' }}>
                {user?.avatar
                  ? <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : user?.name?.[0]?.toUpperCase()
                }
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.company || user?.role}</div>
              </div>
            </button>
          </div>
        </header>
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

        {/* Content */}
        <main style={styles.content}>{renderPage()}</main>
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' },
  sidebar: {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s, min-width 0.3s',
    overflow: 'hidden',
    zIndex: 10,
  },
  sidebarCollapsed: { width: '64px', minWidth: '64px' },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 16px',
    borderBottom: '1px solid var(--border)',
    minHeight: '64px',
  },
  logoText: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', letterSpacing: '4px', color: 'var(--accent)', lineHeight: 1 },
  logoSub: { fontSize: '9px', letterSpacing: '3px', color: 'var(--text-muted)', marginTop: '2px' },
  nav: { flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: '100%',
    position: 'relative',
    whiteSpace: 'nowrap',
  },
  navItemActive: {
    background: 'rgba(0,212,255,0.1)',
    color: 'var(--accent)',
  },
  navIcon: { fontSize: '18px', width: '24px', textAlign: 'center', flexShrink: 0 },
  navLabel: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', letterSpacing: '1px' },
  navIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '3px',
    height: '60%',
    background: 'var(--accent)',
    borderRadius: '0 2px 2px 0',
    boxShadow: '0 0 8px var(--accent)',
  },
  sidebarFooter: { padding: '16px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' },
  wsStatus: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px' },
  wsDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  wsLabel: { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0,212,255,0.05)', borderRadius: '8px', border: '1px solid var(--border)' },
  avatar: { width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 },
  userDetails: { flex: 1, overflow: 'hidden' },
  userName: { fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: '10px', color: 'var(--accent)', letterSpacing: '1px' },
  logoutBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '2px', transition: 'color 0.2s' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    height: 'var(--header-height)',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  menuBtn: { display: 'flex', flexDirection: 'column', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' },
  menuLine: { width: '24px', height: '2px', background: 'var(--text-secondary)', borderRadius: '1px' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' },
  breadcrumbItem: { color: 'var(--text-muted)' },
  breadcrumbSep: { color: 'var(--border)' },
  breadcrumbActive: { color: 'var(--accent)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '20px' },
  headerTime: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' },
  headerRole: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerAvatar: { width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(0,212,255,0.2)', border: '1px solid var(--accent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' },
  content: { flex: 1, overflow: 'auto', padding: '24px' },
};
