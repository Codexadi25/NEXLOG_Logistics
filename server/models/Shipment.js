const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  description: String,
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  timestamp: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAutomated: { type: Boolean, default: false },
});

const shipmentSchema = new mongoose.Schema({
  trackingNumber: { type: String, unique: true },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vehicle: {
    type: { type: String },
    licensePlate: String,
    model: String,
  },
  status: {
    type: String,
    enum: ['scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
    default: 'scheduled',
  },
  origin: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: { lat: Number, lng: Number },
  },
  destination: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: { lat: Number, lng: Number },
  },
  currentLocation: {
    address: String,
    city: String,
    state: String,
    coordinates: { lat: Number, lng: Number },
    lastUpdated: Date,
  },
  estimatedDelivery: Date,
  actualDelivery: Date,
  trackingEvents: [trackingEventSchema],
  proofOfDelivery: {
    signatureSvg: String, // Signature stored as SVG
    photoSvg: String,     // Delivery photo converted to SVG
    timestamp: Date,
    receivedBy: String,
  },
  route: [{
    lat: Number,
    lng: Number,
    timestamp: Date,
  }],
  notes: String,
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
}, { timestamps: true });

shipmentSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Shipment').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    this.trackingNumber = `TRK-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);
