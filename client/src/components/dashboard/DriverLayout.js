import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, api } from '../../context/AuthContext';
import '../../App.css';

export default function DriverLayout() {
  const { user, logout } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      // Assuming GET /api/shipments?driver=me or the backend automatically filters if role=driver
      const { data } = await api.get('/shipments');
      setShipments(data.shipments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>NEXLOG Driver</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ color: 'var(--text-secondary)' }}>{user.name}</div>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
        </div>
      </header>
      
      <main style={styles.main}>
        <div className="page-header">
          <div>
            <h1 className="page-title">My Deliveries</h1>
            <p className="page-subtitle">Manage your assigned shipments</p>
          </div>
          <button className="btn btn-secondary" onClick={fetchShipments} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {shipments.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚚</div>
            <div style={{ fontSize: 18, color: 'var(--text-secondary)' }}>No active shipments assigned.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {shipments.map(s => (
              <div key={s._id} style={{ ...styles.card, ...(selectedShipment?._id === s._id ? styles.cardActive : {}) }} onClick={() => setSelectedShipment(s)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--accent)', fontWeight: 'bold' }}>{s.trackingNumber}</div>
                  <span className={`badge badge-${s.status}`}>{s.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="grid-2">
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pickup From</div>
                    <div>{s.origin?.city}, {s.origin?.state}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deliver To</div>
                    <div>{s.destination?.city}, {s.destination?.state}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedShipment && (
        <ShipmentActionsModal 
          shipment={selectedShipment} 
          onClose={() => setSelectedShipment(null)} 
          onRefresh={() => { fetchShipments(); setSelectedShipment(null); }} 
        />
      )}
    </div>
  );
}

function ShipmentActionsModal({ shipment, onClose, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(shipment.status);
  const [reason, setReason] = useState('');

  const FAILURE_REASONS = [
    'Unavailable to Pickup', 
    'Requested Return', 
    'Order not required anymore', 
    'Requested Replacement', 
    'Met with Accident', 
    'Order Lost/Damaged', 
    'Store Closed'
  ];

  const STATUS_FLOW = ['scheduled', 'accepted', 'picked_up', 'in_transit', 'reached_drop', 'out_for_delivery', 'delivered', 'failed'];

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        status,
        trackingEvent: {
          status,
          description: status === 'failed' ? `Failed: ${reason}` : `Status updated to ${status.replace(/_/g, ' ')}`,
        }
      };
      await api.patch(`/shipments/${shipment._id}`, payload);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Update Shipment</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleUpdate}>
          <div className="modal-body">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--accent)', fontWeight: 'bold' }}>{shipment.trackingNumber}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                Current Status: <span className={`badge badge-${shipment.status}`}>{shipment.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">New Status</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_FLOW.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>

            {status === 'failed' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Reason for Failure</label>
                <select className="form-select" value={reason} onChange={e => setReason(e.target.value)} required>
                  <option value="">Select a reason...</option>
                  {FAILURE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || (status === 'failed' && !reason)}>
              {loading ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' },
  header: { height: 'var(--header-height)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 },
  headerTitle: { fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--accent)', fontWeight: 700, letterSpacing: 2 },
  main: { flex: 1, padding: '24px', maxWidth: 800, margin: '0 auto', width: '100%' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' },
  cardActive: { borderColor: 'var(--accent)' },
};
