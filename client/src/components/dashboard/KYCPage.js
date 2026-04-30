import React, { useState } from 'react';
import { api } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';
import { processFileForDB } from '../../utils/imageUtils';

const DOC_FIELDS = [
  { key: 'aadhaarImage',   label: 'Aadhaar Card', hint: 'Front side — auto-extracts Aadhaar number', icon: '🪪' },
  { key: 'panImage',       label: 'PAN Card',      hint: 'Photo-clear scan/photo',                  icon: '💳' },
  { key: 'dlImage',        label: 'Driving Licence',hint: 'Front side',                              icon: '🚗' },
  { key: 'rcImage',        label: 'RC (Vehicle Reg.)', hint: 'Vehicle Registration Certificate',    icon: '📋' },
  { key: 'vehiclePhoto',   label: 'Vehicle Photo', hint: 'Photo with number plate visible',         icon: '📸' },
];

export default function KYCPage({ onClose }) {
  const { user, setUser } = useAuth();
  const [docs, setDocs] = useState({});
  const [textFields, setTextFields] = useState({
    aadhaarNumber: user?.kyc?.aadhaarNumber || '',
    vehicleNumber: user?.kyc?.vehicleNumber || '',
    panNumber: user?.panNumber || '',
    dlNumber: '',
    bankAccount: user?.bankAccount || '',
    ifscCode: user?.ifscCode || '',
    upiId: '',
  });
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('docs');

  const handleFileChange = async (key, file) => {
    if (!file) return;
    setProcessing(key);
    setError('');
    try {
      const processed = await processFileForDB(file);
      setDocs(d => ({ ...d, [key]: processed }));
    } catch (err) {
      setError(`${key}: ${err.message}`);
    } finally { setProcessing(''); }
  };

  const submit = async () => {
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const payload = {
        kyc: {
          aadhaarNumber: textFields.aadhaarNumber,
          vehicleNumber: textFields.vehicleNumber,
          ...(docs.aadhaarImage ? { aadhaarImageUrl: docs.aadhaarImage.dataUri } : {}),
          ...(docs.rcImage ? { vehicleImageUrl: docs.rcImage.dataUri } : {}),
          ...(docs.dlImage ? { dlImageUrl: docs.dlImage.dataUri } : {}),
          ...(docs.panImage ? { panImageUrl: docs.panImage.dataUri } : {}),
          ...(docs.vehiclePhoto ? { vehiclePhotoUrl: docs.vehiclePhoto.dataUri } : {}),
        },
        panNumber: textFields.panNumber,
        bankAccount: textFields.bankAccount,
        ifscCode: textFields.ifscCode,
      };
      const { data } = await api.patch(`/users/${user._id}`, payload);
      if (setUser) setUser(data.user);
      setSuccess('Documents submitted! An admin will verify and onboard you shortly.');
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    } finally { setLoading(false); }
  };

  const TABS = [
    { k: 'docs', l: '📄 Documents' },
    { k: 'bank', l: '🏦 Bank & UPI' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">KYC Verification</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Submit documents to get onboarded</div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Status banner */}
        <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Verification Pending.</span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>Upload all required documents. Admin will review and approve within 24 hours.</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {TABS.map(t => (
            <button key={t.k} type="button"
              style={{ flex: 1, padding: '11px 0', background: 'none', border: 'none', borderBottom: tab === t.k ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t.k ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 10, fontSize: 13 }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: 10, fontSize: 13 }}>✓ {success}</div>}

          {tab === 'docs' && (
            <>
              {/* Text fields */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Aadhaar Number</label>
                  <input className="form-input" value={textFields.aadhaarNumber} onChange={e => setTextFields(f => ({ ...f, aadhaarNumber: e.target.value }))} placeholder="1234 5678 9012" maxLength={14} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Number</label>
                  <input className="form-input" value={textFields.vehicleNumber} onChange={e => setTextFields(f => ({ ...f, vehicleNumber: e.target.value }))} placeholder="DL01AB1234" />
                </div>
                <div className="form-group">
                  <label className="form-label">PAN Number</label>
                  <input className="form-input" value={textFields.panNumber} onChange={e => setTextFields(f => ({ ...f, panNumber: e.target.value }))} placeholder="ABCDE1234F" maxLength={10} />
                </div>
                <div className="form-group">
                  <label className="form-label">DL Number</label>
                  <input className="form-input" value={textFields.dlNumber} onChange={e => setTextFields(f => ({ ...f, dlNumber: e.target.value }))} placeholder="DL-1420110012345" />
                </div>
              </div>

              <hr className="divider" />

              {/* Document uploads */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {DOC_FIELDS.map(df => (
                  <div key={df.key}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      {df.icon} {df.label}
                    </label>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{df.hint}</div>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      border: `2px dashed ${docs[df.key] ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, padding: 12, cursor: 'pointer',
                      background: docs[df.key] ? 'rgba(0,212,255,0.04)' : 'transparent',
                      minHeight: 90, gap: 6, transition: 'all 0.2s',
                    }}>
                      <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                        onChange={e => handleFileChange(df.key, e.target.files?.[0])} />
                      {processing === df.key ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Processing…</div>
                      ) : docs[df.key] ? (
                        <>
                          <img src={docs[df.key].dataUri} alt={df.label} style={{ maxHeight: 80, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} />
                          <div style={{ fontSize: 10, color: 'var(--success)' }}>✓ {docs[df.key].sizeKb}KB</div>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 26 }}>📎</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Upload {df.label}</span>
                        </>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'bank' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                💡 Bank details are used for daily payouts. These will only be editable after admin verification.
              </div>
              <div className="form-group">
                <label className="form-label">Account Holder Name</label>
                <input className="form-input" value={user?.name || ''} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Bank Account Number</label>
                  <input className="form-input" value={textFields.bankAccount} onChange={e => setTextFields(f => ({ ...f, bankAccount: e.target.value }))} placeholder="XXXXXXXXXXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input className="form-input" value={textFields.ifscCode} onChange={e => setTextFields(f => ({ ...f, ifscCode: e.target.value }))} placeholder="SBIN0001234" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">UPI ID (for payouts)</label>
                <input className="form-input" value={textFields.upiId} onChange={e => setTextFields(f => ({ ...f, upiId: e.target.value }))} placeholder="name@upi" />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Submitting…' : '📤 Submit for Verification'}
          </button>
        </div>
      </div>
    </div>
  );
}
