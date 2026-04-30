import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, api } from '../../context/AuthContext';
import ProfileModal from '../common/ProfileModal';
import KYCPage from './KYCPage';
import '../../App.css';

// --- STATUS MACHINE ---
// Each status unlocks the next button only after the previous is reached
const STATUS_STEPS = [
  { key: 'scheduled',        label: 'Scheduled',          emoji: '📋', next: 'accepted' },
  { key: 'accepted',         label: 'Accept Order',        emoji: '✅', next: 'picked_up' },
  { key: 'picked_up',        label: 'Picked Up',           emoji: '📦', next: 'in_transit' },
  { key: 'in_transit',       label: 'In Transit',          emoji: '🚴', next: 'reached_drop' },
  { key: 'reached_drop',     label: 'Reached Drop Point',  emoji: '📍', next: 'out_for_delivery' },
  { key: 'out_for_delivery', label: 'Out for Delivery',    emoji: '🛵', next: 'delivered' },
  { key: 'delivered',        label: 'Delivered',           emoji: '🎉', next: null },
  { key: 'failed',           label: 'Failed',              emoji: '❌', next: null },
];

const FAILURE_REASONS = [
  'Customer Not Available',
  'Wrong Address',
  'Unavailable to Pickup',
  'Requested Return',
  'Order not required anymore',
  'Requested Replacement',
  'Met with Accident',
  'Order Lost/Damaged',
  'Store Closed',
];

function getNextStatus(currentKey) {
  const step = STATUS_STEPS.find(s => s.key === currentKey);
  return step?.next || null;
}

function getNextLabel(currentKey) {
  const nextKey = getNextStatus(currentKey);
  return STATUS_STEPS.find(s => s.key === nextKey)?.label || null;
}

function getStepIndex(key) {
  return STATUS_STEPS.findIndex(s => s.key === key);
}

export default function DriverLayout() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('active');
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showKYC, setShowKYC] = useState(false);

  // KYC check
  const kycPending = user?.role === 'driver' && !user?.isOnboarded;

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/shipments', { params: { limit: 50 } });
      setShipments(data.shipments || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const activeShipments = shipments.filter(s => !['delivered', 'failed', 'returned'].includes(s.status));
  const completedShipments = shipments.filter(s => ['delivered', 'failed', 'returned'].includes(s.status));
  const shown = tab === 'active' ? activeShipments : completedShipments;

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 40 40" width="24" height="24">
            <polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="none" stroke="#00d4ff" strokeWidth="2"/>
            <circle cx="20" cy="20" r="5" fill="#00d4ff"/>
          </svg>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--accent)', letterSpacing: 3, fontWeight: 700 }}>NEXLOG</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {kycPending && (
            <button onClick={() => setShowKYC(true)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 20, padding: '4px 12px', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠️ Complete KYC
            </button>
          )}
          <button onClick={() => setShowProfile(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '4px 8px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: user?.avatar ? 'transparent' : 'linear-gradient(135deg, var(--accent), #7c3aed)',
              border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 13, fontWeight: 700, color: '#fff',
            }}>
              {user?.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* KYC BANNER */}
      {kycPending && (
        <div style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))', borderBottom: '1px solid rgba(239,68,68,0.3)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>KYC Verification Pending</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Your account is not fully onboarded. Submit your Aadhaar, Driving Licence & Vehicle documents to start accepting deliveries.
              </div>
            </div>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', flexShrink: 0 }} onClick={() => setShowKYC(true)}>
            Submit Docs →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        {[{ k: 'active', l: `Active (${activeShipments.length})` }, { k: 'completed', l: `Done (${completedShipments.length})` }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: '13px 0', background: 'none', border: 'none', borderBottom: tab === t.k ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t.k ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{t.l}</button>
        ))}
        <button className="btn btn-secondary btn-sm" style={{ margin: '8px 12px' }} onClick={fetchShipments} disabled={loading}>↻</button>
      </div>

      {/* Content */}
      <main style={styles.main}>
        {loading ? (
          <div style={styles.empty}><span style={{ fontSize: 32 }}>⏳</span><div>Loading…</div></div>
        ) : shown.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: 48 }}>🚚</span>
            <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              {tab === 'active' ? 'No active deliveries.' : 'No completed deliveries yet.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {shown.map(s => (
              <ShipmentCard key={s._id} shipment={s} onSelect={() => setSelected(s)} disabled={kycPending} />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <ShipmentDetailModal
          shipment={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { fetchShipments(); setSelected(null); }}
        />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showKYC && <KYCPage onClose={() => setShowKYC(false)} />}
    </div>
  );
}

