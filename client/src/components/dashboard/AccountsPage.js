import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';

const ROLE_CONFIG = {
  admin:             { label: 'Admin',             icon: '🛡️', color: '#ef4444' },
  manager:           { label: 'Manager',           icon: '👔', color: '#f59e0b' },
  agent:             { label: 'Agent',             icon: '🎧', color: '#8b5cf6' },
  driver:            { label: 'Rider / Driver',    icon: '🚴', color: '#00d4ff' },
  vendor:            { label: 'Vendor',            icon: '🏪', color: '#10b981' },
  distributor:       { label: 'Distributor',       icon: '🏭', color: '#06b6d4' },
  store:             { label: 'Store / Hub',       icon: '🏬', color: '#6366f1' },
  fulfillment_center:{ label: 'Fulfillment Center',icon: '🏗️', color: '#f97316' },
  client:            { label: 'Client',            icon: '👤', color: '#94a3b8' },
};

export default function AccountsPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // user to edit/view
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users', { params: { role: roleFilter, search, limit: 50 } });
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [roleFilter, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (userId) => {
    await api.patch(`/users/${userId}/toggle-active`);
    fetchUsers();
  };

  const canManage = ['admin', 'manager'].includes(me?.role);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">TEAM & ACCOUNTS</div>
          <div className="page-subtitle">{total} members</div>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add Member</button>
        )}
      </div>

      {/* Role filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${roleFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRoleFilter('')}
        >All</button>
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            className={`btn btn-sm ${roleFilter === key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRoleFilter(key)}
            style={{ borderColor: roleFilter === key ? cfg.color : undefined, color: roleFilter === key ? cfg.color : undefined }}
          >
            {cfg.icon} {cfg.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="Search name, email, phone…" style={{ maxWidth: 280 }}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {users.map(u => {
            const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.client;
            const isDriver = u.role === 'driver';
            return (
              <div key={u._id} style={{
                background: 'var(--bg-card)',
                border: `1px solid ${u.isActive ? 'var(--border)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: 12, padding: 18, position: 'relative', opacity: u.isActive ? 1 : 0.6,
              }}>
                {/* Role badge */}
                <div style={{ position: 'absolute', top: 14, right: 14 }}>
                  <span style={{
                    background: `${cfg.color}22`, color: cfg.color,
                    border: `1px solid ${cfg.color}44`,
                    borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  }}>{cfg.icon} {cfg.label}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${cfg.color}22`, border: `2px solid ${cfg.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: cfg.color,
                  }}>
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {u.phone && <div>📱 {u.phone}</div>}
                  {u.company && <div>🏢 {u.company}</div>}
                  {isDriver && u.vehicleLicensePlate && <div>🚗 {u.vehicleLicensePlate} ({u.vehicleType})</div>}
                  {isDriver && u.assignedArea && <div>📍 Area: {u.assignedArea}</div>}
                </div>

                {/* KYC Status (Drivers) */}
                {isDriver && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 4,
                      background: u.kyc?.aadhaarVerified ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                      color: u.kyc?.aadhaarVerified ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {u.kyc?.aadhaarVerified ? '✓' : '✗'} Aadhaar
                    </span>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 4,
                      background: u.kyc?.vehicleVerified ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                      color: u.kyc?.vehicleVerified ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {u.kyc?.vehicleVerified ? '✓' : '✗'} Vehicle
                    </span>
                    {u.isOnboarded ? (
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(0,212,255,0.1)', color: 'var(--accent)' }}>✓ Onboarded</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Pending KYC</span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setSelected(u)}>
                    ✏️ Edit
                  </button>
                  {canManage && (
                    <button
                      className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => toggleActive(u._id)}
                      style={{ flex: 1 }}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!users.length && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
              No members found.
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <UserFormModal
          title="Add Member"
          onClose={() => setShowCreate(false)}
          onSave={() => { setShowCreate(false); fetchUsers(); }}
        />
      )}
      {selected && (
        <UserFormModal
          title={`Edit — ${selected.name}`}
          user={selected}
          onClose={() => setSelected(null)}
          onSave={() => { setSelected(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}

function UserFormModal({ title, user: initUser, onClose, onSave }) {
  const { user: me } = useAuth();
  const isEdit = !!initUser;
  const isAdmin = ['admin', 'manager'].includes(me?.role);

  const [form, setForm] = useState({
    name: initUser?.name || '',
    email: initUser?.email || '',
    password: '',
    role: initUser?.role || 'client',
    phone: initUser?.phone || '',
    company: initUser?.company || '',
    isActive: initUser?.isActive ?? true,
    assignedArea: initUser?.assignedArea || '',
    vehicleType: initUser?.vehicleType || '',
    vehicleCapacity: initUser?.vehicleCapacity || '',
    vehicleLicensePlate: initUser?.vehicleLicensePlate || '',
    gstNumber: initUser?.gstNumber || '',
    panNumber: initUser?.panNumber || '',
    // KYC fields (read/verify in admin mode)
    kyc: {
      aadhaarNumber: initUser?.kyc?.aadhaarNumber || '',
      vehicleNumber: initUser?.kyc?.vehicleNumber || '',
      aadhaarVerified: initUser?.kyc?.aadhaarVerified || false,
      vehicleVerified: initUser?.kyc?.vehicleVerified || false,
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('basic');

  const isDriver = form.role === 'driver';
  const isBusiness = ['vendor', 'distributor', 'store', 'fulfillment_center'].includes(form.role);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target?.value ?? e }));
  const setKyc = (field) => (e) => setForm(f => ({ ...f, kyc: { ...f.kyc, [field]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.password) delete payload.password;

      if (isEdit) {
        await api.patch(`/users/${initUser._id}`, payload);
        // Verify KYC separately if changed
        if (isAdmin && isDriver) {
          await api.patch(`/users/${initUser._id}/verify-kyc`, {
            aadhaarVerified: form.kyc.aadhaarVerified,
            vehicleVerified: form.kyc.vehicleVerified,
          });
        }
      } else {
        await api.post('/users', payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: 'basic', label: 'Basic Info' },
    ...(isDriver ? [{ key: 'vehicle', label: 'Vehicle & KYC' }] : []),
    ...(isBusiness ? [{ key: 'business', label: 'Business Info' }] : []),
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {TABS.map(t => (
            <button key={t.key} type="button"
              style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12 }}>{error}</div>}

            {tab === 'basic' && (
              <>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={form.name} onChange={set('name')} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={form.email} onChange={set('email')} required disabled={isEdit} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                    <input className="form-input" type="password" value={form.password} onChange={set('password')} required={!isEdit} minLength={6} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="+91 9876543210" />
                  </div>
                </div>
                {isAdmin && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select className="form-select" value={form.role} onChange={set('role')}>
                        {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Company</label>
                      <input className="form-input" value={form.company} onChange={set('company')} />
                    </div>
                  </div>
                )}
                {isAdmin && isEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                    <label htmlFor="isActive" style={{ cursor: 'pointer', fontSize: 14 }}>Account Active</label>
                  </div>
                )}
              </>
            )}

            {tab === 'vehicle' && isDriver && (
              <>
                <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 10, padding: 14, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Vehicle Details</div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Vehicle Type</label>
                      <select className="form-select" value={form.vehicleType} onChange={set('vehicleType')}>
                        <option value="">Select type</option>
                        {['Bicycle', '2-Wheeler / Bike', '3-Wheeler / Auto', 'Car', 'Van', 'Mini-Truck', 'Truck'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">License Plate</label>
                      <input className="form-input" value={form.vehicleLicensePlate} onChange={set('vehicleLicensePlate')} placeholder="DL 01 AB 1234" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Capacity (kg)</label>
                      <input className="form-input" type="number" value={form.vehicleCapacity} onChange={set('vehicleCapacity')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Assigned Area (City)</label>
                      <input className="form-input" value={form.assignedArea} onChange={set('assignedArea')} placeholder="e.g. Mumbai" />
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>KYC Verification</div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Aadhaar Number</label>
                      <input className="form-input" value={form.kyc.aadhaarNumber} onChange={setKyc('aadhaarNumber')} placeholder="1234 5678 9012" maxLength={14} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Vehicle Reg. Number</label>
                      <input className="form-input" value={form.kyc.vehicleNumber} onChange={setKyc('vehicleNumber')} placeholder="DL01AB1234" />
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                        <input type="checkbox" checked={form.kyc.aadhaarVerified} onChange={setKyc('aadhaarVerified')} />
                        ✓ Aadhaar Verified
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                        <input type="checkbox" checked={form.kyc.vehicleVerified} onChange={setKyc('vehicleVerified')} />
                        ✓ Vehicle No. Verified
                      </label>
                    </div>
                  )}
                  {form.kyc.aadhaarVerified && form.kyc.vehicleVerified && (
                    <div style={{ marginTop: 12, padding: 10, background: 'rgba(16,185,129,0.1)', borderRadius: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                      ✅ This rider will be marked as Fully Onboarded upon saving.
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'business' && isBusiness && (
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="form-input" value={form.gstNumber} onChange={set('gstNumber')} />
                </div>
                <div className="form-group">
                  <label className="form-label">PAN Number</label>
                  <input className="form-input" value={form.panNumber} onChange={set('panNumber')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Company / Store Name</label>
                  <input className="form-input" value={form.company} onChange={set('company')} />
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
