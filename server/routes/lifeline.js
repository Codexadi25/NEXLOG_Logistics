const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Only internal roles can access Lifeline
const INTERNAL_ROLES = ['admin', 'manager', 'agent'];

const ORDER_POPULATE = [
  { path: 'client', select: 'name email phone company role' },
  { path: 'assignedTo', select: 'name email phone vehicleType vehicleLicensePlate vehicleCapacity assignedArea kyc isOnboarded' },
  { path: 'shipment', select: 'trackingNumber status driver vehicle origin destination trackingEvents createdAt' },
  { path: 'statusHistory.updatedBy', select: 'name role' },
];

/**
 * POST /api/lifeline/search
 * Body: { mode, query }
 * Modes: order_id | tracking_id | shipment_id | driver_phone | driver_id |
 *         vehicle_id | customer_email | customer_id | store_id | driver_name
 */
router.post('/search', auth, requireRole(...INTERNAL_ROLES), async (req, res) => {
  try {
    const { mode, query } = req.body;
    if (!query?.trim()) return res.status(400).json({ message: 'Search query is required' });

    const q = query.trim();
    let orders = [];

    switch (mode) {
      case 'order_id': {
        const isObjectId = mongoose.isValidObjectId(q);
        const filter = isObjectId
          ? { $or: [{ _id: q }, { orderNumber: { $regex: q, $options: 'i' } }] }
          : { orderNumber: { $regex: q, $options: 'i' } };
        orders = await Order.find(filter).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(20);
        break;
      }
      case 'tracking_id': {
        const shipments = await Shipment.find({ trackingNumber: { $regex: q, $options: 'i' } }).select('_id');
        const sIds = shipments.map(s => s._id);
        orders = await Order.find({ shipment: { $in: sIds } }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(20);
        break;
      }
      case 'shipment_id': {
        const filter = mongoose.isValidObjectId(q) ? { _id: q } : { trackingNumber: { $regex: q, $options: 'i' } };
        const shipment = await Shipment.findOne(filter).select('_id');
        if (!shipment) { orders = []; break; }
        orders = await Order.find({ shipment: shipment._id }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(20);
        break;
      }
      case 'driver_phone': {
        const driver = await User.findOne({ phone: { $regex: q, $options: 'i' }, role: 'driver' });
        if (!driver) { orders = []; break; }
        orders = await Order.find({ assignedTo: driver._id }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(30);
        break;
      }
      case 'driver_id': {
        const driverId = mongoose.isValidObjectId(q) ? q : null;
        if (!driverId) { orders = []; break; }
        orders = await Order.find({ assignedTo: driverId }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(30);
        break;
      }
      case 'vehicle_id': {
        const drivers = await User.find({ vehicleLicensePlate: { $regex: q, $options: 'i' } }).select('_id');
        orders = await Order.find({ assignedTo: { $in: drivers.map(d => d._id) } }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(30);
        break;
      }
      case 'customer_email': {
        const client = await User.findOne({ email: { $regex: q, $options: 'i' } });
        if (!client) { orders = []; break; }
        orders = await Order.find({ client: client._id }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(30);
        break;
      }
      case 'customer_id': {
        const cId = mongoose.isValidObjectId(q) ? q : null;
        if (!cId) { orders = []; break; }
        orders = await Order.find({ client: cId }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(30);
        break;
      }
      case 'store_id': {
        // store/vendor/hub is the 'client' with role in [vendor, store, distributor, fulfillment_center]
        const entity = await User.findOne({
          $or: [
            mongoose.isValidObjectId(q) ? { _id: q } : null,
            { company: { $regex: q, $options: 'i' } },
            { name: { $regex: q, $options: 'i' } },
          ].filter(Boolean),
          role: { $in: ['vendor', 'store', 'distributor', 'fulfillment_center'] },
        });
        if (!entity) { orders = []; break; }
        orders = await Order.find({ client: entity._id }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(30);
        break;
      }
      case 'driver_name': {
        const drivers = await User.find({ name: { $regex: q, $options: 'i' }, role: 'driver' }).select('_id');
        orders = await Order.find({ assignedTo: { $in: drivers.map(d => d._id) } }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(30);
        break;
      }
      default:
        // Generic search across order number, client name/email
        const clients = await User.find({
          $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }],
        }).select('_id');
        orders = await Order.find({
          $or: [
            { orderNumber: { $regex: q, $options: 'i' } },
            { client: { $in: clients.map(c => c._id) } },
          ],
        }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(20);
    }

    res.json({ orders, total: orders.length, mode, query: q });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a tag to an order
router.post('/orders/:id/tags', auth, requireRole(...INTERNAL_ROLES), async (req, res) => {
  try {
    const { tag } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { $addToSet: { tags: tag } }, { new: true });
    res.json({ order });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Add internal note / call log
router.post('/orders/:id/notes', auth, requireRole(...INTERNAL_ROLES), async (req, res) => {
  try {
    const { note, type = 'note' } = req.body; // type: note | call | message
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.internalLogs) order.internalLogs = [];
    order.internalLogs.push({ note, type, createdBy: req.user._id, createdAt: new Date() });
    await order.save({ validateBeforeSave: false });
    res.json({ order });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
