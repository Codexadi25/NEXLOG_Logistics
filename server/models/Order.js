const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  weight: { type: Number }, // kg
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
  },
  svgImage: { type: String }, // SVG markup stored directly in DB
  imageMimeType: { type: String, default: 'image/svg+xml' },
  description: { type: String },
  value: { type: Number }, // unit value in INR
});

const addressSchema = new mongoose.Schema({
  company: String,
  contactName: String,
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true, default: 'US' },
  phone: String,
  email: String,
  googleMapLocation: { type: String, required: true },
  coordinates: {
    lat: Number,
    lng: Number,
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // driver/manager
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    default: 'pending',
  },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  items: [itemSchema],
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,
  scheduledPickup: Date,
  scheduledDelivery: Date,
  actualPickup: Date,
  actualDelivery: Date,
  totalWeight: Number,
  totalValue: Number,
  shippingCost: Number,
  notes: String,
  internalNotes: String,
  tags: [String],
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
  }],
  internalLogs: [{
    note: String,
    type: { type: String, enum: ['note', 'call', 'message'], default: 'note' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// Auto-generate order number
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Order').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    this.orderNumber = `ORD-${year}${month}-${String(count + 1).padStart(5, '0')}`;

    this.statusHistory.push({ status: this.status, note: 'Order created' });
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
