import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../context/AuthContext';

export default function DispatchPage() {
  const [tab, setTab] = useState('orders'); // 'orders' or 'drivers'
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  
  // Onboarding Form
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', email: '', password: '', assignedArea: '', vehicleType: 'Truck', vehicleCapacity: 1000, vehicleLicensePlate: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resOrders, resDrivers] = await Promise.all([
        api.get('/orders?status=pending'),
        api.get('/dispatch/drivers')
      ]);
      // Filter orders to only show those without shipments
      setOrders(resOrders.data.orders.filter(o => !o.shipment));
      setDrivers(resDrivers.data.drivers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAutoAssign = async () => {
    setAssigning(true);
    try {
      const res = await api.post('/dispatch/auto-assign');
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Auto-assign failed');
    } finally {
      setAssigning(false);
    }
  };

  const handleOnboardDriver = async (e) => {
    e.preventDefault();
    setAssigning(true);
    try {
      await api.post('/dispatch/drivers', driverForm);
      alert('Driver onboarded successfully');
      setShowDriverModal(false);
      setDriverForm({ name: '', email: '', password: '', assignedArea: '', vehicleType: 'Truck', vehicleCapacity: 1000, vehicleLicensePlate: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to onboard driver');
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async (orderId, driverId) => {
    setAssigning(true);
    try {
      await api.post('/dispatch/manual-assign', { orderId, driverId });
      alert('Order assigned manually');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispatch & Fleet Management</h1>
          <p className="page-subtitle">Auto-assign orders, onboard drivers, and manage dispatching.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowDriverModal(true)}>+ Onboard Driver</button>
          <button className="btn btn-primary" onClick={handleAutoAssign} disabled={assigning || orders.length === 0}>
            {assigning ? 'Assigning...' : '⚡ Auto-Assign All'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <button 
          style={{ padding: '12px 16px', background: 'none', border: 'none', color: tab === 'orders' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: tab === 'orders' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600 }} 
          onClick={() => setTab('orders')}
        >
          Unassigned Orders ({orders.length})
        </button>
        <button 
          style={{ padding: '12px 16px', background: 'none', border: 'none', color: tab === 'drivers' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: tab === 'drivers' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600 }} 
          onClick={() => setTab('drivers')}
        >
          Fleet & Drivers ({drivers.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : tab === 'orders' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {orders.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No unassigned pending orders.</div>}
          {orders.map(o => (
            <div key={o._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>{o.orderNumber}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  From: {o.pickupAddress?.city} → To: {o.deliveryAddress?.city}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <select className="form-select" style={{ width: 200 }} onChange={(e) => {
                  if (e.target.value) handleManualAssign(o._id, e.target.value);
                }}>
                  <option value="">Manual Assign...</option>
                  {drivers.map(d => (
                    <option key={d._id} value={d._id}>{d.name} ({d.assignedArea || 'Any'})</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {drivers.map(d => (
            <div key={d._id} className="card">
              <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>{d.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.email}</div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Area:</span> {d.assignedArea || 'Unassigned (All)'}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Vehicle:</span> {d.vehicleType} ({d.vehicleCapacity}kg)</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Plate:</span> {d.vehicleLicensePlate}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDriverModal && (
        <div className="modal-overlay" onClick={() => setShowDriverModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Onboard New Driver</span>
              <button className="close-btn" onClick={() => setShowDriverModal(false)}>✕</button>
            </div>
            <form onSubmit={handleOnboardDriver}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={driverForm.email} onChange={e => setDriverForm({...driverForm, email: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Password *</label>
                  <input className="form-input" type="password" value={driverForm.password} onChange={e => setDriverForm({...driverForm, password: e.target.value})} required minLength={6} />
                </div>
                <hr className="divider" />
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Assigned Area (City)</label>
                    <input className="form-input" value={driverForm.assignedArea} onChange={e => setDriverForm({...driverForm, assignedArea: e.target.value})} placeholder="e.g. New York" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vehicle Type</label>
                    <input className="form-input" value={driverForm.vehicleType} onChange={e => setDriverForm({...driverForm, vehicleType: e.target.value})} placeholder="Truck" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacity (kg)</label>
                    <input className="form-input" type="number" value={driverForm.vehicleCapacity} onChange={e => setDriverForm({...driverForm, vehicleCapacity: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Plate</label>
                    <input className="form-input" value={driverForm.vehicleLicensePlate} onChange={e => setDriverForm({...driverForm, vehicleLicensePlate: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDriverModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={assigning}>{assigning ? 'Saving...' : 'Onboard Driver'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
