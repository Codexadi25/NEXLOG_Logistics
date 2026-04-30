import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';
import { CountrySelect, StateSelect, CityInput } from '../common/LocationInput';

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
      setShipments(data.shipments || []);
      setTotal(data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const canManage = ['admin', 'manager'].includes(user?.role);

  const updateStatus = async (id, status, note = '') => {
    try {
      await api.patch(`/shipments/${id}`, { status, trackingEvent: { status, description: note || `Status changed to ${status}` } });
      fetchShipments();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    }
  };

  const STATUS_OPTIONS = ['scheduled','accepted','picked_up','in_transit','reached_drop','out_for_delivery','delivered','failed','returned'];

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
        <select className="form-select" style={{ maxWidth: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
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
                  <th>Assigned Orders</th>
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
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.vehicle?.licensePlate || s.driver.phone}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {s.orders?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 200 }}>
                          {s.orders.slice(0, 3).map((o, i) => (
                            <div key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)',
                              borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font-mono)'
                            }}>
                              <span style={{ color: 'var(--accent)' }}>{typeof o === 'object' ? o.orderNumber : o?.toString?.().slice(-8)}</span>
                              {typeof o === 'object' && o.status && (
                                <span className={`badge badge-${o.status}`} style={{ fontSize: 9, padding: '1px 4px' }}>{o.status.replace(/_/g, ' ')}</span>
                              )}
                            </div>
                          ))}
                          {s.orders.length > 3 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{s.orders.length - 3} more</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No orders</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {s.origin?.city && <span>{s.origin.city}</span>}
                      {s.origin?.city && s.destination?.city && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>}
                      {s.destination?.city && <span>{s.destination.city}</span>}
                    </td>
                    <td>
                      {canManage ? (
                        <select className="form-select" style={{ padding: '4px 8px', fontSize: 12, minWidth: 155 }}
                          value={s.status} onChange={e => updateStatus(s._id, e.target.value)}>
                          {STATUS_OPTIONS.map(st => (
                            <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge badge-${s.status}`}>{s.status?.replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td><span className={`badge badge-${s.priority}`}>{s.priority || 'normal'}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelected(s)}>Details</button>
                    </td>
                  </tr>
                ))}
                {!shipments.length && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                    No shipments yet
                    {canManage && <> · <button className="btn btn-primary btn-sm" onClick={() => setCreateModal(true)}>Create one</button></>}
                  </td></tr>
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
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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

          {/* Assigned Orders */}
          {s.orders?.length > 0 && (
            <div>
              <div style={labelStyle}>ASSIGNED ORDERS ({s.orders.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {s.orders.map((o, i) => typeof o === 'object' ? (
                  <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{o.orderNumber}</span>
                      <span className={`badge badge-${o.status}`}>{o.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Client: {o.client?.name || '—'}
                      {o.deliveryAddress && <> · To: {o.deliveryAddress.city}, {o.deliveryAddress.state}</>}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 12 }}>Order ID: {o}</div>
                ))}
              </div>
            </div>
          )}

          {s.currentLocation && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={labelStyle}>CURRENT LOCATION</div>
              <div style={{ color: 'var(--accent)' }}>{s.currentLocation.city}, {s.currentLocation.state}</div>
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
                <CityInput country={locForm.country} state={locForm.state} value={locForm.city} onChange={v => setLocForm(f => ({ ...f, city: v }))} placeholder="City" />
                <StateSelect country={locForm.country} value={locForm.state} onChange={v => setLocForm(f => ({ ...f, state: v, city: '' }))} />
              </div>
              <CountrySelect value={locForm.country} onChange={v => setLocForm(f => ({ ...f, country: v, state: '', city: '' }))} style={{ marginTop: 8 }} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={updateLocation}>Update Location</button>
            </div>
          )}

          {/* Tracking timeline */}
          <div>
            <div style={labelStyle}>TRACKING EVENTS ({s.trackingEvents?.length || 0})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 16, borderLeft: '2px solid var(--border)' }}>
              {(s.trackingEvents || []).slice().reverse().map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, position: 'relative', marginLeft: -9 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border)', border: '2px solid var(--bg-card)', flexShrink: 0, marginTop: 4 }} />
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
    driverId: '',
    origin: { address: '', city: '', state: '', country: '' },
    destination: { address: '', city: '', state: '', country: '' },
    estimatedDelivery: '',
    notes: '',
  });
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dispatch/drivers')
      .then(r => setDrivers(r.data.drivers || []))
      .catch(console.error);
  }, []);

  const selectedDriver = drivers.find(d => d._id === form.driverId);



  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.origin.city) return setError('Origin city is required');
    if (!form.destination.city) return setError('Destination city is required');

    setLoading(true);
    try {
      const payload = {
        status: form.status,
        priority: form.priority,
        origin: form.origin,
        destination: form.destination,
        notes: form.notes,
      };
      if (form.driverId) {
        payload.driver = form.driverId;
        if (selectedDriver) {
          payload.vehicle = {
            type: selectedDriver.vehicleType,
            licensePlate: selectedDriver.vehicleLicensePlate,
          };
        }
      }
      if (form.estimatedDelivery) payload.estimatedDelivery = form.estimatedDelivery;

      await api.post('/shipments', payload);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <span className="modal-title">NEW SHIPMENT</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12 }}>{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Estimated Delivery</label>
                <input className="form-input" type="datetime-local" value={form.estimatedDelivery} onChange={e => setForm(f => ({ ...f, estimatedDelivery: e.target.value }))} />
              </div>
            </div>

            {/* Driver */}
            <div className="form-group">
              <label className="form-label">Delivery Partner (License Plate)</label>
              <select className="form-select" value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                <option value="">Unassigned (assign later)</option>
                {drivers.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.vehicleLicensePlate ? `${d.vehicleLicensePlate} — ` : ''}{d.name} ({d.assignedArea || 'All Areas'})
                  </option>
                ))}
              </select>
              {selectedDriver && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  🚗 {selectedDriver.vehicleType} · Capacity: {selectedDriver.vehicleCapacity}kg · Plate: {selectedDriver.vehicleLicensePlate || '—'}
                </div>
              )}
            </div>

            {/* Origin */}
            <div>
              <div style={labelStyle}>ORIGIN (Pickup)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="Street address" value={form.origin.address} onChange={e => setForm(f => ({ ...f, origin: { ...f.origin, address: e.target.value } }))} />
                <CountrySelect value={form.origin.country} onChange={v => setForm(f => ({ ...f, origin: { ...f.origin, country: v, state: '', city: '' } }))} />
                <StateSelect country={form.origin.country} value={form.origin.state} onChange={v => setForm(f => ({ ...f, origin: { ...f.origin, state: v, city: '' } }))} />
                <CityInput country={form.origin.country} state={form.origin.state} value={form.origin.city} onChange={v => setForm(f => ({ ...f, origin: { ...f.origin, city: v } }))} placeholder="City *" />
              </div>
            </div>

            {/* Destination */}
            <div>
              <div style={labelStyle}>DESTINATION (Delivery)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="Street address" value={form.destination.address} onChange={e => setForm(f => ({ ...f, destination: { ...f.destination, address: e.target.value } }))} />
                <CountrySelect value={form.destination.country} onChange={v => setForm(f => ({ ...f, destination: { ...f.destination, country: v, state: '', city: '' } }))} />
                <StateSelect country={form.destination.country} value={form.destination.state} onChange={v => setForm(f => ({ ...f, destination: { ...f.destination, state: v, city: '' } }))} />
                <CityInput country={form.destination.country} state={form.destination.state} value={form.destination.city} onChange={v => setForm(f => ({ ...f, destination: { ...f.destination, city: v } }))} placeholder="City *" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Internal notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
