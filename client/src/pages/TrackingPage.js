import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../App.css'; // ensure styles are available

export default function TrackingPage() {
  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Allow getting tracking ID from URL query ?id=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      setTrackingId(id);
      trackShipment(id);
    }
  }, []);

  const trackShipment = async (id) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await axios.get(`/api/tracking/${id}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Tracking ID not found. Please check your number.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    trackShipment(trackingId.trim());
    // Update URL without reloading
    window.history.pushState({}, '', `/track?id=${trackingId.trim()}`);
  };

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.grid} />
      {/* Glow orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.container}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <div style={styles.logo}>
            <svg viewBox="0 0 60 60" width="40" height="40">
              <polygon points="30,4 56,19 56,41 30,56 4,41 4,19" fill="none" stroke="#00d4ff" strokeWidth="2"/>
              <polygon points="30,14 46,23 46,37 30,46 14,37 14,23" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"/>
              <circle cx="30" cy="30" r="6" fill="#00d4ff"/>
            </svg>
            <span style={styles.logoName}>NEXLOG</span>
          </div>
          <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>Go to Login</a>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: 2 }}>TRACK YOUR SHIPMENT</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Enter your Tracking Number to see real-time updates</p>
        </div>

        <form onSubmit={handleTrack} style={{ display: 'flex', gap: 12, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px auto' }}>
          <input 
            className="form-input" 
            style={{ flex: 1, padding: '14px 20px', fontSize: 16 }} 
            placeholder="e.g. TRK-2404-00001" 
            value={trackingId} 
            onChange={(e) => setTrackingId(e.target.value)} 
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', fontSize: 15 }} disabled={loading}>
            {loading ? 'Tracking...' : 'TRACK'}
          </button>
        </form>

        {error && (
          <div style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.3)', padding: 16, borderRadius: 8, color: 'var(--danger)', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
            {error}
          </div>
        )}

        {result && result.type === 'shipment' && (
          <ShipmentView shipment={result.shipment} />
        )}

        {result && result.type === 'order' && (
          <div>
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Order Number</div>
                  <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>{result.order.orderNumber}</div>
                </div>
                <span className={`badge badge-${result.order.status}`} style={{ fontSize: 14, padding: '6px 12px' }}>{result.order.status?.replace(/_/g, ' ')}</span>
              </div>

              <div className="grid-2" style={{ marginBottom: 24, gap: 24 }}>
                <div>
                  <div style={styles.label}>PICKUP FROM</div>
                  <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{result.order.pickupAddress?.city || '—'}, {result.order.pickupAddress?.state || '—'}</div>
                </div>
                <div>
                  <div style={styles.label}>DELIVER TO</div>
                  <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{result.order.deliveryAddress?.city || '—'}, {result.order.deliveryAddress?.state || '—'}</div>
                </div>
              </div>

              {result.order.scheduledDelivery && (
                <div style={{ background: 'rgba(0, 212, 255, 0.05)', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid rgba(0, 212, 255, 0.1)' }}>
                  <div style={styles.label}>EXPECTED DELIVERY</div>
                  <div style={{ fontSize: 18, color: 'var(--accent)', fontWeight: 600 }}>{new Date(result.order.scheduledDelivery).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              )}
            </div>

            {result.shipments?.length > 0 ? (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: 1 }}>ASSOCIATED SHIPMENTS ({result.shipments.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {result.shipments.map((shipment, idx) => (
                    <ShipmentView key={idx} shipment={shipment} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                No shipments have been created for this order yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ShipmentView({ shipment }) {
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Tracking Number</div>
          <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>{shipment.trackingNumber}</div>
        </div>
        <span className={`badge badge-${shipment.status}`} style={{ fontSize: 14, padding: '6px 12px' }}>{shipment.status?.replace(/_/g, ' ')}</span>
      </div>

      <div className="grid-2" style={{ marginBottom: 24, gap: 24 }}>
        <div>
          <div style={styles.label}>ORIGIN</div>
          <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{shipment.origin?.city || '—'}, {shipment.origin?.state || '—'}</div>
        </div>
        <div>
          <div style={styles.label}>DESTINATION</div>
          <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{shipment.destination?.city || '—'}, {shipment.destination?.state || '—'}</div>
        </div>
      </div>

      {shipment.estimatedDelivery && (
        <div style={{ background: 'rgba(0, 212, 255, 0.05)', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid rgba(0, 212, 255, 0.1)' }}>
          <div style={styles.label}>ESTIMATED DELIVERY</div>
          <div style={{ fontSize: 18, color: 'var(--accent)', fontWeight: 600 }}>{new Date(shipment.estimatedDelivery).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      )}

      <div>
        <div style={styles.label}>TRACKING HISTORY ({shipment.trackingEvents?.length || 0})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, paddingLeft: 20, borderLeft: '2px solid var(--border)' }}>
          {(shipment.trackingEvents || []).slice().reverse().map((ev, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, position: 'relative', marginLeft: -29 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--bg-secondary)', border: '3px solid var(--bg-card)', flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className={`badge badge-${ev.status}`}>{ev.status?.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(ev.timestamp).toLocaleString()}</span>
                </div>
                {ev.description && <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 8 }}>{ev.description}</div>}
                {ev.location?.city && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📍 {ev.location.city}, {ev.location.state}</div>}
              </div>
            </div>
          ))}
          {!shipment.trackingEvents?.length && <div style={{ color: 'var(--text-muted)' }}>No tracking events yet.</div>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    position: 'relative',
    overflowX: 'hidden',
    padding: '40px 20px',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  orb1: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: '60vw',
    height: '60vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute',
    bottom: '-20%',
    right: '-10%',
    width: '50vw',
    height: '50vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,107,53,0.05) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  container: {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoName: {
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: '700',
    letterSpacing: '4px',
    color: 'var(--accent)',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  label: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    color: 'var(--text-muted)', 
    fontWeight: 600, 
    marginBottom: 6 
  }
};
