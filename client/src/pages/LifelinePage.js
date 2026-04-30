import React, { useState } from 'react';
import { api } from '../context/AuthContext';

const SEARCH_MODES = [
  { id: 'order_id', label: 'Order ID / No.' },
  { id: 'tracking_id', label: 'Tracking No.' },
  { id: 'shipment_id', label: 'Shipment ID' },
  { id: 'driver_phone', label: 'Driver Phone' },
  { id: 'driver_name', label: 'Driver Name' },
  { id: 'driver_id', label: 'FE / Driver ID' },
  { id: 'vehicle_id', label: 'Vehicle Plate' },
  { id: 'customer_email', label: 'Customer Email' },
  { id: 'customer_id', label: 'Customer ID' },
  { id: 'store_id', label: 'Store / Vendor ID' },
];

const ORDER_LIFECYCLE_STEPS = [
  { key: 'pending', label: 'Placed', offset: 0 },
  { key: 'confirmed', label: 'Confirmed', offset: 15 },
  { key: 'processing', label: 'Ready', offset: 30 },
  { key: 'assigned', label: 'Assigned', offset: 45 },
  { key: 'picked_up', label: 'Picked', offset: 60 },
  { key: 'in_transit', label: 'Transit', offset: 75 },
  { key: 'delivered', label: 'Delivered', offset: 100 },
];

