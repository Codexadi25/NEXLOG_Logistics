import React, { useState, useRef } from 'react';
import { api } from '../../context/AuthContext';
import { CountrySelect, StateSelect, CityInput } from '../common/LocationInput';

const emptyItem = () => ({ name: '', sku: '', quantity: 1, weight: '', description: '', svgImage: '' });
const emptyAddress = () => ({ company: '', contactName: '', street: '', city: '', state: '', postalCode: '', country: 'US', phone: '', googleMapLocation: '' });

export default function OrderModal({ order, onClose, onSave }) {
  const isEdit = !!order;
  const [form, setForm] = useState(order ? {
    items: order.items || [],
    pickupAddress: order.pickupAddress || emptyAddress(),
    deliveryAddress: order.deliveryAddress || emptyAddress(),
    priority: order.priority || 'normal',
    notes: order.notes || '',
    scheduledPickup: order.scheduledPickup ? order.scheduledPickup.slice(0, 16) : '',
    scheduledDelivery: order.scheduledDelivery ? order.scheduledDelivery.slice(0, 16) : '',
  } : {
    items: [emptyItem()],
    pickupAddress: emptyAddress(),
    deliveryAddress: emptyAddress(),
    priority: 'normal',
    notes: '',
    scheduledPickup: '',
    scheduledDelivery: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('items');
  const [uploadingItem, setUploadingItem] = useState(null);
  const [tabErrors, setTabErrors] = useState({});
  const fileRefs = useRef({});

  const getValue = (e) => e?.target?.value ?? '';

  const setAddress = (type) => (field) => (e) => {
    const value = getValue(e);
    setForm(f => ({
      ...f,
      [type]: { ...(f[type] || emptyAddress()), [field]: value },
    }));
    const tabKey = type === 'pickupAddress' ? 'pickup' : 'delivery';
    setTabErrors(prev => ({ ...prev, [tabKey]: false }));
  };

  const setItem = (idx, field) => (e) => {
    const value = getValue(e);
    setForm(f => {
      const items = [...(f.items || [])];
      items[idx] = { ...(items[idx] || emptyItem()), [field]: value };
      return { ...f, items };
    });
    setTabErrors(prev => ({ ...prev, items: false }));
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const handleImageUpload = async (idx, file) => {
    if (!file) return;
    setUploadingItem(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/images/convert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const items = [...form.items];
      items[idx] = { ...items[idx], svgImage: data.svg };
      setForm(f => ({ ...f, items }));
    } catch (err) {
      alert('Image conversion failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingItem(null);
    }
  };

  // Validate all tabs before submitting
  const validateForm = () => {
    const errors = {};
    let firstErrorTab = null;

    // Items validation
    if (form.items.length === 0) {
      errors.items = 'At least one item is required';
      firstErrorTab = firstErrorTab || 'items';
    } else {
      const hasInvalidItem = form.items.some(item => !item.name || !item.name.trim());
      if (hasInvalidItem) {
        errors.items = 'All items must have a name';
        firstErrorTab = firstErrorTab || 'items';
      }
    }

    // Pickup address validation
    const pa = form.pickupAddress;
    if (!pa.street || !pa.city || !pa.state || !pa.postalCode || !pa.googleMapLocation) {
      errors.pickup = 'Street, City, State, Postal Code, and Google Map Location are required';
      firstErrorTab = firstErrorTab || 'pickup';
    }

    // Delivery address validation
    const da = form.deliveryAddress;
    if (!da.street || !da.city || !da.state || !da.postalCode || !da.googleMapLocation) {
      errors.delivery = 'Street, City, State, Postal Code, and Google Map Location are required';
      firstErrorTab = firstErrorTab || 'delivery';
    }

    // Validate different locations
    if (!errors.pickup && !errors.delivery) {
      if (pa.googleMapLocation === da.googleMapLocation) {
        errors.delivery = 'Sender and Receiver Google Map locations cannot be the exact same.';
        firstErrorTab = firstErrorTab || 'delivery';
      }
    }

    return { errors, firstErrorTab };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate all tabs
    const { errors, firstErrorTab } = validateForm();
    setTabErrors(errors);

    if (firstErrorTab) {
      setTab(firstErrorTab);
      setError(errors[firstErrorTab]);
      return;
    }

    setLoading(true);
    try {
      // Sanitize payload to prevent Mongoose CastError on empty strings
      const payload = { ...form };
      if (!payload.scheduledPickup) delete payload.scheduledPickup;
      if (!payload.scheduledDelivery) delete payload.scheduledDelivery;
      
      payload.items = payload.items.map(item => {
        const sanitizedItem = { ...item };
        if (!sanitizedItem.weight) delete sanitizedItem.weight;
        if (!sanitizedItem.sku) delete sanitizedItem.sku;
        if (!sanitizedItem.description) delete sanitizedItem.description;
        return sanitizedItem;
      });

      if (isEdit) {
        await api.patch(`/orders/${order._id}`, payload);
      } else {
        await api.post('/orders', payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save order');
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: 'items', label: 'ITEMS', icon: '📦' },
    { key: 'pickup', label: 'PICKUP', icon: '📤' },
    { key: 'delivery', label: 'DELIVERY', icon: '📥' },
    { key: 'details', label: 'DETAILS', icon: '⚙' },
  ];

  const handleTabClick = (tabKey) => {
    setTab(tabKey);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `EDIT ${order.orderNumber}` : 'NEW ORDER'}</span>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              style={{
                ...styles.tab,
                ...(tab === t.key ? styles.tabActive : {}),
                ...(tabErrors[t.key] ? styles.tabError : {}),
              }}
              onClick={() => handleTabClick(t.key)}
            >
              <span style={styles.tabIcon}>{t.icon}</span>
              {t.label}
              {tabErrors[t.key] && <span style={styles.tabErrorDot}>●</span>}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {error && <div style={styles.error}>{error}</div>}

            {/* Items Tab */}
            {tab === 'items' && (
              <div>
                {(form.items || []).map((item, idx) => (
                  <div key={idx} style={styles.itemBlock}>
                    <div style={styles.itemBlockHeader}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>ITEM {idx + 1}</span>
                      {(form.items?.length || 0) > 1 && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>Remove</button>
                      )}
                    </div>

                    <div className="grid-2" style={{ gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Item Name *</label>
                        <input className="form-input" value={item?.name || ''} onChange={setItem(idx, 'name')} placeholder="Product name" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">SKU</label>
                        <input className="form-input" value={item?.sku || ''} onChange={setItem(idx, 'sku')} placeholder="SKU-001" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Quantity *</label>
                        <input className="form-input" type="number" min="1" value={item?.quantity ?? 1} onChange={setItem(idx, 'quantity')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Weight (kg)</label>
                        <input className="form-input" type="number" step="0.1" value={item?.weight || ''} onChange={setItem(idx, 'weight')} placeholder="1.5" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label className="form-label">Description</label>
                      <input className="form-input" value={item?.description || ''} onChange={setItem(idx, 'description')} placeholder="Optional description" />
                    </div>

                    {/* Image upload */}
                    <div style={styles.imageSection}>
                      <div style={styles.imagePreview}>
                        {item.svgImage ? (
                          <div dangerouslySetInnerHTML={{ __html: item.svgImage }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                        ) : uploadingItem === idx ? (
                          <div style={{ color: 'var(--accent)', fontSize: 12 }}>Converting…</div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
                            <div style={{ fontSize: 28 }}>🖼</div>
                            No image
                          </div>
                        )}
                      </div>
                      <div style={styles.imageActions}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          Upload a photo of this item.<br />
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Converted to SVG & stored in DB</span>
                        </div>
                        <input
                          ref={el => fileRefs.current[idx] = el}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => handleImageUpload(idx, e.target.files[0])}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => fileRefs.current[idx]?.click()}
                          disabled={uploadingItem === idx}
                        >
                          {uploadingItem === idx ? 'Converting…' : item.svgImage ? '↻ Replace' : '↑ Upload'}
                        </button>
                        {item.svgImage && (
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                            const items = [...form.items];
                            items[idx] = { ...items[idx], svgImage: '' };
                            setForm(f => ({ ...f, items }));
                          }}>Remove</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary w-full" onClick={addItem} style={{ marginTop: 8 }}>
                  + Add Item
                </button>
              </div>
            )}

            {/* Pickup Address */}
            {tab === 'pickup' && <AddressForm label="PICKUP ADDRESS" address={form.pickupAddress || emptyAddress()} setField={setAddress('pickupAddress')} />}

            {/* Delivery Address */}
            {tab === 'delivery' && <AddressForm label="DELIVERY ADDRESS" address={form.deliveryAddress || emptyAddress()} setField={setAddress('deliveryAddress')} />}

            {/* Details */}
            {tab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={form.priority || 'normal'} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Scheduled Pickup</label>
                    <input className="form-input" type="datetime-local" value={form.scheduledPickup || ''} onChange={e => setForm(f => ({ ...f, scheduledPickup: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scheduled Delivery</label>
                    <input className="form-input" type="datetime-local" value={form.scheduledDelivery || ''} onChange={e => setForm(f => ({ ...f, scheduledDelivery: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Special instructions…" />
                </div>
              </div>
            )}
          </div>

          {/* Tab navigation + Submit */}
          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {tab !== 'items' && (
                <button type="button" className="btn btn-secondary" onClick={() => {
                  const keys = TABS.map(t => t.key);
                  const idx = keys.indexOf(tab);
                  if (idx > 0) setTab(keys[idx - 1]);
                }}>
                  ← Back
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              {tab !== 'details' ? (
                <button type="button" className="btn btn-primary" onClick={() => {
                  const keys = TABS.map(t => t.key);
                  const idx = keys.indexOf(tab);
                  if (idx < keys.length - 1) setTab(keys[idx + 1]);
                }}>
                  Next →
                </button>
              ) : (
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Order'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddressForm({ label, address, setField }) {
  const safeAddress = address || emptyAddress();

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 16 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Company</label>
            <input className="form-input" value={safeAddress.company || ''} onChange={setField('company')} placeholder="Company name" />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Name</label>
            <input className="form-input" value={safeAddress.contactName || ''} onChange={setField('contactName')} placeholder="John Smith" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Street Address *</label>
          <input className="form-input" value={safeAddress.street || ''} onChange={setField('street')} placeholder="123 Main St" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">State/Province *</label>
            <StateSelect country={safeAddress.country} value={safeAddress.state || ''} onChange={v => setField('state')({ target: { value: v } })} />
          </div>
          <div className="form-group">
            <label className="form-label">City *</label>
            <CityInput country={safeAddress.country} state={safeAddress.state} value={safeAddress.city || ''} onChange={v => setField('city')({ target: { value: v } })} placeholder="City" />
          </div>
          <div className="form-group">
            <label className="form-label">Postal Code *</label>
            <input className="form-input" value={safeAddress.postalCode || ''} onChange={setField('postalCode')} placeholder="10001" />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Country</label>
            <CountrySelect value={safeAddress.country || ''} onChange={v => setField('country')({ target: { value: v } })} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={safeAddress.phone || ''} onChange={setField('phone')} placeholder="+1 555 0000" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Google Map Location (Link or Plus Code) *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              className="form-input" 
              style={{ flex: 1 }} 
              value={safeAddress.googleMapLocation || ''} 
              onChange={setField('googleMapLocation')} 
              placeholder="https://maps.google.com/?q=... or Plus Code" 
            />
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      const link = `https://maps.google.com/?q=${latitude},${longitude}`;
                      setField('googleMapLocation')({ target: { value: link } });
                    },
                    (err) => alert('Unable to retrieve location. Please check your browser permissions.')
                  );
                } else {
                  alert('Geolocation is not supported by this browser.');
                }
              }}
            >
              📍 Live Location
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => window.open('https://maps.google.com', '_blank')}
              title="Open Google Maps to find your location manually"
            >
              🗺️ Open Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '1px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'relative',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottom: '2px solid var(--accent)',
    background: 'rgba(0, 212, 255, 0.05)',
  },
  tabError: {
    color: 'var(--danger)',
  },
  tabErrorDot: {
    fontSize: 8,
    color: 'var(--danger)',
    marginLeft: 2,
    animation: 'pulse 1.5s infinite',
  },
  tabIcon: {
    fontSize: 14,
  },
  error: {
    background: 'rgba(255,61,87,0.1)',
    border: '1px solid rgba(255,61,87,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--danger)',
    fontSize: 13,
    marginBottom: 16,
  },
  itemBlock: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  itemBlockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  imageSection: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    padding: '12px',
    background: 'rgba(0,212,255,0.03)',
    borderRadius: 8,
    border: '1px dashed rgba(0,212,255,0.2)',
  },
  imagePreview: {
    width: 80,
    height: 80,
    background: 'var(--bg-input)',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imageActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    justifyContent: 'center',
  },
};
