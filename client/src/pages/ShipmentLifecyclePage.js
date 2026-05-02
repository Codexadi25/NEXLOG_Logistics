import React, { useState, useCallback } from 'react';
import { api } from '../context/AuthContext';

/* ─────────────────────────────────────────────────────────────
   Shipment Lifecycle Designer
   
   Lets admins / managers design the route a shipment travels
   through multiple hubs / outlets / fulfilment centres.

   Status semantics:
   • "arrived"   → shipment reached this stop but destination is NOT yet the customer
   • "delivered" → shipment successfully handed to the end customer at their location
   
   This prevents falsely marking intermediate stops as "delivered".
   ───────────────────────────────────────────────────────────── */

const STOP_TYPES = [
  { value: 'pickup',             label: '📦 Pickup Point',         color: '#3b82f6' },
  { value: 'hub',                label: '🏭 Distribution Hub',     color: '#8b5cf6' },
  { value: 'outlet',             label: '🏪 Outlet / Store',       color: '#f59e0b' },
  { value: 'fulfillment_center', label: '🏗️ Fulfilment Centre',    color: '#10b981' },
  { value: 'direct_delivery',    label: '🚀 Direct to Customer',   color: '#00d4ff' },
  { value: 'destination',        label: '📍 Final Destination',    color: '#ef4444' },
];

