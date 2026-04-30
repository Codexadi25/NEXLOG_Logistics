import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';

export default function ShipmentsPage() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [createModal, setCreateModal] = useState(false);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/shipments', { params: { page, limit: 15, search, status: statusFilter } });
      setShipments(data.shipments);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const canManage = ['admin', 'manager'].includes(user?.role);

  const updateStatus = async (id, status, note = '') => {
    await api.patch(`/shipments/${id}`, { status, trackingEvent: { status, description: note } });
    fetchShipments();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">SHIPMENTS</div>
          <div className="page-subtitle">{total} shipments tracked</div>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setCreateModal(true)}>+ New Shipment</button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search tracking #…" style={{ maxWidth: 220 }}
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['scheduled','picked_up','in_transit','out_for_delivery','delivered','failed'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tracking #</th>
                  <th>Driver</th>
                  <th>Orders</th>
                  <th>Origin → Dest</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>ETA</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(s => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>{s.trackingNumber}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td>
                      {s.driver ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{s.driver.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.driver.phone}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>{s.orders?.length || 0} order(s)</td>
                    <td style={{ fontSize: 12 }}>
                      {s.origin?.city && <span>{s.origin.city}</span>}
                      {s.origin?.city && s.destination?.city && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>}
                      {s.destination?.city && <span>{s.destination.city}</span>}
                    </td>
                    <td>
                      {canManage ? (
                        <select className="form-select" style={{ padding: '4px 8px', fontSize: 12, minWidth: 140 }}
                          value={s.status} onChange={e => updateStatus(s._id, e.target.value)}>
                          {['scheduled','picked_up','in_transit','out_for_delivery','delivered','failed','returned'].map(st => (
                            <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge badge-${s.status}`}>{s.status?.replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td><span className={`badge badge-${s.priority}`}>{s.priority}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelected(s)}>Details</button>
                    </td>
                  </tr>
                ))}
                {!shipments.length && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>No shipments yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <button className="btn btn-secondary btn-sm" disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>

      {selected && <ShipmentDetailModal shipment={selected} onClose={() => setSelected(null)} onRefresh={fetchShipments} canManage={canManage} />}
      {createModal && <CreateShipmentModal onClose={() => setCreateModal(false)} onSave={() => { setCreateModal(false); fetchShipments(); }} />}
    </div>
  );
}

function ShipmentDetailModal({ shipment, onClose, onRefresh, canManage }) {
  const [s, setS] = useState(shipment);
  const [locForm, setLocForm] = useState({ address: '', city: '', state: '', country: '' });
  const [eventNote, setEventNote] = useState('');

  const refresh = async () => {
    const { data } = await api.get(`/shipments/${s._id}`);
    setS(data.shipment);
  };

  const updateLocation = async () => {
    await api.patch(`/shipments/${s._id}`, {
      currentLocation: locForm,
      trackingEvent: { status: s.status, description: `Location updated: ${locForm.city}`, location: locForm },
    });
    refresh();
    onRefresh();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{s.trackingNumber}</span>
          <span className={`badge badge-${s.status}`}>{s.status?.replace(/_/g, ' ')}</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div>
              <div style={labelStyle}>DRIVER</div>
              {s.driver ? <div>{s.driver.name} — {s.driver.phone}</div> : <div style={{ color: 'var(--text-muted)' }}>Not assigned</div>}
            </div>
            <div>
              <div style={labelStyle}>VEHICLE</div>
              <div>{s.vehicle?.type || '—'} {s.vehicle?.licensePlate && `(${s.vehicle.licensePlate})`}</div>
            </div>
          </div>

          {s.currentLocation && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={labelStyle}>CURRENT LOCATION</div>
              <div style={{ color: 'var(--accent)' }}>
                {s.currentLocation.city}, {s.currentLocation.state}
              </div>
              {s.currentLocation.lastUpdated && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Updated: {new Date(s.currentLocation.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {canManage && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={labelStyle}>UPDATE LOCATION</div>
              <div className="grid-2" style={{ marginTop: 8 }}>
                <input className="form-input" placeholder="City" value={locForm.city} onChange={e => setLocForm(f => ({ ...f, city: e.target.value }))} />
                <input className="form-input" placeholder="State" value={locForm.state} onChange={e => setLocForm(f => ({ ...f, state: e.target.value }))} />
              </div>
              <input className="form-input" placeholder="Street address (optional)" style={{ marginTop: 8 }} value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={updateLocation}>Update Location</button>
            </div>
          )}

          {/* Tracking timeline */}
          <div>
            <div style={labelStyle}>TRACKING EVENTS ({s.trackingEvents?.length || 0})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 16, borderLeft: '2px solid var(--border)' }}>
              {(s.trackingEvents || []).slice().reverse().map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, position: 'relative', marginLeft: -9 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-card)', flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <span className={`badge badge-${ev.status}`}>{ev.status?.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{new Date(ev.timestamp).toLocaleString()}</span>
                    {ev.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{ev.description}</div>}
                    {ev.location?.city && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {ev.location.city}, {ev.location.state}</div>}
                  </div>
                </div>
              ))}
              {!s.trackingEvents?.length && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No events yet</div>}
            </div>
          </div>

          {/* Proof of delivery */}
          {s.proofOfDelivery?.signatureSvg && (
            <div>
              <div style={labelStyle}>PROOF OF DELIVERY</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <div style={{ background: 'white', borderRadius: 8, padding: 8, maxWidth: 200 }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>SIGNATURE</div>
                  <div dangerouslySetInnerHTML={{ __html: s.proofOfDelivery.signatureSvg }} />
                </div>
                {s.proofOfDelivery.receivedBy && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Received by: {s.proofOfDelivery.receivedBy}</div>
                    {s.proofOfDelivery.timestamp && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.proofOfDelivery.timestamp).toLocaleString()}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function CreateShipmentModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    status: 'scheduled',
    priority: 'normal',
    origin: { address: '', city: '', state: '', country: 'US' },
    destination: { address: '', city: '', state: '', country: 'US' },
    vehicle: { type: 'truck', licensePlate: '', model: '' },
    estimatedDelivery: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (path, field) => (e) => {
    setForm(f => ({ ...f, [path]: { ...f[path], [field]: e.target.value } }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.estimatedDelivery) delete payload.estimatedDelivery;
      await api.post('/shipments', payload);
      onSave();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">NEW SHIPMENT</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ETA</label>
                <input className="form-input" type="datetime-local" value={form.estimatedDelivery} onChange={e => setForm(f => ({ ...f, estimatedDelivery: e.target.value }))} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Origin</div>
            <div className="grid-2">
              <input className="form-input" placeholder="City" value={form.origin.city} onChange={set('origin', 'city')} />
              <input className="form-input" placeholder="State" value={form.origin.state} onChange={set('origin', 'state')} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Destination</div>
            <div className="grid-2">
              <input className="form-input" placeholder="City" value={form.destination.city} onChange={set('destination', 'city')} />
              <input className="form-input" placeholder="State" value={form.destination.state} onChange={set('destination', 'state')} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Vehicle</div>
            <div className="grid-2">
              <input className="form-input" placeholder="Type (truck, van…)" value={form.vehicle.type} onChange={set('vehicle', 'type')} />
              <input className="form-input" placeholder="License plate" value={form.vehicle.licensePlate} onChange={set('vehicle', 'licensePlate')} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Shipment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 };
