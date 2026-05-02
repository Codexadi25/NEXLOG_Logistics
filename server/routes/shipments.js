const express = require('express');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const { auth, requireRole } = require('../middleware/auth');
const { broadcastTrackingUpdate, notifyOrderUpdate } = require('../websocket/wsServer');

const router = express.Router();

// Get all shipments
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};

    if (req.user.role === 'driver') query.driver = req.user._id;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { trackingNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Shipment.countDocuments(query);
    const shipments = await Shipment.find(query)
      .populate('driver', 'name email phone')
      .populate({ path: 'orders', populate: { path: 'client', select: 'name email company' } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ shipments, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single shipment
router.get('/:id', auth, async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id)
      .populate('driver', 'name email phone')
      .populate({ path: 'orders', populate: { path: 'client', select: 'name email company' } });

    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    res.json({ shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create shipment
router.post('/', auth, requireRole('admin', 'manager', 'agent'), async (req, res) => {
  try {
    const shipment = await Shipment.create(req.body);

    // Link orders to shipment
    if (req.body.orders && req.body.orders.length > 0) {
      await Order.updateMany(
        { _id: { $in: req.body.orders } },
        { shipment: shipment._id, status: 'processing' }
      );
    }

    res.status(201).json({ shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update shipment status / location
router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, currentLocation, trackingEvent, proofOfDelivery, route, ...updates } = req.body;
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

    if (status && status !== shipment.status) {
      shipment.status = status;
      if (status === 'delivered') {
        shipment.actualDelivery = new Date();
        // Update associated orders
        await Order.updateMany({ shipment: shipment._id }, { status: 'delivered', actualDelivery: new Date() });
      } else if (status === 'failed') {
        await Order.updateMany({ shipment: shipment._id }, { status: 'cancelled' }); // Or 'failed' if added to schema
      }
    }

    if (currentLocation) {
      shipment.currentLocation = { ...currentLocation, lastUpdated: new Date() };

      // Add to route history
      if (currentLocation.coordinates) {
        shipment.route.push({
          lat: currentLocation.coordinates.lat,
          lng: currentLocation.coordinates.lng,
          timestamp: new Date(),
        });
      }
    }

    if (trackingEvent) {
      shipment.trackingEvents.push({
        ...trackingEvent,
        updatedBy: req.user._id,
        timestamp: new Date(),
      });
    }

    if (proofOfDelivery) {
      shipment.proofOfDelivery = { ...proofOfDelivery, timestamp: new Date() };
    }

    Object.assign(shipment, updates);
    await shipment.save();

    // Broadcast real-time tracking update via WebSocket
    broadcastTrackingUpdate(shipment._id.toString(), {
      status: shipment.status,
      currentLocation: shipment.currentLocation,
      trackingEvent: trackingEvent || null,
      updatedAt: new Date().toISOString(),
    });

    res.json({ shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get tracking by tracking number (public)
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ trackingNumber: req.params.trackingNumber })
      .populate('driver', 'name phone')
      .select('-proofOfDelivery.signatureSvg -proofOfDelivery.photoSvg -route');

    if (!shipment) return res.status(404).json({ message: 'Tracking number not found' });
    res.json({ shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Lifecycle Designer: Create a multi-stop lifecycle shipment ────────────────
// POST /api/shipments/lifecycle
router.post('/lifecycle', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { stops, trackingNumber, orders } = req.body;
    if (!stops || stops.length < 2) {
      return res.status(400).json({ message: 'At least 2 stops (origin and destination) are required' });
    }

    // Enforce: only the last stop may be marked "delivered"
    const validatedStops = stops.map((stop, idx) => {
      const isLast = idx === stops.length - 1;
      if (!isLast && stop.status === 'delivered') {
        stop.status = 'arrived'; // downgrade to arrived for intermediate stops
      }
      return stop;
    });

    // Derive origin and destination from stops
    const origin = {
      address: validatedStops[0].address,
      city: validatedStops[0].city,
    };
    const destination = {
      address: validatedStops[validatedStops.length - 1].address,
      city: validatedStops[validatedStops.length - 1].city,
    };

    const shipment = await Shipment.create({
      orders: orders || [],
      origin,
      destination,
      lifecycleStops: validatedStops,
      status: 'scheduled',
    });

    res.status(201).json({ shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Lifecycle Designer: Update stops for existing shipment ───────────────────
// PATCH /api/shipments/:id/lifecycle
router.patch('/:id/lifecycle', auth, requireRole('admin', 'manager', 'agent'), async (req, res) => {
  try {
    const { stops } = req.body;
    if (!stops) return res.status(400).json({ message: 'stops array required' });

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

    // Enforce: only the last stop may be marked "delivered"
    const validatedStops = stops.map((stop, idx) => {
      const isLast = idx === stops.length - 1;
      if (!isLast && stop.status === 'delivered') {
        stop.status = 'arrived';
      }
      return stop;
    });

    shipment.lifecycleStops = validatedStops;

    // Derive overall shipment status from last stop
    const lastStop = validatedStops[validatedStops.length - 1];
    if (lastStop.status === 'delivered') {
      shipment.status = 'delivered';
      shipment.actualDelivery = lastStop.actualArrival ? new Date(lastStop.actualArrival) : new Date();
      await Order.updateMany({ shipment: shipment._id }, { status: 'delivered', actualDelivery: shipment.actualDelivery });
    } else {
      // Find the most advanced active stop to derive shipment status
      const hasInTransit = validatedStops.some(s => s.status === 'in_transit');
      const hasOutForDelivery = validatedStops.some(s => s.status === 'out_for_delivery');
      if (hasOutForDelivery) shipment.status = 'out_for_delivery';
      else if (hasInTransit) shipment.status = 'in_transit';
    }

    // Add a tracking event for the update
    shipment.trackingEvents.push({
      status: shipment.status,
      description: 'Lifecycle stops updated',
      updatedBy: req.user._id,
      timestamp: new Date(),
    });

    await shipment.save();

    // Broadcast update
    const { broadcastTrackingUpdate } = require('../websocket/wsServer');
    broadcastTrackingUpdate(shipment._id.toString(), {
      status: shipment.status,
      lifecycleStops: shipment.lifecycleStops,
      updatedAt: new Date().toISOString(),
    });

    res.json({ shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
