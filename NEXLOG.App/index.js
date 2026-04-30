/**
 * models/Delivery.js
 */
const mongoose = require('mongoose');

const CoordSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
}, { _id: false });

const StatusHistorySchema = new mongoose.Schema({
  status: String,
  location: CoordSchema,
  timestamp: Date,
}, { _id: false });

const DeliverySchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', index: true },

  customerName: { type: String, required: true },
  customerPhone: String,
  deliveryAddress: { type: String, required: true },

  destination: CoordSchema,   // lat/lng of delivery address
  origin: CoordSchema,        // warehouse / pickup location

  status: {
    type: String,
    enum: ['pending', 'in_transit', 'arrived', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  },
  statusHistory: [StatusHistorySchema],

  timeSlot: String,           // e.g. "10:00 AM – 12:00 PM"
  scheduledDate: { type: Date, index: true },
  deliveredAt: Date,
  failedAt: Date,

  itemCount: { type: Number, default: 1 },
  codAmount: { type: Number, default: 0 },
  distanceKm: Number,

  notes: String,
}, { timestamps: true });

module.exports = mongoose.model('Delivery', DeliverySchema);


/**
 * models/LocationBatch.js
 * 
 * Stores the 1-minute buffered batches from delivery partners.
 * Each document = one flush event.
 */
const LocationBatchSchema = new mongoose.Schema({
  deliveryId: { type: String, index: true },         // could be 'general' for non-delivery tracking
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', index: true },

  flushedAt: { type: Date, index: true },
  pointCount: Number,

  points: [{
    lat: Number,
    lng: Number,
    accuracy: Number,       // metres
    speed: Number,          // m/s
    heading: Number,        // degrees
    altitude: Number,       // metres
    provider: { type: String, enum: ['gps', 'network', 'fused'] },
    timestamp: Date,
    isMoving: Boolean,
    batteryLevel: Number,   // 0–1
    _id: false,
  }],
}, { timestamps: true });

// TTL index: auto-delete location data after 90 days
LocationBatchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Geospatial query support (optional): store first/last point as 2dsphere
LocationBatchSchema.index({ 'points.lat': 1, 'points.lng': 1 });

module.exports = mongoose.model('LocationBatch', LocationBatchSchema);
