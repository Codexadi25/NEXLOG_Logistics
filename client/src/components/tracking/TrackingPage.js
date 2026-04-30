import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../context/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function TrackingPage() {
  const { connected, subscribe, subscribeTracking } = useWebSocket();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeShipments, setActiveShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const updatesRef = useRef(null);

  // Load active shipments
  useEffect(() => {
    api.get('/shipments', { params: { status: 'in_transit', limit: 10 } })
      .then(r => setActiveShipments(r.data.shipments || []))
      .catch(() => {});
  }, []);

  // Subscribe to WS tracking updates
  useEffect(() => {
    const unsub = subscribe('tracking_update', (data) => {
      setLiveUpdates(prev => [{
        ...data,
        receivedAt: new Date().toISOString(),
      }, ...prev.slice(0, 49)]);

      // Update result if it matches
      setResult(prev => {
        if (prev && prev.shipment && prev.shipment._id === data.shipmentId) {
          return {
            ...prev,
            shipment: {
              ...prev.shipment,
              status: data.status || prev.shipment.status,
              currentLocation: data.currentLocation || prev.shipment.currentLocation,
            },
          };
        }
        return prev;
      });
    });

    const unsubOrder = subscribe('order_update', (data) => {
      setLiveUpdates(prev => [{
        type: 'order_update',
        orderNumber: data.order?.orderNumber,
        status: data.order?.status,
        receivedAt: new Date().toISOString(),
      }, ...prev.slice(0, 49)]);
    });

    return () => { unsub(); unsubOrder(); };
  }, [subscribe]);

  // Auto scroll live feed
  useEffect(() => {
    if (updatesRef.current) updatesRef.current.scrollTop = 0;
  }, [liveUpdates]);

  const handleTrack = async (e) => {
    e?.preventDefault();
    if (!trackingNumber.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get(`/tracking/${trackingNumber.trim()}`);
      setResult(data);
      // Subscribe to live updates for this shipment
      if (data.shipment?._id) {
        subscribeTracking(data.shipment._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Tracking number not found');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectActive = async (shipment) => {
    setSelectedShipment(shipment);
    setTrackingNumber(shipment.trackingNumber);
    setResult({ shipment });
    subscribeTracking(shipment._id);
  };

  const STATUS_STEPS = [
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'picked_up', label: 'Picked Up' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const getStepIndex = (status) => STATUS_STEPS.findIndex(s => s.key === status);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">LIVE TRACKING</div>
          <div className="page-subtitle">Real-time shipment tracking via WebSocket</div>
        </div>
        <div style={styles.wsIndicator}>
          <div style={{ ...styles.wsDot, background: connected ? 'var(--success)' : 'var(--danger)', boxShadow: connected ? '0 0 8px var(--success)' : 'none', animation: connected ? 'pulse 2s infinite' : 'none' }} />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            {connected ? 'LIVE CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      <div style={styles.layout}>
        {/* Left panel */}
        <div style={styles.leftPanel}>
          {/* Search */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={styles.sectionLabel}>TRACK SHIPMENT</div>
            <form onSubmit={handleTrack} style={{ display: 'flex', gap: 10 }}>
              <input
                className="form-input"
                placeholder="Enter tracking number (e.g. TRK-2501-000001)"
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
                style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '…' : 'Track'}
              </button>
            </form>
            {error && <div style={styles.errorBox}>{error}</div>}
          </div>

          {/* Active shipments quick list */}
          {activeShipments.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={styles.sectionLabel}>ACTIVE SHIPMENTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {activeShipments.map(s => (
                  <button
                    key={s._id}
                    style={{
                      ...styles.activeShipmentBtn,
                      ...(selectedShipment?._id === s._id ? styles.activeShipmentBtnSelected : {}),
                    }}
                    onClick={() => handleSelectActive(s)}
                  >
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{s.trackingNumber}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {s.origin?.city} → {s.destination?.city}
                      </div>
                    </div>
                    <span className={`badge badge-${s.status}`}>{s.status?.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result?.shipment && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={styles.sectionLabel}>SHIPMENT DETAILS</div>
                <span className={`badge badge-${result.shipment.status}`}>
                  {result.shipment.status?.replace(/_/g, ' ')}
                </span>
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>
                {result.shipment.trackingNumber}
              </div>

              {/* Progress bar */}
              <div style={styles.progressSection}>
                <div style={styles.progressTrack}>
                  {STATUS_STEPS.map((step, idx) => {
                    const currentIdx = getStepIndex(result.shipment.status);
                    const isDone = idx <= currentIdx;
                    const isActive = idx === currentIdx;
                    return (
                      <React.Fragment key={step.key}>
                        <div style={styles.progressStep}>
                          <div style={{
                            ...styles.progressDot,
                            background: isDone ? 'var(--accent)' : 'var(--border)',
                            boxShadow: isActive ? '0 0 12px var(--accent)' : 'none',
                            transform: isActive ? 'scale(1.3)' : 'scale(1)',
                          }} />
                          <div style={{ ...styles.progressLabel, color: isDone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {step.label}
                          </div>
                        </div>
                        {idx < STATUS_STEPS.length - 1 && (
                          <div style={{ ...styles.progressLine, background: idx < currentIdx ? 'var(--accent)' : 'var(--border)' }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 16, gap: 12 }}>
                <div style={styles.infoBox}>
                  <div style={styles.infoLabel}>ORIGIN</div>
                  <div>{result.shipment.origin?.city}, {result.shipment.origin?.state}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.shipment.origin?.country}</div>
                </div>
                <div style={styles.infoBox}>
                  <div style={styles.infoLabel}>DESTINATION</div>
                  <div>{result.shipment.destination?.city}, {result.shipment.destination?.state}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.shipment.destination?.country}</div>
                </div>
              </div>

              {result.shipment.currentLocation && (
                <div style={{ ...styles.infoBox, marginTop: 12, borderColor: 'rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.05)' }}>
                  <div style={styles.infoLabel}>📍 CURRENT LOCATION</div>
                  <div style={{ color: 'var(--accent)', fontWeight: 500 }}>
                    {result.shipment.currentLocation.city}, {result.shipment.currentLocation.state}
                  </div>
                  {result.shipment.currentLocation.address && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {result.shipment.currentLocation.address}
                    </div>
                  )}
                  {result.shipment.currentLocation.lastUpdated && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Last updated: {new Date(result.shipment.currentLocation.lastUpdated).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {result.shipment.estimatedDelivery && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--success)', marginBottom: 2 }}>ESTIMATED DELIVERY</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {new Date(result.shipment.estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              )}

              {/* Tracking events */}
              {result.shipment.trackingEvents?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={styles.sectionLabel}>TRACKING HISTORY</div>
                  <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--border)', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...result.shipment.trackingEvents].reverse().map((ev, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, position: 'relative', marginLeft: -9 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border)', border: '2px solid var(--bg-card)', flexShrink: 0, marginTop: 4, boxShadow: i === 0 ? '0 0 8px var(--accent)' : 'none' }} />
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`badge badge-${ev.status}`}>{ev.status?.replace(/_/g, ' ')}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(ev.timestamp).toLocaleString()}</span>
                          </div>
                          {ev.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{ev.description}</div>}
                          {ev.location?.city && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>📍 {ev.location.city}, {ev.location.state}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel — live feed */}
        <div style={styles.rightPanel}>
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={styles.sectionLabel}>LIVE FEED</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--danger)', animation: connected ? 'pulse 2s infinite' : 'none' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>WSS</span>
              </div>
            </div>
            <div ref={updatesRef} style={styles.liveFeed}>
              {liveUpdates.length === 0 ? (
                <div style={styles.emptyFeed}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {connected ? 'Listening for updates…' : 'Connect to receive live updates'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                    Track a shipment to subscribe to its events
                  </div>
                </div>
              ) : (
                liveUpdates.map((upd, i) => (
                  <div key={i} style={{ ...styles.liveEvent, opacity: i === 0 ? 1 : Math.max(0.4, 1 - i * 0.06) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }} />
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {upd.type === 'order_update' ? upd.orderNumber : upd.shipmentId?.slice(-8)}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(upd.receivedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {upd.status && (
                      <div style={{ marginTop: 4 }}>
                        <span className={`badge badge-${upd.status}`}>{upd.status?.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {upd.currentLocation?.city && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                        📍 {upd.currentLocation.city}, {upd.currentLocation.state}
                      </div>
                    )}
                    {upd.trackingEvent?.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {upd.trackingEvent.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {liveUpdates.length > 0 && (
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setLiveUpdates([])}>
                Clear Feed
              </button>
            )}
          </div>

          {/* Visual tracker */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={styles.sectionLabel}>ROUTE VISUALIZER</div>
            <RouteVisualizer shipment={result?.shipment} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteVisualizer({ shipment }) {
  if (!shipment) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, flexDirection: 'column', gap: 8 }}>
        <svg viewBox="0 0 100 60" width="80" opacity={0.3}>
          <circle cx="10" cy="30" r="6" fill="none" stroke="#00d4ff" strokeWidth="2"/>
          <circle cx="90" cy="30" r="6" fill="none" stroke="#00d4ff" strokeWidth="2"/>
          <line x1="16" y1="30" x2="84" y2="30" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="4 3"/>
          <polygon points="50,22 54,30 50,38 46,30" fill="#00d4ff" opacity={0.5}/>
        </svg>
        <span>Track a shipment to see route</span>
      </div>
    );
  }

  const { origin, destination, currentLocation, status } = shipment;
  const progress = { scheduled: 0, picked_up: 15, in_transit: 50, out_for_delivery: 80, delivered: 100, failed: 50 }[status] || 0;

  return (
    <div style={{ padding: '16px 0' }}>
      <svg viewBox="0 0 320 100" width="100%" style={{ overflow: 'visible' }}>
        {/* Background grid lines */}
        {[20, 40, 60, 80].map(y => (
          <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(30,51,84,0.4)" strokeWidth="1"/>
        ))}

        {/* Route line */}
        <line x1="30" y1="50" x2="290" y2="50" stroke="rgba(0,212,255,0.2)" strokeWidth="2" strokeDasharray="6 4"/>
        {/* Progress line */}
        <line x1="30" y1="50" x2={30 + (260 * progress / 100)} y2="50" stroke="#00d4ff" strokeWidth="3" strokeLinecap="round"/>
        {/* Glow */}
        <line x1="30" y1="50" x2={30 + (260 * progress / 100)} y2="50" stroke="#00d4ff" strokeWidth="8" strokeLinecap="round" opacity="0.15"/>

        {/* Origin */}
        <circle cx="30" cy="50" r="8" fill="#00d4ff" opacity="0.9"/>
        <circle cx="30" cy="50" r="4" fill="var(--bg-primary)"/>
        <text x="30" y="72" textAnchor="middle" fill="#7a9cc4" fontSize="9" fontFamily="monospace">
          {origin?.city?.slice(0, 8) || 'ORIGIN'}
        </text>

        {/* Destination */}
        <circle cx="290" cy="50" r="8" fill={status === 'delivered' ? '#00e676' : 'rgba(0,212,255,0.3)'} stroke={status === 'delivered' ? '#00e676' : '#00d4ff'} strokeWidth="2"/>
        <circle cx="290" cy="50" r="4" fill={status === 'delivered' ? '#00e676' : 'var(--bg-primary)'}/>
        <text x="290" y="72" textAnchor="middle" fill="#7a9cc4" fontSize="9" fontFamily="monospace">
          {destination?.city?.slice(0, 8) || 'DEST'}
        </text>

        {/* Moving truck icon */}
        {status !== 'delivered' && status !== 'scheduled' && (
          <g transform={`translate(${24 + (260 * progress / 100)}, 35)`}>
            <rect x="-10" y="0" width="20" height="12" rx="2" fill="#00d4ff" opacity="0.9"/>
            <rect x="-10" y="-5" width="12" height="7" rx="1" fill="#00d4ff" opacity="0.7"/>
            <circle cx="-7" cy="12" r="3" fill="var(--bg-primary)" stroke="#00d4ff" strokeWidth="1.5"/>
            <circle cx="7" cy="12" r="3" fill="var(--bg-primary)" stroke="#00d4ff" strokeWidth="1.5"/>
            {/* Glow */}
            <ellipse cx="0" cy="6" rx="14" ry="10" fill="rgba(0,212,255,0.1)"/>
          </g>
        )}

        {/* Current location pin */}
        {currentLocation?.city && (
          <g transform={`translate(${24 + (260 * progress / 100)}, 20)`}>
            <text textAnchor="middle" fill="#00d4ff" fontSize="8" fontFamily="monospace" y="-2">
              {currentLocation.city?.slice(0, 8)}
            </text>
          </g>
        )}

        {/* Progress % */}
        <text x="160" y="26" textAnchor="middle" fill="#00d4ff" fontSize="11" fontFamily="monospace" fontWeight="bold">
          {progress}%
        </text>
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Status: <span style={{ color: 'var(--text-primary)' }}>{status?.replace(/_/g, ' ')}</span>
        </div>
        {currentLocation?.city && (
          <div style={{ fontSize: 11, color: 'var(--accent)' }}>
            📍 {currentLocation.city}, {currentLocation.state}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start' },
  leftPanel: { flex: 1.4, minWidth: 0 },
  rightPanel: { flex: 1, minWidth: 280, position: 'sticky', top: 0 },
  wsIndicator: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 },
  wsDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  sectionLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 },
  errorBox: { marginTop: 10, padding: '8px 12px', background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', borderRadius: 6, color: 'var(--danger)', fontSize: 13 },
  progressSection: { margin: '16px 0' },
  progressTrack: { display: 'flex', alignItems: 'center' },
  progressStep: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  progressDot: { width: 12, height: 12, borderRadius: '50%', transition: 'all 0.4s', flexShrink: 0 },
  progressLine: { flex: 1, height: 2, transition: 'background 0.4s' },
  progressLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', maxWidth: 56, lineHeight: 1.2 },
  infoBox: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' },
  infoLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 },
  liveFeed: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, minHeight: 120 },
  liveEvent: { padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, transition: 'opacity 0.3s' },
  emptyFeed: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center' },
  activeShipmentBtn: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', width: '100%' },
  activeShipmentBtnSelected: { borderColor: 'var(--accent)', background: 'rgba(0,212,255,0.06)' },
};