export default function LifelinePage() {
  const [mode, setMode] = useState('order_id');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activeNoteOrderId, setActiveNoteOrderId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyIcon = ({ k }) => copiedKey === k ? <span style={{fontSize: 10, color: 'var(--success)', marginLeft: 6}}>✓ Copied</span> : null;
  const [noteText, setNoteText] = useState('');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/lifeline/search', { mode, query });
      setResults(data.orders);
      if (data.orders.length === 0) setError('No orders found matching this query.');
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (orderId) => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/lifeline/orders/${orderId}/notes`, { note: noteText, type: 'note' });
      setNoteText('');
      setActiveNoteOrderId(null);
      handleSearch(); // Refresh data
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add note');
    }
  };

  const handleAddTag = async (orderId, tag) => {
    const t = prompt('Enter new tag:');
    if (!t) return;
    try {
      await api.post(`/lifeline/orders/${orderId}/tags`, { tag: t });
      handleSearch();
    } catch (err) {
      alert('Failed to add tag');
    }
  };

  const getEventTime = (order, statusKey) => {
    // 1. Check order statusHistory
    const hist = order.statusHistory?.find(h => h.status === statusKey);
    if (hist) return new Date(hist.timestamp);
    // 2. Check shipment trackingEvents
    const sHist = order.shipment?.trackingEvents?.find(e => e.status === statusKey);
    if (sHist) return new Date(sHist.timestamp);
    // 3. Fallback for 'pending'/'placed'
    if (statusKey === 'pending') return new Date(order.createdAt);
    return null;
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflowY: 'auto' }}>
        {/* Search Header */}
        <div style={{ background: 'var(--bg-card)', padding: '12px 30px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}></span>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Support Lifeline</h1>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Track and trace complete order lifecycles</div>
            </div>
          </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flex: 1, maxWidth: 600, marginLeft: 24 }}>
          <select className="form-select" style={{ width: 160, flexShrink: 0 }} value={mode} onChange={e => setMode(e.target.value)}>
            {SEARCH_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: 11, color: 'var(--text-muted)' }}>🔍</span>
            <input 
              className="form-input" 
              style={{ paddingLeft: 40, width: '100%' }} 
              placeholder="Start searching..." 
              value={query} onChange={e => setQuery(e.target.value)} 
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 100 }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Results Area */}
      <div style={{ padding: '24px 30px' }}>
        {error && <div style={{ background: 'rgba(255,61,87,0.1)', color: 'var(--danger)', padding: 16, borderRadius: 8, marginBottom: 20 }}>{error}</div>}
        
        {results.length > 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, fontWeight: 600 }}>Showing {results.length} result(s)</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {results.map((order) => {
            const client = order.client;
            const fe = order.assignedTo;
            const ship = order.shipment;
            const isDelivered = order.status === 'delivered';
            const isFailed = order.status === 'failed' || order.status === 'cancelled';

            return (
              <div key={order._id} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                
                {/* 1. Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>ORDER ID</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer' }} onClick={() => handleCopy(order.orderNumber, `order-${order._id}`)}>
                        {order.orderNumber} <CopyIcon k={`order-${order._id}`} />
                      </div>
                    </div>
                    {ship && (
                      <div style={{ paddingLeft: 16, borderLeft: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>SHIPMENT / AWB</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)', fontSize: 14, cursor: 'pointer' }} onClick={() => handleCopy(ship.trackingNumber, `ship-${ship._id}`)}>
                          {ship.trackingNumber} <CopyIcon k={`ship-${ship._id}`} />
                        </div>
                      </div>
                    )}
                    <div style={{ paddingLeft: 16, borderLeft: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>DATE</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(order.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {order.tags?.map((t, i) => (
                        <span key={i} style={{ background: 'var(--bg-input)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{t}</span>
                      ))}
                      <button onClick={() => handleAddTag(order._id)} style={{ background: 'none', border: '1px dashed var(--border-active)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}>+ Tag</button>
                    </div>
                    <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>📞 Call Logs</button>
                    <button className="btn btn-secondary btn-sm">ℹ️ Help</button>
                  </div>
                </div>

                {/* 2. Four Horizontal Panes Section */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                  
                  {/* Pane 1: Customer Details */}
                  <div style={{ flex: 1, padding: 20, borderRight: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 16 }}>👤</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{client?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CxID: {client?._id?.substring(0,8)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => { if(client?.phone) handleCopy(client.phone, `cx-ph-${client._id}`) }}>
                        📞 {client?.phone || 'N/A'} <span style={{ color: 'var(--success)' }}>✓</span> <CopyIcon k={`cx-ph-${client._id}`} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => { if(client?.email) handleCopy(client.email, `cx-em-${client._id}`) }}>
                        ✉️ {client?.email} <span style={{ color: 'var(--success)' }}>✓</span> <CopyIcon k={`cx-em-${client._id}`} />
                      </div>
                    </div>
                    <div style={{ marginTop: 16, background: 'var(--bg-primary)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment</span>
                        <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>Success</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>₹{order.totalValue || '0.00'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Mode: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Online/UPI</span></div>
                    </div>
                  </div>

                  {/* Pane 2: Merchant / Pickup Details */}
                  <div style={{ flex: 1, padding: 20, borderRight: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 16 }}>🏪</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{order.pickupAddress?.company || 'Merchant Hub'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>HubID: {client?._id?.substring(8,16) || 'Unknown'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <div>📍 {order.pickupAddress?.street}, {order.pickupAddress?.city}</div>
                      <div>📞 {order.pickupAddress?.phone || 'N/A'}</div>
                    </div>
                    <div style={{ marginTop: 16, fontSize: 12, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span> Store Open
                    </div>
                    {order.notes && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', fontStyle: 'italic' }}>
                        "{order.notes}"
                      </div>
                    )}
                  </div>

                  {/* Pane 3: Delivery Partner / FE Details */}
                  <div style={{ flex: 1, padding: 20, borderRight: '1px solid var(--border)', background: fe ? 'transparent' : 'var(--bg-primary)' }}>
                    {fe ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 16 }}>🚴</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fe.name}</span>
                              <span style={{ background: 'var(--success)', color: 'var(--)', fontSize: 10, padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>4.8 ★</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>FE ID: {fe._id?.substring(0,8)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => { if(fe?.phone) handleCopy(fe.phone, `fe-ph-${fe._id}`) }}>
                            📞 {fe.phone || 'N/A'} <span style={{ color: 'var(--success)' }}>✓</span> <CopyIcon k={`fe-ph-${fe._id}`} />
                          </div>
                          <div>🚗 {fe.vehicleType || 'Bike'} • {fe.vehicleLicensePlate || 'N/A'}</div>
                        </div>
                        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                          <span style={{ background: 'var(--accent)', color: 'var(--)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>NEXLOG Delivery</span>
                          <span style={{ background: 'var(--warning)', color: 'var(--)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Gig</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <span style={{ fontSize: 24, marginBottom: 8 }}>⏳</span>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Unassigned</div>
                        <div style={{ fontSize: 11 }}>No delivery partner assigned yet</div>
                      </div>
                    )}
                  </div>

                  {/* Pane 4: Map/Route (Placeholder) */}
                  <div style={{ flex: 1, background: 'var(--bg-input)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 6, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: 13, color: isDelivered ? 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--accent)' }}>
                        {order.status?.toUpperCase()}
                      </div>
                      <a href={`/track?id=${ship?.trackingNumber || order.orderNumber}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        <button className="btn btn-secondary btn-sm" style={{ marginTop: 12, background: 'var(--bg-card)', cursor: 'pointer' }}>🗺️ View Live Route</button>
                      </a>
                    </div>
                  </div>
                </div>

                {/* 3. Lifecycle Crystal Screen & Comments Section */}
                <div style={{ display: 'flex' }}>
                  
                  {/* Left: Crystal Timeline */}
                  <div style={{ flex: 3, padding: '24px 30px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>ℹ️</span> Order Progress
                    </div>
                    
                    <div style={{ position: 'relative', paddingTop: 20, paddingBottom: 20 }}>
                      {/* Base Line */}
                      <div style={{ position: 'absolute', top: 25, left: 10, right: 10, height: 3, background: 'var(--bg-input)', zIndex: 1 }}></div>
                      
                      {/* Active Line */}
                      {(() => {
                        let activeWidth = 0;
                        if (isDelivered) activeWidth = 100;
                        else if (ship?.status === 'in_transit') activeWidth = 75;
                        else if (ship?.status === 'picked_up') activeWidth = 60;
                        else if (fe) activeWidth = 45;
                        else if (order.status === 'processing') activeWidth = 30;
                        else if (order.status === 'confirmed') activeWidth = 15;

                        return <div style={{ position: 'absolute', top: 25, left: 10, width: `calc(${activeWidth}% - 20px)`, height: 3, background: 'var(--accent)', zIndex: 2, transition: 'width 0.5s' }}></div>;
                      })()}

                      {/* Dots & Labels */}
                      {ORDER_LIFECYCLE_STEPS.map((step) => {
                        const time = getEventTime(order, step.key);
                        let isActive = false;
                        if (isDelivered) isActive = true;
                        else if (step.key === 'pending') isActive = true;
                        else if (step.key === 'confirmed' && ['confirmed','processing','in_transit','out_for_delivery','delivered'].includes(order.status)) isActive = true;
                        else if (step.key === 'processing' && ['processing','in_transit','out_for_delivery','delivered'].includes(order.status)) isActive = true;
                        else if (step.key === 'assigned' && fe) isActive = true;
                        else if (step.key === 'picked_up' && ['picked_up','in_transit','reached_drop','out_for_delivery','delivered'].includes(ship?.status)) isActive = true;
                        else if (step.key === 'in_transit' && ['in_transit','reached_drop','out_for_delivery','delivered'].includes(ship?.status)) isActive = true;
                        
                        return (
                          <div key={step.key} style={{ position: 'absolute', left: `${step.offset}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3, width: 80 }}>
                            <div style={{ 
                              width: 14, height: 14, borderRadius: '50%', 
                              background: isActive ? 'var(--accent)' : 'var(--)', 
                              border: `3px solid ${isActive ? 'var(--accent)' : 'var(--)'}`,
                              boxShadow: isActive ? '0 0 0 3px rgba(0,212,255,0.2)' : 'none'
                            }}></div>
                            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step.label}</div>
                            {time && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, textAlign: 'center' }}>{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Comments / Actions */}
                  <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Internal Comments</div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 120 }}>
                      {order.internalLogs?.map((log, i) => (
                        <div key={i} style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{log.note}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                            <span>{log.type}</span>
                          </div>
                        </div>
                      ))}
                      {(!order.internalLogs || order.internalLogs.length === 0) && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No comments yet.</div>
                      )}
                    </div>

                    {activeNoteOrderId === order._id ? (
                      <div>
                        <textarea 
                          className="form-input" 
                          style={{ width: '100%', minHeight: 60, fontSize: 12, padding: 8, marginBottom: 8 }} 
                          placeholder="Type comment..."
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setActiveNoteOrderId(null)}>Cancel</button>
                          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleAddNote(order._id)}>Add</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-secondary" style={{ width: '100%', borderStyle: 'dashed' }} onClick={() => setActiveNoteOrderId(order._id)}>
                        + Add Comment
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>
      </div> {/* End Main Content Area */}

      {/* Right Sidebar - Quick Actions */}
      <div style={{ width: 320, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 20 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Report An Issue</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Quick Actions</div>
        </div>
        
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <input className="form-input" style={{ width: '100%', padding: '10px 14px', fontSize: 13, background: 'var(--bg-primary)' }} placeholder="Lets start search..." />
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {[
            'Delayed Pickup',
            'Damaged / Lost in Transit',
            'Address Not Found',
            'Rider Unresponsive',
            'Customer Refused Delivery',
            'Payment Issue (COD)',
            'Escalate to Hub / Dispatch'
          ].map((action, i) => (
            <button key={i} className="btn btn-secondary" style={{ width: '100%', textAlign: 'left', padding: '12px 16px', marginBottom: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
              {action}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
