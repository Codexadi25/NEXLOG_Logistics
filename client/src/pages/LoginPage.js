import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    company: '', role: 'client',
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register({ name: form.name, email: form.email, password: form.password, company: form.company, role: form.role });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.grid} />
      {/* Glow orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logo}>
          <svg viewBox="0 0 60 60" width="52" height="52">
            <polygon points="30,4 56,19 56,41 30,56 4,41 4,19" fill="none" stroke="#00d4ff" strokeWidth="2"/>
            <polygon points="30,14 46,23 46,37 30,46 14,37 14,23" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"/>
            <circle cx="30" cy="30" r="6" fill="#00d4ff"/>
            <line x1="30" y1="4" x2="30" y2="14" stroke="#00d4ff" strokeWidth="1.5"/>
            <line x1="56" y1="19" x2="46" y2="23" stroke="#00d4ff" strokeWidth="1.5"/>
            <line x1="56" y1="41" x2="46" y2="37" stroke="#00d4ff" strokeWidth="1.5"/>
          </svg>
          <div>
            <div style={styles.logoName}>NEXLOG</div>
            <div style={styles.logoTagline}>B2B Logistics Platform</div>
          </div>
        </div>

        <div style={styles.card}>
          {/* Tabs */}
          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }} onClick={() => setMode('login')}>
              Sign In
            </button>
            <button style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }} onClick={() => setMode('register')}>
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}

            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" placeholder="John Smith" value={form.name} onChange={set('name')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <input className="form-input" placeholder="Acme Corp" value={form.company} onChange={set('company')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select className="form-select" value={form.role} onChange={set('role')}>
                    <option value="client">Client</option>
                    <option value="manager">Manager</option>
                    <option value="driver">Driver</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="name@company.com" value={form.email} onChange={set('email')} required />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={6} />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} required />
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            {mode === 'login' && (
              <div style={styles.demo}>
                <div style={styles.demoTitle}>Demo Credentials</div>
                <div style={styles.demoCreds}>admin@nexlog.com / admin123</div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  },
  orb1: {
    position: 'absolute',
    top: '-200px',
    left: '-200px',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute',
    bottom: '-200px',
    right: '-200px',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  container: {
    width: '100%',
    maxWidth: '420px',
    position: 'relative',
    zIndex: 1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  logoName: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '6px',
    color: 'var(--accent)',
  },
  logoTagline: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    letterSpacing: '1px',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    flex: 1,
    padding: '16px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: '600',
    letterSpacing: '1px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottom: '2px solid var(--accent)',
    marginBottom: '-1px',
  },
  form: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  error: {
    background: 'rgba(255,61,87,0.1)',
    border: '1px solid rgba(255,61,87,0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'var(--danger)',
    fontSize: '13px',
  },
  demo: {
    marginTop: '8px',
    padding: '12px',
    background: 'rgba(0,212,255,0.05)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '8px',
    textAlign: 'center',
  },
  demoTitle: { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' },
  demoCreds: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)' },
};
