import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';
import OrderModal from './OrderModal';
import { CountrySelect, StateSelect, CityInput } from '../common/LocationInput';

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [modal, setModal] = useState(null); // null | 'create' | order object
  const [selected, setSelected] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, ...filters };
      const { data } = await api.get('/orders', { params });
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    await api.delete(`/orders/${id}`);
    fetchOrders();
  };

  const handleStatusChange = async (orderId, status) => {
    await api.patch(`/orders/${orderId}`, { status });
    fetchOrders();
  };

  const canEdit = ['admin', 'manager'].includes(user?.role);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">ORDERS</div>
          <div className="page-subtitle">{total} total orders</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New Order</button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          className="form-input"
          placeholder="Search orders…"
          style={{ maxWidth: 240 }}
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select className="form-select" style={{ maxWidth: 160 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {['pending','confirmed','processing','in_transit','out_for_delivery','delivered','cancelled'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select className="form-select" style={{ maxWidth: 140 }} value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priorities</option>
          {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ status: '', priority: '', search: '' })}>Clear</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Client</th>
                  <th>Items</th>
                  <th>Pickup</th>
                  <th>Delivery</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order._id}>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>{order.orderNumber}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{order.client?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.client?.company}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: 180 }}>
                        {order.items?.slice(0, 3).map((item, i) => (
                          <div key={i} style={styles.itemChip} title={item.name}>
                            {item.svgImage ? (
                              <span style={{ fontSize: 10 }}>🖼</span>
                            ) : (
                              <span style={{ fontSize: 10 }}>📦</span>
                            )}
                            {item.name?.slice(0, 10)}
                          </div>
                        ))}
                        {order.items?.length > 3 && <div style={styles.itemChip}>+{order.items.length - 3}</div>}
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {order.pickupAddress ? `${order.pickupAddress.city}, ${order.pickupAddress.state}` : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {order.deliveryAddress ? `${order.deliveryAddress.city}, ${order.deliveryAddress.state}` : '—'}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: 12, minWidth: 130 }}
                          value={order.status}
                          onChange={e => handleStatusChange(order._id, e.target.value)}
                        >
                          {['pending','confirmed','processing','in_transit','out_for_delivery','delivered','cancelled','returned'].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge badge-${order.status}`}>{order.status?.replace('_', ' ')}</span>
                      )}
                    </td>
                    <td><span className={`badge badge-${order.priority}`}>{order.priority}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(order)}>View</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal(order)}>Edit</button>
                        {user?.role === 'admin' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(order._id)}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}>
                    No orders found. <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>Create one</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={styles.pagination}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Showing {Math.min((page - 1) * 15 + 1, total)}–{Math.min(page * 15, total)} of {total}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <button className="btn btn-secondary btn-sm" disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Modals */}
      {(modal === 'create' || (modal && modal !== 'create')) && (
        <OrderModal
          order={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchOrders(); }}
        />
      )}

      {selected && (
        <OrderDetailModal order={selected} onClose={() => setSelected(null)} onRefresh={fetchOrders} />
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose, onRefresh }) {
  const [current, setCurrent] = useState(order);

  useEffect(() => {
    api.get(`/orders/${order._id}`).then(r => setCurrent(r.data.order));
  }, [order._id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{current.orderNumber}</span>
          <span className={`badge badge-${current.status}`}>{current.status?.replace('_', ' ')}</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div>
              <div style={styles.detailSection}>PICKUP INFO</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                {current.pickupAddress ? (
                  <>{current.pickupAddress.street}<br />{current.pickupAddress.city}, {current.pickupAddress.state} {current.pickupAddress.postalCode}</>
                ) : '—'}
              </div>
              {current.pickupAddress?.googleMapLocation && (
                <a href={current.pickupAddress.googleMapLocation} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>📍</span> View on Map
                </a>
              )}
            </div>
            <div>
              <div style={styles.detailSection}>DELIVERY INFO</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                {current.deliveryAddress ? (
                  <>{current.deliveryAddress.street}<br />{current.deliveryAddress.city}, {current.deliveryAddress.state} {current.deliveryAddress.postalCode}</>
                ) : '—'}
              </div>
              {current.deliveryAddress?.googleMapLocation && (
                <a href={current.deliveryAddress.googleMapLocation} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>📍</span> View on Map
                </a>
              )}
              {current.scheduledDelivery && (
                <div style={{ marginTop: 8, color: 'var(--accent)', fontSize: 12 }}>
                  Scheduled: {new Date(current.scheduledDelivery).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <hr className="divider" />

          <div style={styles.detailSection}>ITEMS ({current.items?.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {current.items?.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 300, height: 300, background: 'var(--bg-input)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  {item.svgImage ? (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: item.svgImage }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} />
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(13, 21, 38, 0.8)', backdropFilter: 'blur(4px)' }}
                        onClick={() => {
                          const blob = new Blob([item.svgImage], { type: 'image/svg+xml' });
                          window.open(URL.createObjectURL(blob), '_blank');
                        }}
                      >
                        ↗ Full Size
                      </button>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 48 }}>📦</div>
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-primary)' }}>{item.name}</div>
                  {item.sku && <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>SKU:</span> {item.sku}</div>}
                  <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>QUANTITY:</span> <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.quantity}</span></div>
                  {item.weight && <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>WEIGHT:</span> {item.weight} kg</div>}
                  {item.description && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>DESCRIPTION:</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{item.description}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {current.statusHistory?.length > 0 && (
            <>
              <hr className="divider" />
              <div style={styles.detailSection}>STATUS HISTORY</div>
              <div style={styles.timeline}>
                {current.statusHistory.map((s, i) => (
                  <div key={i} style={styles.timelineItem}>
                    <div style={styles.timelineDot} />
                    <div>
                      <span className={`badge badge-${s.status}`}>{s.status?.replace('_', ' ')}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {new Date(s.timestamp).toLocaleString()}
                      </span>
                      {s.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {!current.shipment && (
            <AssignShipmentButton order={current} onRefresh={() => { api.get(`/orders/${order._id}`).then(r => setCurrent(r.data.order)); onRefresh(); }} />
          )}
          {current.shipment && (
            <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
              ✓ Assigned to shipment
            </div>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  filters: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
  empty: { padding: '48px', textAlign: 'center', color: 'var(--text-muted)' },
  itemChip: {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: '4px', padding: '2px 6px', fontSize: '11px', color: 'var(--text-secondary)',
  },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
  detailSection: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 },
  itemsGrid: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  itemCard: { display: 'flex', gap: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', width: '200px' },
  itemImageBox: { width: '52px', height: '52px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemInfo: { flex: 1, overflow: 'hidden' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '16px', borderLeft: '2px solid var(--border)' },
  timelineItem: { display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative', marginLeft: '-9px' },
  timelineDot: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-card)', flexShrink: 0, marginTop: '4px' },
};

function AssignShipmentButton({ order, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
        🚚 Assign to Shipment
      </button>
      {showModal && (
        <AssignShipmentModal
          order={order}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </>
  );
}

function AssignShipmentModal({ order, onClose, onSave }) {
  const [existingShipments, setExistingShipments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [newForm, setNewForm] = useState({
    driverId: '',
    priority: order.priority || 'normal',
    estimatedDelivery: '',
    notes: '',
    origin: {
      address: order.pickupAddress?.street || '',
      city: order.pickupAddress?.city || '',
      state: order.pickupAddress?.state || '',
      country: order.pickupAddress?.country || '',
    },
    destination: {
      address: order.deliveryAddress?.street || '',
      city: order.deliveryAddress?.city || '',
      state: order.deliveryAddress?.state || '',
      country: order.deliveryAddress?.country || '',
    },
  });

  useEffect(() => {
    Promise.all([
      api.get('/shipments', { params: { status: 'scheduled', limit: 50 } }),
      api.get('/dispatch/drivers'),
    ]).then(([sRes, dRes]) => {
      setExistingShipments(sRes.data.shipments || []);
      setDrivers(dRes.data.drivers || []);
    }).catch(console.error);
  }, []);

  const selectedDriver = drivers.find(d => d._id === newForm.driverId);

  const handleAssignExisting = async () => {
    if (!selectedShipmentId) return alert('Please select a shipment');
    setLoading(true);
    try {
      // Add order to the existing shipment
      await api.post('/dispatch/manual-assign', { orderId: order._id, shipmentId: selectedShipmentId });
      onSave();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign');
    } finally { setLoading(false); }
  };

  const handleCreateNew = async () => {
    if (!newForm.driverId) return alert('Please select a driver');
    setLoading(true);
    try {
      await api.post('/dispatch/manual-assign', { orderId: order._id, driverId: newForm.driverId, newShipmentData: newForm });
      onSave();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create shipment');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Assign {order.orderNumber} to Shipment</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setMode('existing')}
              style={{ flex: 1, padding: '10px 16px', background: mode === 'existing' ? 'var(--accent)' : 'transparent', color: mode === 'existing' ? 'var(--bg-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Add to Existing Shipment
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              style={{ flex: 1, padding: '10px 16px', background: mode === 'new' ? 'var(--accent)' : 'transparent', color: mode === 'new' ? 'var(--bg-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Create New Shipment
            </button>
          </div>

          {mode === 'existing' ? (
            <div>
              {existingShipments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                  No scheduled shipments available.<br />
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setMode('new')}>Create a new one</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {existingShipments.map(s => (
                    <label
                      key={s._id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                        background: selectedShipmentId === s._id ? 'rgba(0,212,255,0.08)' : 'var(--bg-secondary)',
                        border: `1px solid ${selectedShipmentId === s._id ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      <input type="radio" name="shipment" value={s._id} checked={selectedShipmentId === s._id} onChange={() => setSelectedShipmentId(s._id)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{s.trackingNumber}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {s.origin?.city} → {s.destination?.city} · Driver: {s.driver?.name || 'Unassigned'} · {s.orders?.length || 0} orders
                        </div>
                      </div>
                      <span className={`badge badge-${s.status}`}>{s.status}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Delivery Partner (License Plate) *</label>
                <select className="form-select" value={newForm.driverId} onChange={e => setNewForm(f => ({ ...f, driverId: e.target.value }))}>
                  <option value="">Select Driver...</option>
                  {drivers.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.vehicleLicensePlate ? `${d.vehicleLicensePlate} — ` : ''}{d.name} ({d.assignedArea || 'All Areas'})
                    </option>
                  ))}
                </select>
                {selectedDriver && (
                  <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    🚗 {selectedDriver.vehicleType} · Capacity: {selectedDriver.vehicleCapacity}kg · Plate: {selectedDriver.vehicleLicensePlate || '—'}
                  </div>
                )}
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={newForm.priority} onChange={e => setNewForm(f => ({ ...f, priority: e.target.value }))}>
                    {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Delivery</label>
                  <input className="form-input" type="datetime-local" value={newForm.estimatedDelivery} onChange={e => setNewForm(f => ({ ...f, estimatedDelivery: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>ORIGIN (Pickup)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="form-input" placeholder="Street address" value={newForm.origin.address} onChange={e => setNewForm(f => ({ ...f, origin: { ...f.origin, address: e.target.value } }))} />
                    <CountrySelect value={newForm.origin.country} onChange={v => setNewForm(f => ({ ...f, origin: { ...f.origin, country: v, state: '', city: '' } }))} />
                    <StateSelect country={newForm.origin.country} value={newForm.origin.state} onChange={v => setNewForm(f => ({ ...f, origin: { ...f.origin, state: v, city: '' } }))} />
                    <CityInput country={newForm.origin.country} state={newForm.origin.state} value={newForm.origin.city} onChange={v => setNewForm(f => ({ ...f, origin: { ...f.origin, city: v } }))} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>DESTINATION (Delivery)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="form-input" placeholder="Street address" value={newForm.destination.address} onChange={e => setNewForm(f => ({ ...f, destination: { ...f.destination, address: e.target.value } }))} />
                    <CountrySelect value={newForm.destination.country} onChange={v => setNewForm(f => ({ ...f, destination: { ...f.destination, country: v, state: '', city: '' } }))} />
                    <StateSelect country={newForm.destination.country} value={newForm.destination.state} onChange={v => setNewForm(f => ({ ...f, destination: { ...f.destination, state: v, city: '' } }))} />
                    <CityInput country={newForm.destination.country} state={newForm.destination.state} value={newForm.destination.city} onChange={v => setNewForm(f => ({ ...f, destination: { ...f.destination, city: v } }))} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || (mode === 'existing' && !selectedShipmentId) || (mode === 'new' && !newForm.driverId)}
            onClick={mode === 'existing' ? handleAssignExisting : handleCreateNew}
          >
            {loading ? 'Assigning...' : (mode === 'existing' ? 'Add to Shipment' : 'Create & Assign Shipment')}
          </button>
        </div>
      </div>
    </div>
  );
}

