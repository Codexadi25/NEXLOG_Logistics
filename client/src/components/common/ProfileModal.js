import React, { useState } from 'react';
import { api } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';
import { resizeImageToBase64 } from '../../utils/imageUtils';

export default function ProfileModal({ onClose }) {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    company: user?.company || '',
  });
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [avatarData, setAvatarData] = useState(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await resizeImageToBase64(file, 400, 0.85);
      setAvatarPreview(processed.dataUri);
      setAvatarData(processed.dataUri);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const payload = { ...form };
      if (avatarData) payload.avatar = avatarData;
      const { data } = await api.patch('/auth/me', payload);
      if (setUser) setUser(data.user);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally { setLoading(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (pwForm.newPassword !== pwForm.confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setSuccess('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally { setLoading(false); }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 460, maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <span className="modal-title">My Profile</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 24px 0' }}>
          <label style={{ cursor: 'pointer', position: 'relative' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            <div style={{
              width: 88, height: 88, borderRadius: '50%',
              background: avatarPreview ? 'transparent' : 'linear-gradient(135deg, var(--accent), #7c3aed)',
              border: '3px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
              boxShadow: '0 0 20px rgba(0,212,255,0.3)',
            }}>
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{initials}</span>
              }
              {/* Camera overlay */}
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
              >
                <span style={{ fontSize: 20 }}>📷</span>
              </div>
            </div>
          </label>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{user?.email}</div>
          <div style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(0,212,255,0.1)', color: 'var(--accent)',
            border: '1px solid rgba(0,212,255,0.2)', marginBottom: 4,
          }}>{user?.role?.replace('_', ' ').toUpperCase()}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Click avatar to change photo</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginTop: 16 }}>
          {[{ k: 'profile', l: 'Basic Info' }, { k: 'password', l: 'Security' }].map(t => (
            <button key={t.k} type="button"
              style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: tab === t.k ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t.k ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setTab(t.k); setError(''); setSuccess(''); }}>
              {t.l}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>✓ {success}</div>}

          {tab === 'profile' && (
            <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 9876543210" />
              </div>
              <div className="form-group">
                <label className="form-label">Company / Organization</label>
                <input className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }} disabled={loading}>
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} minLength={6} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Changing…' : 'Change Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