// ─── Shipment Card ────────────────────────────────────────────────────────────
function ShipmentCard({ shipment: s, onSelect, disabled }) {
  const isActive = !['delivered', 'failed', 'returned'].includes(s.status);
  const nextLabel = getNextLabel(s.status);
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${isActive ? 'rgba(0,212,255,0.2)' : 'var(--border)'}`,
      borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden',
    }}>
      {isActive && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'var(--accent)', borderRadius: '14px 0 0 14px' }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--accent)', fontWeight: 800 }}>{s.trackingNumber}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.orders?.length || 0} order(s)</div>
        </div>
        <span className={`badge badge-${s.status}`}>{s.status?.replace(/_/g, ' ')}</span>
      </div>

      {/* Route */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 14, background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>FROM</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{s.origin?.city || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.origin?.state}</div>
        </div>
        <div style={{ color: 'var(--accent)', fontSize: 18 }}>→</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>TO</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{s.destination?.city || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.destination?.state}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ flex: 1 }}
          onClick={onSelect}
        >
          View Details
        </button>
        {isActive && nextLabel && !disabled && (
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 2, fontWeight: 700 }}
            onClick={onSelect}
          >
            → {nextLabel}
          </button>
        )}
        {disabled && isActive && (
          <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
            ⚠️ Complete KYC first
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shipment Detail Modal ────────────────────────────────────────────────────
function ShipmentDetailModal({ shipment: init, onClose, onRefresh }) {
  const [s, setS] = useState(init);
  const [updating, setUpdating] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [showFailReasons, setShowFailReasons] = useState(false);

  useEffect(() => {
    api.get(`/shipments/${init._id}`)
      .then(r => setS(r.data.shipment))
      .catch(console.error);
  }, [init._id]);

  const nextKey = getNextStatus(s.status);
  const nextStep = STATUS_STEPS.find(st => st.key === nextKey);
  const currentStepIdx = getStepIndex(s.status);
  const isTerminal = !nextKey;

  const advanceStatus = async (statusKey, note = '') => {
    setUpdating(true);
    try {
      await api.patch(`/shipments/${s._id}`, {
        status: statusKey,
        trackingEvent: {
          status: statusKey,
          description: note || `Status updated to "${statusKey.replace(/_/g, ' ')}"`,
        },
      });
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally { setUpdating(false); }
  };

  const orders = (s.orders || []).filter(o => o && typeof o === 'object');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, color: 'var(--accent)', fontWeight: 800 }}>{s.trackingNumber}</div>
          </div>
          <span className={`badge badge-${s.status}`}>{s.status?.replace(/_/g, ' ')}</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Progress bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {STATUS_STEPS.filter(s => s.key !== 'failed').map((step, i) => {
                const done = i <= currentStepIdx && s.status !== 'failed';
                return (
                  <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? 'var(--accent)' : 'var(--bg-secondary)',
                      border: `2px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                      fontSize: 13, transition: 'all 0.3s',
                      boxShadow: done ? '0 0 8px rgba(0,212,255,0.5)' : 'none',
                    }}>
                      {done ? '✓' : step.emoji}
                    </div>
                    <div style={{ fontSize: 9, color: done ? 'var(--accent)' : 'var(--text-muted)', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
                      {step.label.split(' ').slice(0, 2).join(' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Route */}
          <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>PICKUP</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.origin?.city || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.origin?.address}</div>
              </div>
              <div style={{ fontSize: 24, color: 'var(--accent)' }}>⇒</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>DELIVER</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.destination?.city || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.destination?.address}</div>
              </div>
            </div>
          </div>

          {/* Orders */}
          {orders.length > 0 && (
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 10 }}>ORDERS ({orders.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orders.map((o, i) => (
                  <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{o.orderNumber}</span>
                      <span className={`badge badge-${o.status}`}>{o.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Pickup</div>
                        <div>{o.pickupAddress?.street}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{o.pickupAddress?.city}</div>
                        {o.pickupAddress?.googleMapLocation && <a href={o.pickupAddress.googleMapLocation} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 11 }}>📍 Map</a>}
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Delivery</div>
                        <div>{o.deliveryAddress?.street}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{o.deliveryAddress?.city}</div>
                        {o.deliveryAddress?.googleMapLocation && <a href={o.deliveryAddress.googleMapLocation} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 11 }}>📍 Map</a>}
                      </div>
                    </div>
                    {o.items?.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {o.items.map((item, j) => (
                          <span key={j} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                            {item.name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTION BUTTONS — sequential only */}
          {!isTerminal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)', fontWeight: 700 }}>NEXT ACTION</div>

              {!showFailReasons ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 3, fontWeight: 700, fontSize: 15, padding: '13px 0' }}
                    disabled={updating}
                    onClick={() => advanceStatus(nextKey)}
                  >
                    {updating ? 'Updating…' : `${nextStep?.emoji} Mark as ${nextStep?.label}`}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.4)' }}
                    onClick={() => setShowFailReasons(true)}
                    disabled={updating}
                  >
                    ✗ Failed
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--danger)' }}>Select failure reason:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {FAILURE_REASONS.map(r => (
                      <button
                        key={r}
                        className="btn btn-secondary"
                        style={{ textAlign: 'left', color: failReason === r ? 'var(--danger)' : 'var(--text-secondary)', borderColor: failReason === r ? 'var(--danger)' : 'var(--border)' }}
                        onClick={() => setFailReason(r)}
                      >
                        {failReason === r ? '● ' : '○ '}{r}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowFailReasons(false)}>← Back</button>
                    <button
                      className="btn btn-danger"
                      style={{ flex: 2 }}
                      disabled={!failReason || updating}
                      onClick={() => advanceStatus('failed', `Failed: ${failReason}`)}
                    >
                      Confirm Failure
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isTerminal && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: s.status === 'delivered' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 16 }}>
              {s.status === 'delivered' ? '🎉 Delivered Successfully!' : '❌ Failed / Could Not Deliver'}
            </div>
          )}

          {/* Tracking History */}
          {s.trackingEvents?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 10 }}>TRACKING HISTORY</div>
              <div style={{ paddingLeft: 14, borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...s.trackingEvents].reverse().map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginLeft: -21 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3, background: i === 0 ? 'var(--accent)' : 'var(--bg-secondary)', border: i === 0 ? '3px solid var(--accent)' : '2px solid var(--border)' }} />
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginBottom: 2 }}>
                        <span className={`badge badge-${ev.status}`}>{ev.status?.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(ev.timestamp).toLocaleString()}</span>
                      </div>
                      {ev.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ev.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', maxWidth: '100vw' },
  header: {
    height: 58, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0,
  },
  main: { flex: 1, padding: '16px', maxWidth: 700, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: 'var(--text-muted)', gap: 8, textAlign: 'center' },
};
