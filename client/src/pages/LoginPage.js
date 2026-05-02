import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
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
        {/* Back to Home Link */}
        <a href="/" style={{ position: 'absolute', color: '#94a3b8', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Home
        </a>

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

          <div style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}

            {/* ── Google Sign-In Button ── */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              style={styles.googleBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            >
              {googleLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  {/* Google "G" SVG */}
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* Divider */}
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or continue with email</span>
              <span style={styles.dividerLine} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || googleLoading} style={{ marginTop: 4 }}>
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

        {/* Google note for new users */}
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 16 }}>
          Google sign-in creates an account without a password. You can set one later from your profile.
        </p>
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
    maxWidth: '440px',
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
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 20px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  dividerText: {
    fontSize: 12,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
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
    marginTop: '4px',
    padding: '12px',
    background: 'rgba(0,212,255,0.05)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '8px',
    textAlign: 'center',
  },
  demoTitle: { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' },
  demoCreds: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)' },
};