const STATUS_LABELS = {
  pending:          { label: 'Pending',                  color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  scheduled:        { label: 'Scheduled',                color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  in_transit:       { label: 'In Transit',               color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  arrived:          { label: 'Arrived / Reached',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  out_for_delivery: { label: 'Out for Delivery',         color: '#00d4ff', bg: 'rgba(0,212,255,0.15)' },
  delivered:        { label: '✅ Delivered',             color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  failed:           { label: '❌ Failed / Returned',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

const defaultStop = (id) => ({
  id,
  type: 'hub',
  name: '',
  city: '',
  address: '',
  isDirectDelivery: false,
  status: 'pending',
  estimatedArrival: '',
  actualArrival: null,
  notes: '',
});

let _id = 1;
const uid = () => `stop_${_id++}`;

export default function ShipmentLifecyclePage() {
  const [stops, setStops] = useState([
    { ...defaultStop(uid()), type: 'pickup', name: 'Pickup Point', status: 'scheduled' },
    { ...defaultStop(uid()), type: 'destination', name: 'Final Destination', status: 'pending' },
  ]);
  const [shipmentId, setShipmentId] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);

  // ── Stop helpers ──
  const addStop = (insertAfterIdx) => {
    const newStop = defaultStop(uid());
    setStops(prev => {
      const next = [...prev];
      next.splice(insertAfterIdx + 1, 0, newStop);
      return next;
    });
  };

  const removeStop = (idx) => {
    if (stops.length <= 2) return; // must keep at least pickup + destination
    setStops(prev => prev.filter((_, i) => i !== idx));
    if (selectedStop === idx) setSelectedStop(null);
  };

  const updateStop = useCallback((idx, field, value) => {
    setStops(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }, []);

  // ── Drag-to-reorder ──
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setStops(prev => {
      const next = [...prev];
      const dragged = next.splice(dragIdx, 1)[0];
      next.splice(idx, 0, dragged);
      setDragIdx(idx);
      return next;
    });
  };
  const handleDragEnd = () => setDragIdx(null);

  // ── Status update (inline) ──
  const updateStatus = async (idx, newStatus) => {
    updateStop(idx, 'status', newStatus);
    // If marking as arrived/delivered, set actual arrival time
    if (newStatus === 'arrived' || newStatus === 'delivered') {
      updateStop(idx, 'actualArrival', new Date().toISOString());
    }
    // If saving to an existing shipment
    if (shipmentId) {
      try {
        await api.patch(`/shipments/${shipmentId}/lifecycle`, { stops: stops.map((s, i) => i === idx ? { ...s, status: newStatus } : s) });
      } catch (e) { /* non-fatal */ }
    }
  };

  // ── Save lifecycle to server ──
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { stops, trackingNumber: trackingNo };
      if (shipmentId) {
        await api.patch(`/shipments/${shipmentId}/lifecycle`, payload);
      } else {
        const { data } = await api.post('/shipments/lifecycle', payload);
        setShipmentId(data.shipment?._id || '');
        setTrackingNo(data.shipment?.trackingNumber || '');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save lifecycle');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived state ──
  const lastDeliveredIdx = stops.reduce((acc, s, i) => s.status === 'delivered' ? i : acc, -1);
  const currentActiveIdx = stops.findIndex(s => ['in_transit', 'out_for_delivery', 'arrived'].includes(s.status));

  const stopTypeConfig = (type) => STOP_TYPES.find(t => t.value === type) || STOP_TYPES[0];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ─── Left Panel: Route Builder ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={hdr.bar}>
          <div>
            <h1 style={hdr.title}>🗺️ Shipment Lifecycle Designer</h1>
            <p style={hdr.sub}>Design the route &amp; track each leg. Intermediate stops show "Arrived" — only the final destination can be "Delivered".</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {trackingNo && (
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', background: 'rgba(0,212,255,0.1)', padding: '4px 10px', borderRadius: 6 }}>
                {trackingNo}
              </span>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ minWidth: 120 }}
            >
              {saving ? 'Saving...' : saved ? '✓ Saved!' : '💾 Save Route'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 24px', borderBottom: '1px solid rgba(239,68,68,0.2)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Route Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

          {/* Progress summary bar */}
          <div style={progressBar(stops)} />

          {/* Route map — vertical timeline */}
          <div style={{ position: 'relative', marginTop: 32 }}>

            {/* Connector line */}
            <div style={{
              position: 'absolute',
              left: 28,
              top: 24,
              bottom: 24,
              width: 3,
              background: 'var(--border)',
              zIndex: 0,
            }} />

            {stops.map((stop, idx) => {
              const cfg = stopTypeConfig(stop.type);
              const isFirst = idx === 0;
              const isLast  = idx === stops.length - 1;
              const isFinalDestination = isLast;
              const statusCfg = STATUS_LABELS[stop.status] || STATUS_LABELS.pending;
              const isActive = idx === currentActiveIdx;
              const isCompleted = stop.status === 'arrived' || stop.status === 'delivered' ||
                                  (idx < lastDeliveredIdx);
              const isDragging = dragIdx === idx;

              return (
                <React.Fragment key={stop.id}>
                  {/* Stop card */}
                  <div
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginBottom: 8,
                      opacity: isDragging ? 0.4 : 1,
                      cursor: 'grab',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {/* Node circle */}
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: isCompleted ? cfg.color : isActive ? cfg.color : 'var(--bg-card)',
                      border: `3px solid ${cfg.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flexShrink: 0,
                      boxShadow: isActive ? `0 0 0 6px ${cfg.color}22` : 'none',
                      transition: 'all 0.3s',
                      zIndex: 2,
                      position: 'relative',
                    }}>
                      {isCompleted && stop.status === 'delivered' ? '✅' : isCompleted ? '✓' : stopTypeConfig(stop.type).label.split(' ')[0]}
                    </div>

                    {/* Stop body */}
                    <div
                      style={{
                        flex: 1,
                        background: isActive ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                        border: `1px solid ${isActive ? cfg.color : 'var(--border)'}`,
                        borderRadius: 12,
                        padding: '14px 16px',
                        boxShadow: isActive ? `0 0 0 2px ${cfg.color}33` : 'none',
                        transition: 'all 0.3s',
                      }}
                      onClick={() => setSelectedStop(selectedStop === idx ? null : idx)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          {/* Stop type badge */}
                          <span style={{
                            fontSize: 11, fontWeight: 700, background: `${cfg.color}22`,
                            color: cfg.color, padding: '2px 8px', borderRadius: 20, letterSpacing: 0.5,
                          }}>
                            {cfg.label}
                          </span>

                          {/* Stop name */}
                          <input
                            className="form-input"
                            value={stop.name}
                            onChange={e => updateStop(idx, 'name', e.target.value)}
                            placeholder={isFirst ? 'Origin / Pickup name' : isLast ? 'Destination name' : 'Hub / Outlet name'}
                            style={{ marginTop: 8, fontWeight: 600, fontSize: 15, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8 }}
                            onClick={e => e.stopPropagation()}
                          />

                          {/* City */}
                          <input
                            className="form-input"
                            value={stop.city}
                            onChange={e => updateStop(idx, 'city', e.target.value)}
                            placeholder="City / Location"
                            style={{ marginTop: 6, fontSize: 13, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8 }}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>

                        {/* Status badge + actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 12 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            background: statusCfg.bg, color: statusCfg.color,
                            padding: '3px 10px', borderRadius: 20,
                          }}>
                            {statusCfg.label}
                          </span>

                          {/* Status selector */}
                          <select
                            className="form-select"
                            value={stop.status}
                            onChange={e => updateStatus(idx, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 12, padding: '4px 8px' }}
                          >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => {
                              // Intermediate stops cannot be "delivered" — only final destination
                              if (!isFinalDestination && k === 'delivered') return null;
                              // Final destination cannot be "arrived" (it's the end)
                              if (isFinalDestination && k === 'arrived') return null;
                              return <option key={k} value={k}>{v.label}</option>;
                            })}
                          </select>

                          {/* Remove button (not for first/last) */}
                          {!isFirst && !isLast && (
                            <button
                              onClick={e => { e.stopPropagation(); removeStop(idx); }}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                              title="Remove stop"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {selectedStop === idx && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <label style={lbl}>Stop Type</label>
                              <select
                                className="form-select"
                                value={stop.type}
                                onChange={e => updateStop(idx, 'type', e.target.value)}
                              >
                                {STOP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={lbl}>Est. Arrival</label>
                              <input
                                type="datetime-local"
                                className="form-input"
                                value={stop.estimatedArrival}
                                onChange={e => updateStop(idx, 'estimatedArrival', e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label style={lbl}>Full Address</label>
                            <input
                              className="form-input"
                              value={stop.address}
                              onChange={e => updateStop(idx, 'address', e.target.value)}
                              placeholder="Full address"
                            />
                          </div>
                          <div>
                            <label style={lbl}>Notes</label>
                            <textarea
                              className="form-input"
                              value={stop.notes}
                              onChange={e => updateStop(idx, 'notes', e.target.value)}
                              placeholder="Special instructions, contact info, etc."
                              rows={2}
                              style={{ resize: 'vertical' }}
                            />
                          </div>
                          {stop.actualArrival && (
                            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                              ✓ Actual arrival: {new Date(stop.actualArrival).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* "Add stop" button between stops (not after the last one) */}
                  {!isLast && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 20 }}>
                      <div style={{ width: 16, height: 1, background: 'var(--border)' }} />
                      <button
                        onClick={() => addStop(idx)}
                        style={{
                          background: 'none', border: '1px dashed var(--border)',
                          borderRadius: 20, padding: '4px 14px', fontSize: 12,
                          color: 'var(--accent)', cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(0,212,255,0.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'none'; }}
                      >
                        + Add Stop / Hub
                      </button>
                      <div style={{ width: 16, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Summary & Status Legend ─── */}
      <div style={{ width: 300, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 20px 0' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Route Summary</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{stops.length} stops · {stops.filter(s => s.status === 'delivered' || s.status === 'arrived').length} completed</p>
        </div>

        {/* Mini route overview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {stops.map((stop, idx) => {
            const cfg = stopTypeConfig(stop.type);
            const statusCfg = STATUS_LABELS[stop.status] || STATUS_LABELS.pending;
            return (
              <div key={stop.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: cfg.color, flexShrink: 0, marginTop: 4,
                  boxShadow: `0 0 6px ${cfg.color}`,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {stop.name || `Stop ${idx + 1}`}
                  </div>
                  {stop.city && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stop.city}</div>}
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: statusCfg.bg, color: statusCfg.color,
                    padding: '1px 6px', borderRadius: 10, display: 'inline-block', marginTop: 2,
                  }}>
                    {statusCfg.label}
                  </span>
                </div>
                {idx < stops.length - 1 && (
                  <div style={{ position: 'absolute', left: 24, width: 1, height: 12, background: 'var(--border)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Status legend */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 }}>
            Status Legend
          </div>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.label}</span>
            </div>
          ))}

          <div style={{ marginTop: 16, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent)' }}>Key Rule:</strong> Intermediate hubs always show
            <strong> "Arrived"</strong> — never "Delivered". Only the final destination stop can be marked <strong>"Delivered"</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const hdr = {
  bar: {
    background: 'var(--bg-card)',
    padding: '16px 32px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  title: { fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 },
  sub: { fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' },
};

const lbl = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 };

function progressBar(stops) {
  const total = stops.length;
  const done = stops.filter(s => s.status === 'arrived' || s.status === 'delivered').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDelivered = stops[stops.length - 1]?.status === 'delivered';

  return {
    height: 6,
    borderRadius: 3,
    background: 'var(--bg-input)',
    overflow: 'hidden',
    position: 'relative',
    // inner fill via pseudo (use inline children approach instead)
    backgroundImage: `linear-gradient(90deg, ${isDelivered ? '#10b981' : '#00d4ff'} ${pct}%, var(--bg-input) ${pct}%)`,
    transition: 'background-image 0.5s',
    marginBottom: 4,
  };
}
